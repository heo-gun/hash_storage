import boto3
from botocore.exceptions import ClientError

from app.config import (
    S3_ACCESS_KEY,
    S3_BUCKET_NAME,
    S3_ENDPOINT_URL,
    S3_REGION,
    S3_SECRET_KEY,
    S3_USE_SSL,
)


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
        use_ssl=S3_USE_SSL,
    )


def ensure_bucket_exists():
    s3 = get_s3_client()
    try:
        s3.head_bucket(Bucket=S3_BUCKET_NAME)
    except ClientError:
        s3.create_bucket(Bucket=S3_BUCKET_NAME)
