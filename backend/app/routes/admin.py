from contextlib import closing

from flask import jsonify

from app.auth.middleware import require_admin
from app.db import get_db_connection
from app.routes import bp


@bp.route("/admin/users", methods=["GET"])
@require_admin
def list_users():
    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, email, display_name,
                       quota_bytes, used_bytes, is_admin, created_at
                FROM users
                ORDER BY created_at DESC
                """
            )
            rows = cur.fetchall()
    return jsonify(rows)
