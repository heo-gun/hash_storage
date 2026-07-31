# 배포 가이드 — Phase 2.5 + Phase 3

Phase 2(Cognito 인증 + RDS)까지 배포된 상태에서 이어서 적용하는 절차입니다.
순서대로 진행하세요. **마이그레이션 → 환경변수 → 재빌드** 순서를 지켜야 합니다.

---

## 0. 사전 확인

```bash
cd ~/hash_storage          # 프로젝트 경로
git pull origin main
```

### ⚠️ compose 파일 충돌이 날 수 있습니다

RDS 이전 당시 서버에서 `docker-compose.prod.yml` 을 직접 수정하셨다면, 이번
커밋이 같은 부분(`postgres` 서비스 제거, `POSTGRES_HOST` 변수화)을 건드리므로
`git pull` 이 충돌하거나 로컬 수정이 막힙니다.

저장소 버전이 이제 RDS 기준으로 맞춰져 있으므로, 로컬 수정본을 버리고 저장소
버전을 쓰면 됩니다:

```bash
# 현재 로컬 수정본을 혹시 모르니 백업
cp docker-compose.prod.yml ~/compose.prod.bak

git checkout -- docker-compose.prod.yml
git pull origin main

# 백업과 비교해서 서버에만 있던 커스터마이징이 없는지 확인
diff ~/compose.prod.bak docker-compose.prod.yml
```

`diff` 결과가 postgres 제거/EPF 변수 추가뿐이라면 그대로 진행하세요.

---

## 1. DB 마이그레이션 (RDS)

compose 에서 postgres 컨테이너를 걷어냈으므로 `infra/postgres/init/*.sql` 은
**자동 실행되지 않습니다.** `psql` 로 직접 적용해야 합니다.

```bash
# .env 값을 셸로 불러오기
set -a; source .env; set +a

# 적용 전 현재 상태 확인
psql -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "\d fs_nodes"
```

### 1-1. Phase 2.5 — visibility

```bash
psql -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 -f infra/postgres/init/006_visibility.sql
```

`CREATE EXTENSION pg_trgm` 에서 권한 오류가 나면, RDS 마스터 유저로 접속했는지
확인하세요. 마스터 유저로도 안 되면 trgm 인덱스 두 줄만 빼고 실행해도 됩니다
(공개 파일 수가 적을 때는 성능 차이가 없습니다).

### 1-2. Phase 3 — 공유 스키마

```bash
psql -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 -f infra/postgres/init/007_sharing.sql
```

### 1-3. 적용 확인

```bash
psql -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
-- visibility 컬럼과 제약
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'fs_nodes' AND column_name = 'visibility';

-- 새 테이블 3개
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('access_grants', 'content_keys', 'audit_logs')
ORDER BY table_name;

-- 인덱스
SELECT indexname FROM pg_indexes
WHERE tablename IN ('fs_nodes', 'access_grants', 'content_keys', 'audit_logs')
ORDER BY indexname;
SQL
```

`fs_nodes.visibility` 1행, 테이블 3행이 나오면 성공입니다.
두 스크립트 모두 `IF NOT EXISTS` 기반이라 재실행해도 안전합니다.

---

## 2. 환경변수 추가

### 2-1. `.epf` 마스터키 생성

**이 키를 잃어버리면 발급된 모든 공유 링크를 영구히 열 수 없습니다.**
CEK 가 이 키로 감싸져 DB 에 저장되기 때문입니다. 생성 즉시 안전한 곳에
백업하세요.

```bash
openssl rand -base64 32
```

출력값(끝의 `=` 포함)을 `.env` 에 넣습니다:

```bash
cat >> .env <<'EOF'

# ── .epf 보호 공유 (Phase 3) ────────────────────────────────
EPF_MASTER_KEY=<위에서 생성한 base64 값>
EOF
```

### 2-2. 길이 검증

32바이트가 아니면 공유 API 가 503 을 냅니다. 미리 확인하세요:

