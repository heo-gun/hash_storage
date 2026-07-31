# Hash Storage — Content-Addressable File Management System

## 1. Core Concepts

**CAS (Content-Addressable Storage)**
파일의 '경로'가 아닌 '내용(SHA-256 Hash)'을 주소로 저장. 시스템 전체에서 동일한 파일은 단 하나만 존재하며, 나머지는 같은 Hash ID를 가리키는 참조(Reference)로 처리됨 (중복 제거 : deduplication).

**DAG-Tree Indexing**
폴더 구조를 PostgreSQL 내에서 노드로 연결. 중복 파일은 여러 fs_node가 하나의 hash_id를 가리키는 형태로 구현됨. B-Tree 인덱스를 통해 O(log n) 탐색 보장.

**Virtual File System (VFS)**
사용자는 익숙한 파일 구조(탐색기)를 보지만, 백엔드에서는 DB 쿼리를 통해 파일 메타데이터를 즉시 반환. 실제 바이너리는 S3에 존재하며 DB에는 메타데이터만 존재.

**Reference Counting GC**
파일 삭제 시 ref_count를 감소시키고, 0이 되면 S3 오브젝트와 DB 레코드를 함께 삭제. 폴더 삭제 시 하위 트리를 재귀적으로 순회하여 ref_count를 일괄 처리.

**S3-backed Storage**
실제 바이너리 데이터는 AWS S3(로컬 : MinIO)에 Hash값을 Key로 저장. 무한한 확장성과 내구성 확보.

---

## 2. Tech Stack

| Field | Tech |
|------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| 클라이언트 해시 | crypto-js (SHA-256, 업로드 전 계산) |
| API 통신 | Axios + TanStack React Query |
| Backend | Python 3.12 + Flask 3 + Gunicorn |
| ORM / DB | SQLAlchemy 2.0 + PostgreSQL (Alpine) |
| 오브젝트 스토리지 | AWS S3 (prod) / MinIO (dev) — Boto3 |
| 인프라 | Docker Compose + Nginx (리버스 프록시 + HTTPS) |

---

## 3. Data Model

### `file_blobs` — CAS Layer
| Column | Explanation |
|------|------|
| `hash_id` (PK) | SHA-256 해시, 실제 파일 내용의 주소 |
| `size_bytes` | 파일 크기 |
| `mime_type` | MIME 타입 |
| `s3_key` | S3/MinIO 내 오브젝트 경로 |
| `ref_count` | 참조 카운터 (0 도달 시 GC 대상) |

### `fs_nodes` — VFS Layer
| Column | Explanation |
|------|------|
| `node_id` (UUID, PK) | 노드 고유 ID |
| `parent_id` (FK) | 부모 노드 (self-reference, 폴더 계층) |
| `node_type` | `'file'` 또는 `'folder'` |
| `name` | 파일 또는 폴더 이름 |
| `hash_id` (FK) | file_blobs 참조 (file 타입만) |

---

## 4. API Endpoint

| Method | Endpoint | Explanation |
|--------|----------|------|
| `POST` | `/files/upload` | 파일 업로드 (해시 체크 후 dedup 또는 신규 저장) |
| `GET` | `/nodes` | 루트 또는 특정 폴더의 자식 노드 목록 |
| `GET` | `/nodes/<id>/download` | S3에서 파일 다운로드 |
| `DELETE` | `/nodes/<id>` | 노드 삭제 (ref_count 감소, GC 트리거) |
| `POST` | `/folders` | 새 폴더 생성 |
| `GET` | `/health` | 헬스 체크 |

---

## 5. Local Development

로컬에서는 MinIO(S3 호환)를 사용하여 AWS 비용 없이 동일한 환경 구축 가능.

```bash
# 컨테이너 시작 (postgres + minio + flask-app)
./scripts/dev-up.sh

# 가상 데이터 시딩 (10만 건 이상 트리 테스트용)
python scripts/seed_fake_nodes.py

# 트리 탐색 성능 벤치마크
python scripts/benchmark_tree.py

# 컨테이너 종료
./scripts/dev-down.sh
```

