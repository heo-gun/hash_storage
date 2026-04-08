from contextlib import closing

from flask import jsonify, request

from app.db import get_db_connection
from app.routes import bp


@bp.route("/folders", methods=["POST"])
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