```bash
set -a; source .env; set +a
echo -n "$EPF_MASTER_KEY" | base64 -d | wc -c    # 반드시 32
```

`DOMAIN` 은 이미 `.env` 에 있으므로 `PUBLIC_BASE_URL` 은 compose 가
`https://${DOMAIN}` 으로 자동 구성합니다. 따로 넣지 않아도 됩니다.

---

## 3. 재빌드 & 배포

백엔드는 새 의존성이 없지만(`cryptography` 는 기존 `PyJWT[crypto]` 로 이미
설치됨), 프론트엔드는 `pdfjs-dist` 가 새로 추가되어 **반드시 재빌드**해야 합니다.

```bash
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d
```

### 3-1. nginx 재시작 (중요)

backend/frontend 컨테이너가 새로 뜨면 IP 가 바뀌는데, nginx 는 시작 시점의 IP 를
캐시합니다. 전에 502 를 겪으셨던 원인이 이것입니다. 반드시 함께 재시작하세요:

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

> **장기 수정 (권장, 아직 미적용)**
> `infra/nginx/prod.conf` 에 아래를 넣으면 매번 재시작할 필요가 없어집니다.
> ```nginx
> resolver 127.0.0.11 valid=10s;
> set $backend_upstream http://backend:5000;
> proxy_pass $backend_upstream;
> ```
> `proxy_pass` 에 변수를 쓰면 nginx 가 요청마다 DNS 를 다시 조회합니다.

