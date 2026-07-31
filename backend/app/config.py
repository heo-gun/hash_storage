import os

DB_CONFIG = {
    "dbname": os.getenv("POSTGRES_DB", "fms"),
    "user": os.getenv("POSTGRES_USER", "fms_user"),
    "password": os.getenv("POSTGRES_PASSWORD", "fms_password"),
    "host": os.getenv("POSTGRES_HOST", "postgres"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
}

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "fms-bucket")
S3_REGION = os.getenv("S3_REGION", "ap-northeast-2")
S3_USE_SSL = os.getenv("S3_USE_SSL", "false").lower() == "true"

# ── AWS Cognito ─────────────────────────────────────────────
COGNITO_REGION = os.getenv("COGNITO_REGION", "ap-northeast-2")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")
# ID token을 검증 대상으로 사용 (email/profile claim 포함)
COGNITO_ISSUER = (
    f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
    if COGNITO_USER_POOL_ID
    else ""
)
COGNITO_JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json" if COGNITO_ISSUER else ""

# 인증 우회 (로컬 개발 시 true로 설정하면 X-Debug-User-Sub 헤더로 유저 흉내)
AUTH_DEV_BYPASS = os.getenv("AUTH_DEV_BYPASS", "false").lower() == "true"

# ── Phase 3: .epf 보호 공유 ─────────────────────────────────
# CEK 를 감싸는 마스터키 (base64 32바이트). 미설정 시 공유 API 가 503 을 반환한다.
EPF_MASTER_KEY = os.getenv("EPF_MASTER_KEY", "")
# 공유 링크를 만들 때 쓰는 사용자용 베이스 URL (예: https://castorfs.org)
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
