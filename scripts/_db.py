"""스크립트 공용 DB 연결. 백엔드와 같은 .env 를 읽는다."""
import os
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parent.parent


def _load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def connect() -> psycopg.Connection:
    _load_env()
    host = os.getenv("POSTGRES_HOST", "localhost")
    dsn = (
        f"host={host} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'filedb')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', '')}"
    )
    if not host.endswith((".local", "localhost")) and "localhost" not in host:
        print(f"[!] 대상 DB: {host}", file=sys.stderr)
    return psycopg.connect(dsn, row_factory=dict_row)
