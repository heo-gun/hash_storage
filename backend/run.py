import io
import os
from collections import Counter
from contextlib import closing

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file
from psycopg import connect
from psycopg.rows import dict_row
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    "dbname": os.getenv("POSTGRES_DB", "fms"),
    "user": os.getenv("POSTGRES_USER", "fms_user"),
    "password": os.getenv("POSTGRES_PASSWORD", "fms_password"),
    "host": os.getenv("POSTGRES_HOST", "postgres"),
    "port": os.getenv("POSTGRES_PORT", 5432),
}

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "http://minio:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "fms-bucket")
S3_REGION = os.getenv("S3_REGION", "ap-northeast-2")
S3_USE_SSL = os.getenv("S3_USE_SSL", "false").lower() == "true"


def get_db_connection():
    return connect(**DB_CONFIG, row_factory=dict_row)


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
        use_ssl=S3_USE_SSL,
    )


def ensure_bucket_exists():
    s3 = get_s3_client()
    try:
        s3.head_bucket(Bucket=S3_BUCKET_NAME)
    except ClientError:
        s3.create_bucket(Bucket=S3_BUCKET_NAME)


@app.route("/health", methods=["GET"])
def health():
    try:
        ensure_bucket_exists()
        with closing(get_db_connection()) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/nodes", methods=["GET"])
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


@app.route("/folders", methods=["POST"])
def create_folder():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    parent_id = data.get("parent_id")

    if not name:
        return jsonify({"message": "Folder name is required"}), 400

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            if parent_id:
                cur.execute(
                    """SELECT 1 FROM fs_nodes WHERE parent_id = %s AND name = %s""",
                    (parent_id, name),
                )

            else:
                cur.execute(
                    """SELECT 1 FROM fs_nodes WHERE parent_id IS NULL AND name = %s""",
                    (name,),
                )

            if cur.fetchone():
                return jsonify({"message": "A node with the same already exists"}), 409

            cur.execute(
                """INSERT INTO fs_nodes (parent_id, node_type, name)
                        VALUES (%s, 'folder', %s)
                        RETURNING node_id, parent_id, node_type, name, hash_id, created_at, updated_at""",
                (parent_id, name),
            )
            new_folder = cur.fetchone()
            conn.commit()
    return jsonify(new_folder), 201


@app.route("/files/upload", methods=["POST"])
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


def _collect_subtree_file_hashes(cur, node_id):
    cur.execute(
        """
        WITH RECURSIVE subtree AS (
            SELECT node_id, parent_id, node_type, hash_id
            FROM fs_nodes WHERE node_id = %s
            UNION ALL
            SELECT n.node_id, n.parent_id, n.node_type, n.hash_id
            FROM fs_nodes n
            INNER JOIN subtree s ON n.parent_id = s.node_id
        )
        SELECT hash_id FROM subtree
        WHERE node_type = 'file' AND hash_id IS NOT NULL
        """,
        (node_id,),
    )
    rows = cur.fetchall()
    return Counter(r["hash_id"] for r in rows)


def _apply_blob_deref_and_cleanup_s3(cur, counts):
    """ref_count 감소 후 0이면 MinIO 객체와 file_blobs 행 제거."""
    removed = []
    s3 = None
    for hash_id, cnt in counts.items():
        cur.execute(
            """
            UPDATE file_blobs
            SET ref_count = GREATEST(ref_count - %s, 0)
            WHERE hash_id = %s
            RETURNING ref_count, s3_key
            """,
            (cnt, hash_id),
        )
        row = cur.fetchone()
        if not row or row["ref_count"] > 0:
            continue
        if s3 is None:
            s3 = get_s3_client()
        try:
            s3.delete_object(Bucket=S3_BUCKET_NAME, Key=row["s3_key"])
        except ClientError:
            pass
        cur.execute("DELETE FROM file_blobs WHERE hash_id = %s", (hash_id,))
        removed.append(hash_id)
    return removed


@app.route("/nodes/<node_id>/download", methods=["GET"])
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


@app.route("/nodes/<node_id>", methods=["DELETE"])
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

            counts = _collect_subtree_file_hashes(cur, node_id)

            cur.execute("DELETE FROM fs_nodes WHERE node_id = %s", (node_id,))

            removed_hashes = _apply_blob_deref_and_cleanup_s3(cur, counts)

            conn.commit()

    return jsonify(
        {
            "message": "deleted",
            "dereferenced_blob_hashes": list(counts.keys()),
            "removed_blobs_from_storage": removed_hashes,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
