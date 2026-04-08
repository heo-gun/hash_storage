from contextlib import closing

from flask import jsonify

from app.db import get_db_connection
from app.routes import bp
from app.storage import ensure_bucket_exists


@bp.route("/health", methods=["GET"])
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
