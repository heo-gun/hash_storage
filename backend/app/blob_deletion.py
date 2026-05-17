import logging
from collections import Counter

from botocore.exceptions import ClientError

from app.config import S3_BUCKET_NAME
from app.storage import get_s3_client

logger = logging.getLogger(__name__)


def collect_subtree_files(cur, node_id, owner_id):
    """node_id 하위 트리(같은 owner의 파일만)에서 (hash_id, size_bytes) 행 목록 반환.

    중복 파일도 각각 행으로 반환하므로 quota 계산용 합계 + ref_count 감산용
    Counter 모두에 사용 가능.
    """
    cur.execute(
        """
        WITH RECURSIVE subtree AS (
            SELECT node_id, node_type, hash_id, owner_id
            FROM fs_nodes
            WHERE node_id = %s AND owner_id = %s
            UNION ALL
            SELECT n.node_id, n.node_type, n.hash_id, n.owner_id
            FROM fs_nodes n
            INNER JOIN subtree s ON n.parent_id = s.node_id
            WHERE n.owner_id = s.owner_id
        )
        SELECT s.hash_id, b.size_bytes
        FROM subtree s
        JOIN file_blobs b ON s.hash_id = b.hash_id
        WHERE s.node_type = 'file' AND s.hash_id IS NOT NULL
        """,
        (node_id, owner_id),
    )
    return cur.fetchall()


def apply_blob_deref_and_cleanup_s3(cur, counts: Counter):
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

        if s3 is None:
            s3 = get_s3_client()
        try:
            s3.delete_object(Bucket=S3_BUCKET_NAME, Key=row["s3_key"])
        except ClientError as e:
            logger.error(
                "S3 object deletion failed for key=%s: %s",
                row["s3_key"],
                e,
            )
            continue

        cur.execute("DELETE FROM file_blobs WHERE hash_id = %s", (hash_id,))
        removed.append(hash_id)

    return removed
