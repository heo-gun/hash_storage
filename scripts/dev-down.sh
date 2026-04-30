#!/bin/bash
# 로컬 개발 환경 종료
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "[dev-down] 컨테이너 종료 중..."
docker compose down

echo "[dev-down] 완료. 볼륨(데이터)은 유지됩니다."
echo "데이터까지 삭제하려면: docker compose down -v"