### 3-2. 상태 확인

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 backend
```

---

## 4. 동작 검증

### 4-1. 스모크 테스트 (인증 불필요)

```bash
curl -s https://$DOMAIN/api/health
curl -s "https://$DOMAIN/api/search?q=" | head -c 300
```

`/api/search` 가 `{"query":"","total":0,...}` 형태로 오면 Phase 2.5 백엔드 정상입니다.

### 4-2. Phase 2.5 — 브라우저

1. `/app` 로그인 → **Choose folder** 로 하위 폴더가 있는 디렉터리 선택
   → 큐에 상대 경로(`docs/img/a.png`)가 그대로 표시되는지 확인
2. **Upload** → 폴더 구조가 그대로 재현되었는지 확인
3. 파일 행의 **Access** 배지 클릭 → `Private → Public` 전환
4. 로그아웃 상태(시크릿 창)로 `/search` 접속 → 방금 public 으로 바꾼 파일이
   검색되고 다운로드되는지 확인
5. private 파일은 검색에 **나오지 않아야** 합니다

### 4-3. Phase 3 — 보호 공유

1. `/app` 에서 **PDF 또는 이미지** 파일 행의 **Share** 버튼 클릭
   (다른 형식에는 버튼이 나타나지 않습니다)
2. 수신자 이메일/만료/열람 횟수 입력 → **공유 링크 만들기**
3. 링크 복사 → **시크릿 창**(비로그인)에서 열기
4. 확인 사항:
   - 문서가 렌더링되고 **워터마크가 대각선으로 깔려 있는지**
   - 우클릭이 막히는지
   - 헤더에 남은 열람 횟수가 표시되는지
   - 열람 횟수를 초과해 새로고침하면 "열람 가능 횟수를 모두 사용했습니다"가 뜨는지
5. 소유자 계정에서 감사 로그 확인:
   ```bash
   curl -s -H "Authorization: Bearer <id_token>" \
     "https://$DOMAIN/api/shares" | jq
   ```

### 4-4. 마스터키 미설정 시 동작

`EPF_MASTER_KEY` 를 빼먹으면 `POST /api/shares` 가 **503** 과 함께
`EPF_MASTER_KEY 가 설정되지 않았습니다` 를 반환합니다. 조용히 취약한 기본키로
동작하지 않도록 일부러 이렇게 만들었습니다.

---

## 5. 롤백

스키마 변경은 모두 **추가적(additive)** 이라 이전 버전 코드와 공존합니다.
문제가 생기면 컨테이너만 되돌리면 됩니다:

```bash
git checkout <이전-커밋>
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml restart nginx
```

DB 를 되돌릴 필요는 없습니다. 굳이 컬럼/테이블을 걷어내려면:

```sql
-- 주의: 발급된 공유 링크가 모두 사라집니다
DROP TABLE IF EXISTS audit_logs, content_keys, access_grants;
ALTER TABLE fs_nodes DROP COLUMN IF EXISTS visibility;
```

---

## 6. 새로 추가된 API

| Method | Endpoint | 인증 | 설명 |
|--------|----------|------|------|
| `POST` | `/folders/ensure-path` | 필요 | 경로 배열 → 폴더 생성(멱등) |
| `PATCH` | `/nodes/<id>/visibility` | 필요 | 공개 범위 변경 |
| `GET` | `/search?q=` | **불필요** | 공개 파일 검색 |
| `GET` | `/public/nodes/<id>/download` | **불필요** | 공개 파일 다운로드 |
| `POST` | `/shares` | 필요 | 보호 공유 생성 (PDF/IMG 만) |
| `GET` | `/shares` | 필요 | 내 공유 목록 |
| `DELETE` | `/shares/<grant_id>` | 필요 | 공유 취소 |
| `GET` | `/shares/<grant_id>/audit` | 필요 | 열람/인쇄 이력 |
| `GET` | `/access/policy?token=` | **불필요** | 정책 + CEK (열람 1회 차감) |
| `GET` | `/access/content?token=` | **불필요** | `.epf` 스트리밍 |
| `POST` | `/access/print` | **불필요** | 인쇄 1회 차감 |
| `GET` | `/access/download?token=` | **불필요** | 원본 (allow_download 시) |

`/access/*` 는 비회원 수신자를 위해 인증을 걸지 않습니다. 접근 자격 증명은
추측 불가능한 256비트 `share_token` 그 자체입니다.

---

## 7. 위협 모델 — 무엇을 막고 무엇을 못 막는가

보호 공유가 실제로 보장하는 것과 아닌 것을 분명히 해둡니다.

**막습니다**
- 정책(만료/횟수/취소) 검증을 거치지 않은 콘텐츠 접근
- 링크 열거 — 토큰이 256비트라 무차별 대입이 불가능
- 브라우저 캐시·프록시에 평문 원본이 남는 것 (`Cache-Control: no-store`,
  전송 구간은 `.epf` 암호문)
- 영구 암호문 사본 유출 — `.epf` 를 S3 에 저장하지 않고 요청 시점에 생성
- 텍스트 긁어가기 — PDF.js textLayer 를 만들지 않아 복사할 DOM 텍스트가 없음
- 동시 요청으로 열람 한도 우회 — 정책 검사와 카운트 증가가 같은 트랜잭션에서
  행 잠금(`FOR UPDATE`) 하에 일어남

**못 막습니다 (설계상 수용)**
- 화면 캡처, 사진 촬영
- 개발자 도구로 CEK 를 꺼내 원본을 복원하는 것 — 뷰어가 복호화해야 하므로
  수신자는 원리적으로 키에 접근할 수 있습니다
- 우클릭/복사 차단은 **억지책**이지 보안 경계가 아닙니다

그래서 실질적 방어선은 **워터마크 기반 책임 추적**입니다. 수신자 식별자와 열람
시각이 지면 전체에 새겨지므로, 유출된 사본에서 출처를 되짚을 수 있습니다.

---

## 8. 남은 작업

- [ ] nginx `resolver` 적용 (§3-1) — 배포마다 nginx 재시작하는 번거로움 제거
- [ ] `EPF_MASTER_KEY` 를 AWS KMS 로 이관 — 현재는 `.env` 평문
- [ ] 관리자 대시보드 (Phase 2 잔여)
- [ ] GitHub Actions CI/CD (Phase 1 잔여)
- [ ] `/settings` 페이지