**테스트 시나리오:**
- **중복 업로드**: 동일 파일을 다른 경로에 업로드 → S3 추가 저장 없이 DB 노드만 증가하는지 확인
- **대용량 조회**: 10만 건 이상 가상 데이터로 B-Tree 인덱스 탐색 속도 측정
- **파일 삭제**: ref_count 방식으로 논리 경로만 삭제, ref_count=0 시 S3 물리 삭제 확인

---

## 6. AWS Production Deployment

### Step 1: S3 & IAM 설정
- S3 버킷 생성 + 퍼블릭 액세스 차단
- EC2가 S3에 접근할 수 있도록 IAM Role 생성 후 인스턴스에 연결 (액세스 키 불필요)

### Step 2: EC2 서버 구성
- Docker + Docker Compose 설치
- PostgreSQL 데이터 볼륨을 호스트 디렉토리에 마운트 (컨테이너 재시작 후에도 데이터 유지)

### Step 3: 환경 변수 관리
- `.env.example`을 복사하여 `.env` 작성
- `boto3.client('s3')` 호출 시 IAM Role로 자동 인증 (별도 키 불필요)

### Step 4: 도메인 & 리버스 프록시
- Nginx 컨테이너로 HTTPS(Let's Encrypt / Certbot) 적용
- 사용자 요청 → Nginx → Gunicorn(Flask) 포워딩

---

## 7. 확장 로드맵 (Roadmap)

MVP 이후 아래 단계로 서비스를 확장할 계획입니다.

### Phase 1 — 배포 (1~2주)
- [x] AWS EC2 + RDS PostgreSQL or(DOCKER) + S3 프로덕션 배포
- [x] Nginx HTTPS 설정 (Let's Encrypt)
- [ ] GitHub Actions CI/CD 파이프라인 구성
- [ ] 모니터링: CloudWatch 또는 Grafana + Prometheus

### Phase 2 — 사용자 공간 분리 & OAuth (2~3주)
- [x] Google / GitHub OAuth 2.0 로그인 (Authlib)
- [x] JWT 기반 세션 관리
- [x] `fs_nodes`에 `owner_id` 컬럼 추가, 모든 쿼리에 user scope 적용
- [x] 사용자별 스토리지 쿼터 관리
- [ ] 관리자 대시보드 (유저 목록, 스토리지 사용량)

> **설계 주의점**: `file_blobs`는 전역 dedup 레이어로 유지하되, `fs_nodes`는 사용자별로 완전히 분리. 동일 파일을 다른 유저가 올려도 S3에는 하나만 존재하면서 접근 권한은 분리됨.

### Phase 2.5 — 업로드 편의성 & 공개 범위
- [x] 다중 파일 / 폴더 업로드 (`webkitdirectory`, 동시 업로드 4개)
- [x] `fs_nodes.visibility` (`private` / `public` / `shared`) — 업로드 시 선택, 목록에서 변경
- [x] 공개 파일 검색 `GET /search` + `/search` 페이지 (비로그인 접근 가능)

> **동시성 주의점**: 폴더 업로드에서 폴더 생성을 업로드 워커와 병렬로 돌리면,
> 경로 prefix를 공유하는 요청끼리 같은 폴더를 동시에 INSERT 하다 유니크 제약에 걸린다.
> 그래서 폴더 생성은 업로드 시작 전 **순차 prepass**로 분리했다.

### Phase 3 — `.epf` 제한 공유 + 보호 뷰어 (4~6주, **Phase 2 선행 필수**)
경량 DRM 시스템. 

**적용 범위**: 사용자가 명시적으로 보호 공유를 선택한 **PDF / IMG 파일에 한해서만** `.epf` 래핑.
다른 포맷(DOCX/HWP/XLSX 등)은 일반 파일로만 다룸. 외부 변환 API(iLoveAPI 등) 도입하지 않음.

**필요 시 자체 처리**: Pillow(이미지), pypdf(PDF 메타/페이지 조작) 라이브러리로 대응. 워터마크 burn-in 등은 self-hosted 처리.

**`.epf` 포맷** — PDF 또는 IMG 바이트를 내부 페이로드로 래핑
```
[Magic "EPF1"][HdrLen][JSON Header: alg, iv, key_id, policy_url, meta { original_ext: "pdf"|"jpg"|... }][GCM Tag][AES-256-GCM Payload]
```

- [x] `.epf` 인코더/디코더 (서버측 Python, 클라이언트측 TypeScript)
- [x] DB 스키마 추가:
  - `access_grants` (node_id, share_token, grantee_email, expires_at, max_views/prints, view/print_count, allow_download, revoked_at)
  - `content_keys` (key_id, grant_id, wrapped_cek — 마스터키로 AES-256-GCM wrap)
  - `audit_logs` (grant_id, action, actor_label, ip_address, user_agent)
- [x] 정책 검증 API: `GET /api/access/policy?token=...` → 만료/카운트/취소 확인 → CEK 응답
- [x] 카운트 갱신 API: `POST /api/access/print` → 서버측 증가 (열람은 policy 호출 시 차감)
- [x] **웹 전용 보호 뷰어** (PDF.js 기반)
  - Canvas-only 렌더링 (텍스트 레이어 제거)
  - **Getty Images 스타일 가시적 워터마크** — 수신자 이메일/열람 시각을 페이지 전체에 대각선 오버레이
  - 우클릭/복사 차단 시도 (deterrent)
  - 만료/카운트 초과 시 즉시 차단
- [x] 공유 UI: "보호 공유" 모달 — 수신자, 만료, 열람/인쇄 횟수, 다운로드 허용 옵션
- [ ] `EPF_MASTER_KEY`를 AWS KMS로 이관 (현재는 env var)

> **결정 사항**:
> - 뷰어는 **웹 전용**. 네이티브는 보류.
> - 위협 모델: 화면 캡처/사진 촬영은 차단 불가능을 명시적으로 수용. **워터마크 기반 책임 추적**으로 대체.
> - **접근 주체는 링크 토큰**. 수신자가 castor 계정 없이도 열람할 수 있어야 하므로
>   `grantee_user_id` FK 대신 추측 불가능한 256비트 `share_token`을 자격 증명으로 쓴다.
>   `grantee_email`은 워터마크 표시용이며 인증 수단이 아니다.
> - **`.epf`는 저장하지 않는다**. S3에는 평문 원본만 두고 요청 시점에 감싸서 스트리밍하므로,
>   유출될 수 있는 영구 암호문 사본이 생기지 않는다.
> - 배포 절차와 상세 위협 모델은 [docs/DEPLOY.md](docs/DEPLOY.md) 참고.

### Phase 4 — 온라인 뷰 & 공동 작업 (4~8주)
- [ ] 온라인 미리보기: PDF.js, 이미지, 텍스트, 코드 하이라이팅
- [ ] 텍스트/마크다운 인라인 편집
- [ ] 실시간 공동 편집: Yjs (CRDT) + WebSocket (별도 collaboration 서버 필요)
- [ ] 문서별 히스토리 및 버전 관리 (S3 Versioning 활용)

### Phase 5 — 하위 도메인 & 멀티테넌시 (1주)
- [ ] Nginx wildcard 인증서 (`*.yourdomain.com`)
- [ ] 사용자별 또는 팀별 하위 도메인 (`alice.yourdomain.com`)
- [ ] Cloudflare DNS API를 통한 서브도메인 자동 프로비저닝
- [ ] 테넌트 격리 미들웨어 (요청 헤더/도메인 기반 user scope 주입)

---

## 8. 프로젝트 구조

```
hash_storage/
├── backend/
│   ├── app/
│   │   ├── models/        # file_blob, fs_node ORM 모델
│   │   ├── routes/        # upload, folders, nodes, health
│   │   ├── services/      # hash, node, refcount 비즈니스 로직
│   │   ├── repositories/  # DB 접근 레이어
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── storage.py     # S3 클라이언트
│   │   └── blob_deletion.py
│   ├── migrations/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/    # 탐색기 UI, 파일 매니저
│   │   ├── hooks/         # useFileManager, useUpload
│   │   ├── services/      # Axios API 클라이언트
│   │   ├── types/         # TypeScript 인터페이스
│   │   └── utils/         # 해시 계산, 에러 핸들링
│   ├── Dockerfile
│   └── package.json
├── infra/
│   ├── postgres/init/     # SQL 초기화 스크립트
│   ├── minio/
│   └── nginx/
├── scripts/
│   ├── dev-up.sh
│   ├── dev-down.sh
│   ├── seed_fake_nodes.py
│   └── benchmark_tree.py
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example
```
