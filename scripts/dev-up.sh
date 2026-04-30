#!/bin/bash
# 로컬 개발 환경 시작
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

# .env 없으면 example 복사
if [ ! -f .env ]; then
  echo "[dev-up] .env 파일이 없습니다. .env.example 에서 복사합니다."
  cp .env.example .env
fi

echo "[dev-up] 컨테이너 시작 중..."
docker compose up -d --build

echo ""
echo "[dev-up] 완료!"
echo "  Frontend : http://localhost:5173"
echo "  Backend  : http://localhost:5000"
echo "  MinIO UI : http://localhost:9001  (minioadmin / minioadmin)"
echo "  PostgreSQL: localhost:5432"
echo ""
echo "로그 확인: docker compose logs -f"
