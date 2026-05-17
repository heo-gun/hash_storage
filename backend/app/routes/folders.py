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
