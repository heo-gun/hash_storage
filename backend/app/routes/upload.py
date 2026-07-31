import os
from contextlib import closing

from flask import g, jsonify, request

from app.auth.middleware import require_auth
from app.config import S3_BUCKET_NAME
from app.db import get_db_connection
from app.routes import bp
from app.services.node_service import VISIBILITIES
from app.services.user_service import QuotaExceeded, adjust_used_bytes, check_quota
from app.storage import get_s3_client

_FORBIDDEN = set('/\\:*?"<>|\x00')


def _sanitize_name(name: str) -> str:
    name = os.path.basename(name).strip()
    name = "".join(c for c in name if c not in _FORBIDDEN)
    return name or "unnamed"


@bp.route("/files/upload", methods=["POST"])
@require_auth
def upload_file():
    file = request.files.get("file")
    hash_id = request.form.get("hash_id")
    parent_id = request.form.get("parent_id") or None
    name = request.form.get("name")
    visibility = request.form.get("visibility") or "private"
    owner_id = g.current_user["user_id"]

    if not file:
        return jsonify({"message": "File is required"}), 400
    if not hash_id:
        return jsonify({"message": "Hash ID is required"}), 400
    if visibility not in VISIBILITIES:
        return jsonify({"message": f"visibility must be one of {VISIBILITIES}"}), 400

    original_name = _sanitize_name(name or file.filename or "unnamed")
    mime_type = file.mimetype or "application/octet-stream"

    file.stream.seek(0, 2)
    size_bytes = file.stream.tell()
    file.stream.seek(0)

    s3_key = hash_id

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            # 부모 폴더 소유권 검증
            if parent_id:
                cur.execute(
                    "SELECT 1 FROM fs_nodes WHERE node_id = %s AND owner_id = %s AND node_type = 'folder'",
                    (parent_id, owner_id),
                )
                if not cur.fetchone():
                    return jsonify({"message": "Parent folder not found"}), 404

            # quota 검사 (FOR UPDATE로 users 행 락)
            try:
                check_quota(cur, owner_id, size_bytes)
            except QuotaExceeded as e:
                return jsonify({
                    "message": "Storage quota exceeded",
                    "used_bytes": e.used,
                    "quota_bytes": e.quota,
                    "attempted_bytes": e.attempted,
                }), 413

            # 같은 위치 중복 이름 확인 (user-scope)
            if parent_id:
                cur.execute(
                    "SELECT 1 FROM fs_nodes WHERE owner_id = %s AND parent_id = %s AND name = %s",
                    (owner_id, parent_id, original_name),
                )
            else:
                cur.execute(
                    "SELECT 1 FROM fs_nodes WHERE owner_id = %s AND parent_id IS NULL AND name = %s",
                    (owner_id, original_name),
                )
            if cur.fetchone():
                return jsonify({"message": "A node with the same name already exists"}), 409

            # blob 존재 여부 확인 (글로벌 dedup)
            cur.execute(
                "SELECT hash_id, ref_count FROM file_blobs WHERE hash_id = %s",
                (hash_id,),
            )
            blob = cur.fetchone()

            if blob is None:
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

            cur.execute(
                """
                INSERT INTO fs_nodes (owner_id, parent_id, node_type, name, hash_id, visibility)
                VALUES (%s, %s, 'file', %s, %s, %s)
                RETURNING node_id, parent_id, node_type, name, hash_id, visibility,
                          created_at, updated_at
                """,
                (owner_id, parent_id, original_name, hash_id, visibility),
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

            # 유저 used_bytes 증가 (dedup 여부 무관 — 논리적 사용량 기준)
            adjust_used_bytes(cur, owner_id, size_bytes)

            conn.commit()

    return jsonify({
        "message": "uploaded",
        "deduplicated": blob is not None,
        "node": new_node,
        "blob": blob_info,
    }), 201
