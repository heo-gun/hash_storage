import os

DB_CONFIG = {
    "dbname": os.getenv("POSTGRES_DB", "fms"),
    "user": os.getenv("POSTGRES_USER", "fms_user"),
    "password": os.getenv("POSTGRES_PASSWORD", "fms_password"),
    "host": os.getenv("POSTGRES_HOST", "postgres"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
}

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "http://minio:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "fms-bucket")
S3_REGION = os.getenv("S3_REGION", "ap-northeast-2")
S3_USE_SSL = os.getenv("S3_USE_SSL", "false").lower() == "true"
