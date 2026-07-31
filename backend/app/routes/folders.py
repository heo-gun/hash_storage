from contextlib import closing

from flask import g, jsonify, request

from app.auth.middleware import require_auth
from app.db import get_db_connection
from app.routes import bp


@bp.route("/folders", methods=["POST"])
@require_auth
def create_folder():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    parent_id = data.get("parent_id")
    owner_id = g.current_user["user_id"]

    if not name:
        return jsonify({"message": "Folder name is required"}), 400

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            # 부모 폴더가 본인 소유인지 확인
            if parent_id:
                cur.execute(
                    "SELECT 1 FROM fs_nodes WHERE node_id = %s AND owner_id = %s AND node_type = 'folder'",
                    (parent_id, owner_id),
                )
                if not cur.fetchone():
                    return jsonify({"message": "Parent folder not found"}), 404

            # 같은 위치 중복 이름 확인 (user-scope)
            if parent_id:
                cur.execute(
                    "SELECT 1 FROM fs_nodes WHERE owner_id = %s AND parent_id = %s AND name = %s",
                    (owner_id, parent_id, name),
                )
            else:
                cur.execute(
                    "SELECT 1 FROM fs_nodes WHERE owner_id = %s AND parent_id IS NULL AND name = %s",
                    (owner_id, name),
                )
            if cur.fetchone():
                return jsonify({"message": "A node with the same name already exists"}), 409

            cur.execute(
                """
                INSERT INTO fs_nodes (owner_id, parent_id, node_type, name)
                VALUES (%s, %s, 'folder', %s)
                RETURNING node_id, parent_id, node_type, name, hash_id, created_at, updated_at
                """,
                (owner_id, parent_id, name),
            )
            new_folder = cur.fetchone()
            conn.commit()

    return jsonify(new_folder), 201


@bp.route("/folders/ensure-path", methods=["POST"])
@require_auth
def ensure_folder_path():
    """경로 세그먼트 배열을 받아 없는 폴더만 만들고 말단 폴더의 node_id를 반환.

    폴더 업로드에서 파일 하나하나마다 /folders 를 호출하지 않도록 하기 위한 것.
    이미 존재하는 세그먼트는 재사용하므로 여러 번 호출해도 안전(idempotent)하다.
    """
    data = request.get_json(force=True)
    segments = data.get("segments") or []
    parent_id = data.get("parent_id")
    owner_id = g.current_user["user_id"]

    if not isinstance(segments, list) or not segments:
        return jsonify({"message": "segments is required"}), 400

    cleaned = [str(s).strip() for s in segments]
    if any(not s or s in (".", "..") for s in cleaned):
        return jsonify({"message": "Invalid path segment"}), 400

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            if parent_id:
                cur.execute(
                    "SELECT 1 FROM fs_nodes WHERE node_id = %s AND owner_id = %s AND node_type = 'folder'",
                    (parent_id, owner_id),
                )
                if not cur.fetchone():
                    return jsonify({"message": "Parent folder not found"}), 404

            current = parent_id
            for name in cleaned:
                if current:
                    cur.execute(
                        "SELECT node_id, node_type FROM fs_nodes "
                        "WHERE owner_id = %s AND parent_id = %s AND name = %s",
                        (owner_id, current, name),
                    )
                else:
                    cur.execute(
                        "SELECT node_id, node_type FROM fs_nodes "
                        "WHERE owner_id = %s AND parent_id IS NULL AND name = %s",
                        (owner_id, name),
                    )
                existing = cur.fetchone()

                if existing:
                    if existing["node_type"] != "folder":
                        conn.rollback()
                        return jsonify({
                            "message": f'"{name}" already exists as a file'
                        }), 409
                    current = existing["node_id"]
                    continue

                cur.execute(
                    """
                    INSERT INTO fs_nodes (owner_id, parent_id, node_type, name)
                    VALUES (%s, %s, 'folder', %s)
                    RETURNING node_id
                    """,
                    (owner_id, current, name),
                )
                current = cur.fetchone()["node_id"]

            conn.commit()

    return jsonify({"node_id": current, "segments": cleaned}), 200
