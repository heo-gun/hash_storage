from contextlib import closing

from flask import jsonify, request

from app.config import S3_BUCKET_NAME
from app.db import get_db_connection
from app.routes import bp
from app.storage import ensure_bucket_exists, get_s3_client


@bp.route("/files/upload", methods=["POST"])
def upload_file():
    ensure_bucket_exists()

    file = request.files.get("file")
    hash_id = request.form.get("hash_id")
    parent_id = request.form.get("parent_id") or None
    name = request.form.get("name")

    if not file:
        return jsonify({"message": "File is required"}), 400

    if not hash_id:
        return jsonify({"message": "Hash ID is required"}), 400

    original_name = name or file.filename
    mime_type = file.mimetype or "application/octet-stream"

    file_bytes = file.read()
    size_bytes = len(file_bytes)
    s3_key = hash_id

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            if parent_id:
                cur.execute(
                    "SELECT 1 FROM fs_nodes WHERE parent_id = %s AND name = %s",
                    (parent_id, original_name),
                )

            else:
                cur.execute(
                    "SELECT 1 FROM fs_nodes WHERE parent_id IS NULL AND name = %s",
                    (original_name,),
                )

            if cur.fetchone():
                return (
                    jsonify({"message": "A node with the same name already exists"}),
                    409,
                )

            cur.execute(
                """
                SELECT hash_id, ref_count
                FROM file_blobs
                WHERE hash_id = %s
                """,
                (hash_id,),
            )
            blob = cur.fetchone()

            if blob is None:
                s3 = get_s3_client()
                s3.put_object(
                    Bucket=S3_BUCKET_NAME,
                    Key=s3_key,
                    Body=file_bytes,
                    ContentType=mime_type,
                )

                cur.execute(
                    """
                    INSERT INTO file_blobs (hash_id, size_bytes, mime_type, s3_key, ref_count)
                    VALUES (%s, %s, %s, %s, 0)
                    """,
                    (hash_id, size_bytes, mime_type, s3_key),
                )
            cur.execute(
                """
                INSERT INTO fs_nodes (parent_id, node_type, name, hash_id)
                VALUES (%s, 'file', %s, %s)
                RETURNING node_id, parent_id, node_type, name, hash_id, created_at, updated_at
                """,
                (parent_id, original_name, hash_id),
            )
            new_node = cur.fetchone()

            cur.execute(
                """
                UPDATE file_blobs
                SET ref_count = ref_count + 1
                WHERE hash_id = %s
                RETURNING hash_id, ref_count
                """,
                (hash_id,),
            )
            blob_info = cur.fetchone()

            conn.commit()
    return (
        jsonify(
            {
                "message": "uploaded",
                "deduplicated": blob is not None,
                "node": new_node,
                "blob": blob_info,
            }
        ),
        201,
    )
