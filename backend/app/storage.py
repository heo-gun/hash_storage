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
    # 빈 문자열이면 None 으로 → IAM Role 자동 인증 (프로덕션 AWS)
    endpoint = S3_ENDPOINT_URL or None
    access_key = S3_ACCESS_KEY or None
    secret_key = S3_SECRET_KEY or None

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=S3_REGION,
        use_ssl=S3_USE_SSL,
    )


def ensure_bucket_exists():
    """개발(MinIO) 환경에서 버킷을 자동 생성. 프로덕션에서는 버킷이 이미 존재해야 함."""
    s3 = get_s3_client()
    try:
        s3.head_bucket(Bucket=S3_BUCKET_NAME)
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code in ("404", "NoSuchBucket"):
            # MinIO 및 us-east-1 이외 리전에서는 LocationConstraint 필요
            if S3_REGION and S3_REGION != "us-east-1":
                s3.create_bucket(
                    Bucket=S3_BUCKET_NAME,
                    CreateBucketConfiguration={"LocationConstraint": S3_REGION},
                )
            else:
                s3.create_bucket(Bucket=S3_BUCKET_NAME)
        else:
            raise
