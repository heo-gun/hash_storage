import io
from contextlib import closing

from flask import jsonify, request, send_file

from app.blob_deletion import apply_blob_deref_and_cleanup_s3, collect_subtree_file_hashes
from app.config import S3_BUCKET_NAME
from app.db import get_db_connection
from app.routes import bp
from app.storage import ensure_bucket_exists, get_s3_client


@bp.route("/nodes", methods=["GET"])
def get_nodes():
    parent_id = request.args.get("parent_id")

    query_root = """
    SELECT
        node_id,
        parent_id,
        node_type,
        name,
        hash_id,
        created_at,
        updated_at
    FROM fs_nodes
    WHERE parent_id IS NULL
    ORDER BY node_type DESC, name ASC
"""

    query_child = """
    SELECT
        node_id,
        parent_id,
        node_type,
        name,
        hash_id,
        created_at,
        updated_at
    FROM fs_nodes
    WHERE parent_id = %s
    ORDER BY node_type DESC, name ASC
"""

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            if parent_id:
                cur.execute(query_child, (parent_id,))
            else:
                cur.execute(query_root)

            rows = cur.fetchall()
    return jsonify(rows)


@bp.route("/nodes/<node_id>/download", methods=["GET"])
def download_node(node_id):
    ensure_bucket_exists()
    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT n.name, n.node_type, b.s3_key, b.mime_type
                FROM fs_nodes n
                JOIN file_blobs b ON n.hash_id = b.hash_id
                WHERE n.node_id = %s AND n.node_type = 'file'
                """,
                (node_id,),
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


@bp.route("/nodes/<node_id>", methods=["DELETE"])
def delete_node(node_id):
    ensure_bucket_exists()
    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM fs_nodes WHERE node_id = %s",
                (node_id,),
            )
            if not cur.fetchone():
                return jsonify({"message": "Node not found"}), 404

            counts = collect_subtree_file_hashes(cur, node_id)

            cur.execute("DELETE FROM fs_nodes WHERE node_id = %s", (node_id,))

            removed_hashes = apply_blob_deref_and_cleanup_s3(cur, counts)

            conn.commit()

    return jsonify(
        {
            "message": "deleted",
            "dereferenced_blob_hashes": list(counts.keys()),
            "removed_blobs_from_storage": removed_hashes,
        }
    )
