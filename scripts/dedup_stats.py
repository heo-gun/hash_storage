"""dedup 실적 측정 — 논리 사용량 대비 실제 저장 바이트.

논리 = 사용자가 올린 것으로 치는 양 (파일 참조마다 크기를 셈)
물리 = S3 에 실제로 존재하는 양 (blob 한 벌당 한 번만 셈)

    python scripts/dedup_stats.py
    python scripts/dedup_stats.py --per-user
"""
import argparse

from _db import connect


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(n) < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


def main(per_user: bool) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            # ref_count 는 전역 참조 수이므로 논리 = Σ(size × ref_count).
            cur.execute(
                """
                SELECT
                    count(*)                              AS blobs,
                    coalesce(sum(size_bytes), 0)          AS physical,
                    coalesce(sum(size_bytes * ref_count), 0) AS logical,
                    count(*) FILTER (WHERE ref_count > 1) AS shared_blobs,
                    coalesce(sum(ref_count), 0)           AS refs
                FROM file_blobs
                """
            )
            s = cur.fetchone()

            physical, logical = s["physical"], s["logical"]
            saved = logical - physical
            ratio = (logical / physical) if physical else 0

            print("전체 저장소")
            print("─" * 46)
            print(f"  고유 blob        {s['blobs']:>12,}")
            print(f"  총 참조          {s['refs']:>12,}")
            print(f"  2회 이상 참조    {s['shared_blobs']:>12,}")
            print()
            print(f"  논리 사용량      {human(logical):>12}")
            print(f"  물리 저장량      {human(physical):>12}")
            print(f"  절약             {human(saved):>12}")
            if physical:
                print(f"  dedup 비율       {ratio:>11.2f}x  "
                      f"(절약률 {saved / logical * 100 if logical else 0:.1f}%)")

            cur.execute(
                """
                SELECT b.hash_id, b.size_bytes, b.ref_count,
                       b.size_bytes * (b.ref_count - 1) AS saved
                FROM file_blobs b
                WHERE b.ref_count > 1
                ORDER BY saved DESC LIMIT 5
                """
            )
            top = cur.fetchall()
            if top:
                print("\n절약 기여 상위")
                print("─" * 46)
                for r in top:
                    print(f"  {r['hash_id'][:12]}…  ×{r['ref_count']:<4} "
                          f"{human(r['size_bytes']):>10} → 절약 {human(r['saved'])}")

            if per_user:
                cur.execute(
                    """
                    SELECT u.email,
                           count(n.node_id)                    AS files,
                           coalesce(sum(b.size_bytes), 0)      AS logical,
                           u.used_bytes
                    FROM users u
                    LEFT JOIN fs_nodes n
                           ON n.owner_id = u.user_id AND n.node_type = 'file'
                    LEFT JOIN file_blobs b ON n.hash_id = b.hash_id
                    GROUP BY u.user_id, u.email, u.used_bytes
                    ORDER BY logical DESC
                    """
                )
                print("\n사용자별")
                print("─" * 46)
                for r in cur.fetchall():
                    drift = r["used_bytes"] - r["logical"]
                    flag = "" if drift == 0 else f"   ← used_bytes 오차 {human(drift)}"
                    print(f"  {r['email']:<28} {r['files']:>7,}개 "
                          f"{human(r['logical']):>10}{flag}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--per-user", action="store_true", help="사용자별 내역과 quota 오차")
    main(p.parse_args().per_user)
