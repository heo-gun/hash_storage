"""트리 쿼리 지연 측정.

애플리케이션 코드가 실제로 쓰는 쿼리를 그대로 돌린다 (routes/nodes.py,
blob_deletion.py, routes/search.py). HTTP·네트워크를 빼고 DB 지연만 본다.

    python scripts/seed_fake_nodes.py --files 100000
    python scripts/benchmark_tree.py
"""
import argparse
import random
import statistics
import time

from _db import connect

SEED_SUB = "seed-benchmark-user"


def measure(cur, label: str, sql: str, params_fn, runs: int) -> dict:
    """params_fn 은 매 회 새 파라미터를 만든다 — 같은 행만 캐시에 태우지 않기 위해."""
    samples = []
    rows_seen = 0
    for _ in range(runs):
        params = params_fn()
        start = time.perf_counter()
        cur.execute(sql, params)
        rows = cur.fetchall()
        samples.append((time.perf_counter() - start) * 1000)
        rows_seen = len(rows)

    samples.sort()
    return {
        "label": label,
        "runs": runs,
        "rows": rows_seen,
        "p50": statistics.median(samples),
        "p95": samples[int(len(samples) * 0.95) - 1],
        "max": samples[-1],
    }


def main(runs: int) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM users WHERE cognito_sub = %s", (SEED_SUB,))
            row = cur.fetchone()
            if not row:
                raise SystemExit("시딩 데이터가 없습니다. seed_fake_nodes.py 를 먼저 실행하세요.")
            owner_id = row["user_id"]

            cur.execute(
                "SELECT count(*) AS n, count(*) FILTER (WHERE node_type = 'file') AS files "
                "FROM fs_nodes WHERE owner_id = %s",
                (owner_id,),
            )
            counts = cur.fetchone()
            print(f"대상: 노드 {counts['n']:,}개 (파일 {counts['files']:,})\n")

            cur.execute(
                "SELECT node_id FROM fs_nodes WHERE owner_id = %s AND node_type = 'folder' "
                "ORDER BY random() LIMIT 200",
                (owner_id,),
            )
            folders = [r["node_id"] for r in cur.fetchall()]
            pick = lambda: (owner_id, random.choice(folders))  # noqa: E731

            results = [
                measure(
                    cur,
                    "폴더 1단계 조회 (GET /nodes)",
                    """
                    SELECT node_id, parent_id, node_type, name, hash_id, visibility,
                           created_at, updated_at
                    FROM fs_nodes
                    WHERE owner_id = %s AND parent_id = %s
                    ORDER BY node_type DESC, name ASC
                    """,
                    pick,
                    runs,
                ),
                measure(
                    cur,
                    "전체 트리 (GET /nodes/tree)",
                    """
                    SELECT n.node_id, n.parent_id, n.node_type, n.name, n.hash_id,
                           n.visibility, n.created_at, b.size_bytes, b.mime_type
                    FROM fs_nodes n
                    LEFT JOIN file_blobs b ON n.hash_id = b.hash_id
                    WHERE n.owner_id = %s
                    ORDER BY n.node_type DESC, n.name ASC
                    LIMIT 5001
                    """,
                    lambda: (owner_id,),
                    max(runs // 10, 3),
                ),
                measure(
                    cur,
                    "하위 트리 재귀 수집 (DELETE 경로)",
                    """
                    WITH RECURSIVE subtree AS (
                        SELECT node_id, node_type, hash_id, owner_id
                        FROM fs_nodes WHERE node_id = %s AND owner_id = %s
                        UNION ALL
                        SELECT n.node_id, n.node_type, n.hash_id, n.owner_id
                        FROM fs_nodes n
                        INNER JOIN subtree s ON n.parent_id = s.node_id
                        WHERE n.owner_id = s.owner_id
                    )
                    SELECT s.hash_id, b.size_bytes
                    FROM subtree s JOIN file_blobs b ON s.hash_id = b.hash_id
                    WHERE s.node_type = 'file' AND s.hash_id IS NOT NULL
                    """,
                    lambda: (random.choice(folders), owner_id),
                    runs,
                ),
                measure(
                    cur,
                    "공개 파일 검색 (GET /search, pg_trgm)",
                    """
                    SELECT n.node_id, n.name, n.created_at, b.size_bytes, b.mime_type
                    FROM fs_nodes n
                    JOIN file_blobs b ON n.hash_id = b.hash_id
                    WHERE n.visibility = 'public' AND n.node_type = 'file'
                      AND n.name ILIKE %s
                    ORDER BY n.created_at DESC LIMIT 20
                    """,
                    lambda: (f"%{random.randint(0, 9999)}%",),
                    runs,
                ),
            ]

    width = max(len(r["label"]) for r in results)
    print(f"{'쿼리'.ljust(width)}  {'p50':>9} {'p95':>9} {'max':>9}  rows")
    print("─" * (width + 42))
    for r in results:
        print(
            f"{r['label'].ljust(width)}  "
            f"{r['p50']:>8.2f}ms {r['p95']:>8.2f}ms {r['max']:>8.2f}ms  {r['rows']:,}"
        )


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--runs", type=int, default=100)
    main(p.parse_args().runs)
