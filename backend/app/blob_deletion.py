from collections import Counter

from botocore.exceptions import ClientError

from app.config import S3_BUCKET_NAME
from app.storage import get_s3_client


def collect_subtree_file_hashes(cur, node_id):
    cur.execute(
        """
        WITH RECURSIVE subtree AS (
            SELECT node_id, parent_id, node_type, hash_id
            FROM fs_nodes WHERE node_id = %s
            UNION ALL
            SELECT n.node_id, n.parent_id, n.node_type, n.hash_id
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
    """ref_count 감소 후 0이면 MinIO 객체와 file_blobs 행 제거."""
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
        except ClientError:
            pass
        cur.execute("DELETE FROM file_blobs WHERE hash_id = %s", (hash_id,))
        removed.append(hash_id)
    return removed
