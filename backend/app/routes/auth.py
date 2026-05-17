from contextlib import closing

from flask import g, jsonify

from app.auth.middleware import require_auth
from app.blob_deletion import apply_blob_deref_and_cleanup_s3
from app.db import get_db_connection
from app.routes import bp


@bp.route("/auth/me", methods=["GET"])
@require_auth
def get_me():
    u = g.current_user
    return jsonify({
        "user_id": u["user_id"],
        "email": u["email"],
        "display_name": u["display_name"],
        "quota_bytes": u["quota_bytes"],
        "used_bytes": u["used_bytes"],
        "is_admin": u["is_admin"],
    })


@bp.route("/auth/me", methods=["DELETE"])
@require_auth
def delete_me():
    """계정 즉시 하드 삭제. S3 파일은 ref_count 감소만 (글로벌 dedup 보존)."""
    from collections import Counter

    owner_id = g.current_user["user_id"]

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            # 본인의 모든 파일 노드 → ref_count 일괄 감산
            cur.execute(
                """
                SELECT b.hash_id
                FROM fs_nodes n
                JOIN file_blobs b ON n.hash_id = b.hash_id
                WHERE n.owner_id = %s AND n.node_type = 'file'
                """,
                (owner_id,),
            )
            counts = Counter(r["hash_id"] for r in cur.fetchall())

            # ON DELETE CASCADE로 fs_nodes 행은 자동 삭제됨
            cur.execute("DELETE FROM users WHERE user_id = %s", (owner_id,))

            removed = apply_blob_deref_and_cleanup_s3(cur, counts)
            conn.commit()

    return jsonify({
        "message": "account deleted",
        "removed_blobs_from_storage": removed,
    })
