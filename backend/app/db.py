from psycopg import connect
from psycopg.rows import dict_row

from app.config import DB_CONFIG


def get_db_connection():
    return connect(**DB_CONFIG, row_factory=dict_row)
