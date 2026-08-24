"""벤치마크용 가상 트리 시딩.

S3 는 건드리지 않는다. file_blobs 행만 만들고 s3_key 는 실제 오브젝트를 가리키지
않으므로, 시딩한 파일은 다운로드할 수 없다. 트리 탐색·집계 쿼리 측정 전용이다.

사용 예:
    python scripts/seed_fake_nodes.py --files 100000 --dup-ratio 0.3
    python scripts/seed_fake_nodes.py --cleanup
"""
import argparse
import hashlib
import random
import sys
import time
import uuid

from _db import connect

SEED_EMAIL = "bench@seed.local"
SEED_SUB = "seed-benchmark-user"
# 시딩한 행만 골라 지울 수 있도록 이름에 접두사를 박는다.
PREFIX = "bench_"


def ensure_user(cur) -> str:
    cur.execute("SELECT user_id FROM users WHERE cognito_sub = %s", (SEED_SUB,))
    row = cur.fetchone()
    if row:
        return row["user_id"]
    cur.execute(
        """
        INSERT INTO users (cognito_sub, email, display_name, quota_bytes)
        VALUES (%s, %s, 'Benchmark Seed', 1099511627776)
        RETURNING user_id
        """,
        (SEED_SUB, SEED_EMAIL),
    )
    return cur.fetchone()["user_id"]


def build_folders(cur, owner_id, count: int, depth: int) -> list[str]:
    """폭보다 깊이가 중요한 구조를 만든다 — 재귀 CTE 비용을 보려면 깊어야 한다."""
    levels: list[list[str]] = [[None]]
    created: list[str] = []
    per_level = max(count // depth, 1)

    for d in range(depth):
        parents = levels[-1]
        this_level: list[str] = []
        for i in range(per_level):
            parent = random.choice(parents)
            node_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO fs_nodes (node_id, owner_id, parent_id, node_type, name, visibility)
                VALUES (%s, %s, %s, 'folder', %s, 'private')
                """,
                (node_id, owner_id, parent, f"{PREFIX}d{d}_{i}_{node_id[:8]}"),
            )
            this_level.append(node_id)
            created.append(node_id)
        levels.append(this_level)
    return created


def seed(files: int, folders: int, depth: int, dup_ratio: float) -> None:
    started = time.perf_counter()
    with connect() as conn:
        with conn.cursor() as cur:
            owner_id = ensure_user(cur)
            print(f"owner_id = {owner_id}")

            folder_ids = build_folders(cur, owner_id, folders, depth)
            print(f"폴더 {len(folder_ids)}개 생성 (depth={depth})")

            # 고유 blob 을 먼저 만들고, dup_ratio 만큼은 기존 blob 을 재사용한다.
            unique_count = max(int(files * (1 - dup_ratio)), 1)
            blobs: list[tuple[str, int]] = []
            for i in range(unique_count):
                digest = hashlib.sha256(f"{PREFIX}{i}".encode()).hexdigest()
                size = random.randint(4_096, 8_388_608)
                cur.execute(
                    """
                    INSERT INTO file_blobs (hash_id, size_bytes, mime_type, s3_key, ref_count)
                    VALUES (%s, %s, 'application/octet-stream', %s, 0)
                    ON CONFLICT (hash_id) DO NOTHING
                    """,
                    (digest, size, digest),
                )
                blobs.append((digest, size))
            print(f"고유 blob {len(blobs)}개 생성")

            total_logical = 0
            for i in range(files):
                digest, size = random.choice(blobs)
                parent = random.choice(folder_ids)
                cur.execute(
                    """
                    INSERT INTO fs_nodes
                        (owner_id, parent_id, node_type, name, hash_id, visibility)
                    VALUES (%s, %s, 'file', %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (
                        owner_id,
                        parent,
                        f"{PREFIX}f{i}_{uuid.uuid4().hex[:8]}.bin",
                        digest,
                        "public" if i % 10 == 0 else "private",
                    ),
                )
                cur.execute(
                    "UPDATE file_blobs SET ref_count = ref_count + 1 WHERE hash_id = %s",
                    (digest,),
                )
                total_logical += size

                if i and i % 10_000 == 0:
                    conn.commit()
                    print(f"  {i:,} / {files:,}")

            cur.execute(
                "UPDATE users SET used_bytes = %s WHERE user_id = %s",
                (total_logical, owner_id),
            )
            conn.commit()

    elapsed = time.perf_counter() - started
    print(f"\n완료: 파일 {files:,}개 / {elapsed:.1f}s")
    print(f"논리 사용량 {total_logical / 1e9:.2f} GB")


def cleanup() -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM users WHERE cognito_sub = %s", (SEED_SUB,))
            row = cur.fetchone()
            if not row:
                print("시딩 데이터 없음")
                return
            # fs_nodes 는 owner CASCADE 로 함께 지워진다.
            cur.execute("DELETE FROM users WHERE user_id = %s", (row["user_id"],))
            cur.execute(
                "DELETE FROM file_blobs WHERE hash_id IN "
                "(SELECT hash_id FROM file_blobs WHERE ref_count = 0 AND s3_key = hash_id)"
            )
            conn.commit()
    print("시딩 데이터 삭제 완료")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--files", type=int, default=100_000)
    p.add_argument("--folders", type=int, default=2_000)
    p.add_argument("--depth", type=int, default=8)
    p.add_argument(
        "--dup-ratio",
        type=float,
        default=0.3,
        help="같은 내용을 재사용할 비율 (0.3 = 파일의 30%%가 중복)",
    )
    p.add_argument("--cleanup", action="store_true", help="시딩 데이터 삭제 후 종료")
    args = p.parse_args()

    if args.cleanup:
        cleanup()
        sys.exit(0)

    seed(args.files, args.folders, args.depth, args.dup_ratio)
