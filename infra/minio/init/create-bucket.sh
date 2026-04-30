#!/bin/sh
# MinIO 버킷 초기화 스크립트
# docker-compose.yml의 minio-init 서비스에서 실행됨 (mc 이미지 사용)
# 직접 실행 시: docker run --rm --network fms_default minio/mc ...

set -e

MINIO_ALIAS="local"
MINIO_HOST="${MINIO_HOST:-http://minio:9000}"
BUCKET="${S3_BUCKET_NAME:-fms-bucket}"

echo "MinIO 연결 중: $MINIO_HOST"
mc alias set "$MINIO_ALIAS" "$MINIO_HOST" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

echo "버킷 생성 (이미 존재하면 skip): $BUCKET"
mc mb --ignore-existing "$MINIO_ALIAS/$BUCKET"

echo "버킷 준비 완료: $BUCKET"
mc ls "$MINIO_ALIAS"
