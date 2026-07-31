"""공개 파일 검색 — 인증 없이 접근 가능.

visibility='public' 인 file 노드만 노출한다. private/shared 노드는 절대 결과에
포함되지 않으며, 응답에도 owner_id 같은 내부 식별자를 넣지 않는다.
"""
import io
from contextlib import closing

from flask import jsonify, request, send_file

from app.config import S3_BUCKET_NAME
from app.db import get_db_connection
from app.routes import bp
from app.storage import get_s3_client

MAX_LIMIT = 100
DEFAULT_LIMIT = 30


@bp.route("/search", methods=["GET"])
def search_public():
    q = (request.args.get("q") or "").strip()

    try:
        limit = min(int(request.args.get("limit", DEFAULT_LIMIT)), MAX_LIMIT)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        return jsonify({"message": "limit/offset must be integers"}), 400

    # q 가 비면 최신 공개 파일을 보여준다 (탐색용 기본 화면)
    where = "n.visibility = 'public' AND n.node_type = 'file'"
    params: list = []
    if q:
        where += " AND n.name ILIKE %s"
        params.append(f"%{q}%")

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT n.node_id, n.name, n.created_at,
                       b.size_bytes, b.mime_type,
                       u.name AS owner_name
                FROM fs_nodes n
                JOIN file_blobs b ON n.hash_id = b.hash_id
                JOIN users u ON n.owner_id = u.user_id
                WHERE {where}
                ORDER BY n.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            rows = cur.fetchall()

            cur.execute(
                f"""
                SELECT count(*) AS total
                FROM fs_nodes n
                JOIN file_blobs b ON n.hash_id = b.hash_id
                WHERE {where}
                """,
                tuple(params),
            )
            total = cur.fetchone()["total"]

    return jsonify({
        "query": q,
        "total": total,
        "limit": limit,
        "offset": offset,
        "results": rows,
    })


@bp.route("/public/nodes/<node_id>/download", methods=["GET"])
def download_public_node(node_id):
    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT n.name, b.s3_key, b.mime_type
                FROM fs_nodes n
                JOIN file_blobs b ON n.hash_id = b.hash_id
                WHERE n.node_id = %s AND n.node_type = 'file' AND n.visibility = 'public'
                """,
                (node_id,),
            )
            row = cur.fetchone()

    if not row:
        return jsonify({"message": "File not found"}), 404

    s3 = get_s3_client()
    obj = s3.get_object(Bucket=S3_BUCKET_NAME, Key=row["s3_key"])

    return send_file(
        io.BytesIO(obj["Body"].read()),
        mimetype=row["mime_type"] or "application/octet-stream",
        as_attachment=True,
        download_name=row["name"],
    )
