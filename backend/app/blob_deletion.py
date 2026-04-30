import logging
from collections import Counter

from botocore.exceptions import ClientError

from app.config import S3_BUCKET_NAME
from app.storage import get_s3_client

logger = logging.getLogger(__name__)


def collect_subtree_file_hashes(cur, node_id):
    """node_id 하위 트리에 있는 모든 파일의 hash_id와 등장 횟수를 반환."""
    cur.execute(
        """
        WITH RECURSIVE subtree AS (
            SELECT node_id, node_type, hash_id
            FROM fs_nodes WHERE node_id = %s
            UNION ALL
            SELECT n.node_id, n.node_type, n.hash_id
            FROM fs_nodes n
            INNER JOIN subtree s ON n.parent_id = s.node_id
        )
        SELECT hash_id FROM subtree
        WHERE node_type = 'file' AND hash_id IS NOT NULL
        """,
        (node_id,),
    )
    rows = cur.fetchall()
    return Counter(r["hash_id"] for r in rows)


def apply_blob_deref_and_cleanup_s3(cur, counts):
    """ref_count 감소 후 0이 된 blob은 S3 오브젝트와 DB 레코드를 함께 삭제."""
    removed = []
    s3 = None

    for hash_id, cnt in counts.items():
        cur.execute(
            """
            UPDATE file_blobs
            SET ref_count = GREATEST(ref_count - %s, 0)
            WHERE hash_id = %s
            RETURNING ref_count, s3_key
            """,
            (cnt, hash_id),
        )
        row = cur.fetchone()
        if not row or row["ref_count"] > 0:
            continue

        # ref_count = 0 → GC 대상
        if s3 is None:
            s3 = get_s3_client()
        try:
            s3.delete_object(Bucket=S3_BUCKET_NAME, Key=row["s3_key"])
        except ClientError as e:
            # S3 삭제 실패 시 DB 레코드는 유지 (孤立 오브젝트 방지)
            logger.error(
                "S3 object deletion failed for key=%s: %s",
                row["s3_key"],
                e,
            )
            continue

        cur.execute("DELETE FROM file_blobs WHERE hash_id = %s", (hash_id,))
        removed.append(hash_id)

    return removed
