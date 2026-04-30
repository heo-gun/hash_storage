import os
from contextlib import closing

from flask import jsonify, request

from app.config import S3_BUCKET_NAME
from app.db import get_db_connection
from app.routes import bp
from app.storage import get_s3_client

# 허용하지 않을 파일명 문자 (경로 순회 방지)
_FORBIDDEN = set('/\\:*?"<>|\x00')


def _sanitize_name(name: str) -> str:
    """파일명에서 경로 구분자 및 제어 문자를 제거하고 기본 이름만 반환."""
    name = os.path.basename(name).strip()
    name = "".join(c for c in name if c not in _FORBIDDEN)
    return name or "unnamed"


@bp.route("/files/upload", methods=["POST"])
def upload_file():
    file = request.files.get("file")
    hash_id = request.form.get("hash_id")
    parent_id = request.form.get("parent_id") or None
    name = request.form.get("name")

    if not file:
        return jsonify({"message": "File is required"}), 400
    if not hash_id:
        return jsonify({"message": "Hash ID is required"}), 400

    original_name = _sanitize_name(name or file.filename or "unnamed")
    mime_type = file.mimetype or "application/octet-stream"

    # 파일 크기를 스트림 탐색으로 계산 (전체 메모리 로드 방지)
    file.stream.seek(0, 2)
    size_bytes = file.stream.tell()
    file.stream.seek(0)

    s3_key = hash_id

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            # 같은 위치에 동일 이름 존재 여부 확인
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
                return jsonify({"message": "A node with the same name already exists"}), 409

            # blob 존재 여부 확인 (dedup)
            cur.execute(
                "SELECT hash_id, ref_count FROM file_blobs WHERE hash_id = %s",
                (hash_id,),
            )
            blob = cur.fetchone()

            if blob is None:
                # 신규 파일: S3에 스트리밍 업로드
                s3 = get_s3_client()
                s3.upload_fileobj(
                    file.stream,
                    S3_BUCKET_NAME,
                    s3_key,
                    ExtraArgs={"ContentType": mime_type},
                )
                cur.execute(
                    """
                    INSERT INTO file_blobs (hash_id, size_bytes, mime_type, s3_key, ref_count)
                    VALUES (%s, %s, %s, %s, 0)
                    """,
                    (hash_id, size_bytes, mime_type, s3_key),
                )

            # VFS 노드 생성
            cur.execute(
                """
                INSERT INTO fs_nodes (parent_id, node_type, name, hash_id)
                VALUES (%s, 'file', %s, %s)
                RETURNING node_id, parent_id, node_type, name, hash_id, created_at, updated_at
                """,
                (parent_id, original_name, hash_id),
            )
            new_node = cur.fetchone()

            # ref_count 증가
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

    return jsonify({
        "message": "uploaded",
        "deduplicated": blob is not None,
        "node": new_node,
        "blob": blob_info,
    }), 201
