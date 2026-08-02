import io
from collections import Counter
from contextlib import closing

from flask import g, jsonify, request, send_file

from app.auth.middleware import require_auth
from app.blob_deletion import apply_blob_deref_and_cleanup_s3, collect_subtree_files
from app.config import S3_BUCKET_NAME
from app.db import get_db_connection
from app.routes import bp
from app.services.node_service import VISIBILITIES
from app.services.user_service import adjust_used_bytes
from app.storage import get_s3_client

# 그래프 뷰가 한 번에 받아갈 최대 노드 수. 이보다 크면 브라우저 쪽 힘 시뮬레이션이
# 먼저 무너지므로, 잘라 보내고 잘렸다는 사실을 알린다.
TREE_NODE_LIMIT = 5000


@bp.route("/nodes", methods=["GET"])
@require_auth
def get_nodes():
    parent_id = request.args.get("parent_id")
    owner_id = g.current_user["user_id"]

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            if parent_id:
                cur.execute(
                    """
                    SELECT node_id, parent_id, node_type, name, hash_id, visibility,
                           created_at, updated_at
                    FROM fs_nodes
                    WHERE owner_id = %s AND parent_id = %s
                    ORDER BY node_type DESC, name ASC
                    """,
                    (owner_id, parent_id),
                )
            else:
                cur.execute(
                    """
                    SELECT node_id, parent_id, node_type, name, hash_id, visibility,
                           created_at, updated_at
                    FROM fs_nodes
                    WHERE owner_id = %s AND parent_id IS NULL
                    ORDER BY node_type DESC, name ASC
                    """,
                    (owner_id,),
                )
            rows = cur.fetchall()

    return jsonify(rows)


@bp.route("/nodes/tree", methods=["GET"])
@require_auth
def get_node_tree():
    """소유자의 전체 노드를 한 번에 반환 — 그래프 뷰용.

    /nodes 는 parent_id 한 단계씩만 주므로 그래프를 그리려면 폴더 수만큼
    왕복해야 한다. 여기서는 단일 쿼리로 끝낸다.

    file_blobs.ref_count 는 내보내지 않는다. 그것은 전역 참조 수라서 다른
    사용자가 같은 파일을 갖고 있는지까지 알려준다. 화면에 필요한 "내 트리
    안에서 몇 번 등장하는가"는 클라이언트가 hash_id 로 묶어 세면 된다.
    """
    owner_id = g.current_user["user_id"]

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT n.node_id, n.parent_id, n.node_type, n.name, n.hash_id,
                       n.visibility, n.created_at, b.size_bytes, b.mime_type
                FROM fs_nodes n
                LEFT JOIN file_blobs b ON n.hash_id = b.hash_id
                WHERE n.owner_id = %s
                ORDER BY n.node_type DESC, n.name ASC
                LIMIT %s
                """,
                (owner_id, TREE_NODE_LIMIT + 1),
            )
            rows = cur.fetchall()

    truncated = len(rows) > TREE_NODE_LIMIT
    return jsonify({
        "nodes": rows[:TREE_NODE_LIMIT],
        "truncated": truncated,
        "limit": TREE_NODE_LIMIT,
    })


@bp.route("/nodes/<node_id>/download", methods=["GET"])
@require_auth
def download_node(node_id):
    owner_id = g.current_user["user_id"]

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT n.name, b.s3_key, b.mime_type
                FROM fs_nodes n
                JOIN file_blobs b ON n.hash_id = b.hash_id
                WHERE n.node_id = %s AND n.owner_id = %s AND n.node_type = 'file'
                """,
                (node_id, owner_id),
            )
            row = cur.fetchone()

    if not row:
        return jsonify({"message": "File not found"}), 404

    s3 = get_s3_client()
    obj = s3.get_object(Bucket=S3_BUCKET_NAME, Key=row["s3_key"])
    body = obj["Body"].read()
    mime = row["mime_type"] or "application/octet-stream"

    return send_file(
        io.BytesIO(body),
        mimetype=mime,
        as_attachment=True,
        download_name=row["name"],
    )


@bp.route("/nodes/<node_id>/visibility", methods=["PATCH"])
@require_auth
def update_node_visibility(node_id):
    owner_id = g.current_user["user_id"]
    data = request.get_json(force=True)
    visibility = data.get("visibility")

    if visibility not in VISIBILITIES:
        return jsonify({"message": f"visibility must be one of {VISIBILITIES}"}), 400

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE fs_nodes
                SET visibility = %s, updated_at = now()
                WHERE node_id = %s AND owner_id = %s
                RETURNING node_id, parent_id, node_type, name, hash_id, visibility,
                          created_at, updated_at
                """,
                (visibility, node_id, owner_id),
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"message": "Node not found"}), 404

            # 'shared' 를 벗어나면 살아있는 공유 링크도 같이 끊는다. 그러지 않으면
            # 목록엔 Private 인데 예전 링크로는 계속 열람되는 상태가 된다.
            revoked = 0
            if visibility != "shared":
                cur.execute(
                    """
                    UPDATE access_grants SET revoked_at = now()
                    WHERE node_id = %s AND grantor_id = %s AND revoked_at IS NULL
                    RETURNING grant_id
                    """,
                    (node_id, owner_id),
                )
                revoked = len(cur.fetchall())

            conn.commit()

    row["revoked_shares"] = revoked
    return jsonify(row)


@bp.route("/nodes/<node_id>", methods=["DELETE"])
@require_auth
def delete_node(node_id):
    owner_id = g.current_user["user_id"]

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM fs_nodes WHERE node_id = %s AND owner_id = %s",
                (node_id, owner_id),
            )
            if not cur.fetchone():
                return jsonify({"message": "Node not found"}), 404

            files = collect_subtree_files(cur, node_id, owner_id)
            total_size = sum(r["size_bytes"] for r in files)
            counts = Counter(r["hash_id"] for r in files)

            cur.execute(
                "DELETE FROM fs_nodes WHERE node_id = %s AND owner_id = %s",
                (node_id, owner_id),
            )
            removed_hashes = apply_blob_deref_and_cleanup_s3(cur, counts)
            adjust_used_bytes(cur, owner_id, -total_size)

            conn.commit()

    return jsonify({
        "message": "deleted",
        "freed_bytes": total_size,
        "dereferenced_blob_hashes": list(counts.keys()),
        "removed_blobs_from_storage": removed_hashes,
    })
