# 운영 가이드

대상: EC2 단일 인스턴스 + RDS + S3 + Cognito 구성. 모든 명령은 서버의 `~/hash_storage`
에서 실행한다.

## 1. 일상 배포

```bash
git pull origin main
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml restart nginx
```

마지막 줄을 빼면 502가 난다. 컨테이너가 새로 뜨면 IP가 바뀌는데 nginx는 시작 시점의
IP를 캐시하기 때문이다. `infra/nginx/prod.conf`에 아래를 넣으면 요청마다 DNS를 다시
조회해서 재시작이 필요 없어진다(미적용):

```nginx
resolver 127.0.0.11 valid=10s;
set $backend_upstream http://backend:5000;
proxy_pass $backend_upstream;
```

상태 확인:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 backend
```

## 2. DB 마이그레이션

프로덕션 DB는 RDS라 `infra/postgres/init/*.sql`이 자동 실행되지 않는다. 새 스크립트가
추가된 배포에서만 `psql`로 직접 적용한다.

```bash
set -a; source .env; set +a

psql -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 -f infra/postgres/init/007_sharing.sql
```

모든 스크립트가 `IF NOT EXISTS` 기반이라 재실행해도 안전하다. `CREATE EXTENSION
pg_trgm`에서 권한 오류가 나면 RDS 마스터 유저로 접속했는지 확인한다.

적용 확인:

```bash
psql -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('access_grants', 'content_keys', 'audit_logs') ORDER BY table_name;
SQL
```

## 3. 환경변수

`.env.example`을 복사해 작성한다. 새 변수를 추가할 때는 호스트 `.env`뿐 아니라
`docker-compose.prod.yml`의 `environment:`에도 반드시 명시해야 컨테이너에 전달된다.

### `EPF_MASTER_KEY`

이 키를 잃으면 발급된 모든 공유 링크를 영구히 열 수 없다. CEK가 이 키로 감싸져 DB에
저장되기 때문이다. 생성 즉시 안전한 곳에 백업한다.

```bash
openssl rand -base64 32
```

32바이트가 아니면 공유 API가 503을 낸다:

```bash
set -a; source .env; set +a
echo -n "$EPF_MASTER_KEY" | base64 -d | wc -c    # 32
```

키를 아예 설정하지 않으면 `POST /api/shares`가 503과 함께 실패한다. 취약한 기본키로
조용히 동작하지 않도록 의도한 것이다.

`PUBLIC_BASE_URL`은 compose가 `https://${DOMAIN}`으로 구성하므로 따로 넣지 않는다.

## 4. TLS 인증서

Let's Encrypt + certbot. nginx가 `/.well-known/acme-challenge/`를 도커 볼륨
`hash_storage_certbot_webroot`에서 서빙하므로 **webroot 방식으로 갱신한다.**

### 갱신이 실패했을 때

증상은 HTTPS 다운 또는 브라우저 인증서 경고. 상태부터 확인한다:

```bash
sudo certbot certificates
sudo grep -iE "error|fail" /var/log/letsencrypt/letsencrypt.log | tail -20
```

`Could not bind TCP port 80`이 보이면 갱신 설정이 standalone으로 되어 있다는 뜻이다.
certbot이 80 포트를 직접 열려 하는데 nginx 컨테이너가 점유하고 있어 매번 실패한다.
아래 절차가 이것을 영구히 고친다.

**1) 챌린지 경로 왕복 확인**

```bash
sudo mkdir -p /var/lib/docker/volumes/hash_storage_certbot_webroot/_data/.well-known/acme-challenge
echo ok | sudo tee /var/lib/docker/volumes/hash_storage_certbot_webroot/_data/.well-known/acme-challenge/probe
curl -s http://castorfs.org/.well-known/acme-challenge/probe    # → ok
```

**2) webroot로 발급**

```bash
sudo certbot certonly --webroot \
  -w /var/lib/docker/volumes/hash_storage_certbot_webroot/_data \
  -d castorfs.org
```

`certonly`로 실행해야 `/etc/letsencrypt/renewal/castorfs.org.conf`의 `authenticator`가
`webroot`로 바뀌어 이후 자동 갱신이 성공한다.

**3) nginx 리로드 + 검증**

인증서 파일이 바뀌어도 nginx는 메모리에 들고 있으므로 리로드해야 반영된다.

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
sudo grep authenticator /etc/letsencrypt/renewal/castorfs.org.conf   # webroot
sudo certbot renew --dry-run
echo | openssl s_client -servername castorfs.org -connect castorfs.org:443 2>/dev/null \
  | openssl x509 -noout -dates
```

`--dry-run` 통과가 실제 확인이다. 갱신 후 리로드를 자동화하려면
`/etc/letsencrypt/renewal-hooks/deploy/`에 리로드 스크립트를 둔다.

> 1회 실패 시 재시도는 시간당 5회 제한이 있으므로, 반복 실패 전에 1)의 왕복 확인을
> 먼저 통과시킨다.

## 5. 배포 후 검증

```bash
curl -s https://$DOMAIN/api/health
curl -s "https://$DOMAIN/api/search?q=" | head -c 200
```

브라우저:

1. `/app` 로그인 → 폴더 업로드 → 큐에 상대 경로가 표시되고 구조가 재현되는지
2. Access 배지로 `Private → Public` 전환 → 시크릿 창 `/search`에서 검색되는지
   (private 파일은 나오지 않아야 한다)
3. Graph 탭 → 같은 파일을 두 경로에 올렸을 때 노드 하나에 부모가 둘로 그려지는지
4. PDF/이미지를 `Shared`로 바꾸면 Share 버튼이 나타나는지 (다른 상태에서는 숨겨진다)
5. 공유 링크를 시크릿 창에서 열어 워터마크·잔여 열람 횟수·한도 초과 차단 확인
6. 수신자 이메일을 지정한 링크는 비로그인 시 로그인 안내, 다른 계정에서는 거부되는지

## 6. 롤백

스키마 변경은 모두 추가적이라 이전 버전 코드와 공존한다. 컨테이너만 되돌리면 된다.

```bash
git checkout <이전-커밋>
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml restart nginx
```

DB를 되돌릴 필요는 없다. 굳이 걷어내려면 (발급된 공유 링크가 모두 사라진다):

```sql
DROP TABLE IF EXISTS audit_logs, content_keys, access_grants;
ALTER TABLE fs_nodes DROP COLUMN IF EXISTS visibility;
```

## 7. 위협 모델 — 보호 공유

**막는 것**
- 정책(만료/횟수/취소) 검증을 거치지 않은 콘텐츠 접근
- 링크 열거 — 토큰이 256비트라 무차별 대입 불가
- 브라우저 캐시·프록시에 남는 평문 (`Cache-Control: no-store`, 전송 구간은 암호문)
- 영구 암호문 사본 유출 — `.epf`를 저장하지 않고 요청 시점에 생성
- 텍스트 추출 — PDF.js textLayer를 만들지 않아 복사할 DOM 텍스트가 없음
- 동시 요청으로 열람 한도 우회 — 정책 검사와 카운트 증가가 같은 트랜잭션에서 행
  잠금(`FOR UPDATE`) 하에 일어남
- 수신자를 지정한 공유의 무단 열람 — 링크만으로는 열리지 않고 이메일 일치를 요구

**막지 못하는 것 (설계상 수용)**
- 화면 캡처, 사진 촬영
- 개발자 도구로 CEK를 꺼내 원본을 복원하는 것 — 뷰어가 복호화해야 하므로 수신자는
  원리적으로 키에 접근할 수 있다
- 우클릭·복사 차단은 억지책이지 보안 경계가 아니다

실질적 방어선은 워터마크 기반 책임 추적이다. 수신자 식별자와 열람 시각이 지면 전체에
새겨지므로 유출된 사본에서 출처를 되짚을 수 있다.

## 8. 남은 작업

- [ ] nginx `resolver` 적용 (§1) — 배포마다 nginx 재시작 제거
- [ ] `EPF_MASTER_KEY`를 AWS KMS로 이관 — 현재는 `.env` 평문
- [ ] 인증서 만료 모니터링 — 2026-08 만료를 5일간 인지하지 못했다
- [ ] GitHub Actions CI/CD
- [ ] 관리자 대시보드, `/settings`
