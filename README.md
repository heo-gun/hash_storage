# castor — Content-Addressable File Management System

파일을 경로가 아니라 내용의 SHA-256 해시로 식별하는 스토리지. 같은 내용은 저장소에
한 벌만 존재하고, 경로는 그 한 벌을 가리키는 참조가 된다. PDF·이미지는 만료·열람
횟수·수신자 제한이 붙은 링크로 공유할 수 있다.

운영 중: https://castorfs.org

## 1. Core Concepts

**CAS (Content-Addressable Storage)**
업로드 전 브라우저에서 SHA-256을 계산해 그 값을 주소로 쓴다. 이미 있는 해시면 새로
저장하지 않고 참조만 추가한다.

**VFS + DAG Indexing**
사용자에게는 폴더 트리로 보이지만 실체는 `fs_nodes` 행이다. 중복 파일은 여러
`fs_node`가 하나의 `hash_id`를 가리키는 형태라, 한 노드가 여러 부모를 갖는 그래프가
된다 (`/app`의 Graph 탭에서 그대로 볼 수 있다).

**Reference Counting GC**
삭제 시 `ref_count`를 감소시키고 0이 되면 S3 오브젝트와 DB 레코드를 함께 삭제한다.
폴더 삭제는 하위 트리를 순회해 일괄 처리한다.

**`.epf` 보호 공유**
PDF·이미지에 한해 콘텐츠 키로 감싼 스트림을 브라우저에서 복호화해 Canvas로 렌더한다.
암호문은 저장하지 않고 요청 시점에 만든다. 한계는 [docs/DEPLOY.md](docs/DEPLOY.md)의
위협 모델 참고.

## 2. Tech Stack

| Field | Tech |
|------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| 클라이언트 해시 | Web Crypto API (`crypto.subtle`, 업로드 전 계산) |
| 그래프 뷰 | d3-force |
| 보호 뷰어 | PDF.js (Canvas 전용, textLayer 없음) |
| API 통신 | Axios |
| Backend | Python 3.12 + Flask 3 + Gunicorn |
| DB 접근 | psycopg 3 (raw SQL) + PostgreSQL 17 |
| 인증 | AWS Cognito (Google / ID·PW), JWT 검증은 PyJWT + JWKS |
| 오브젝트 스토리지 | AWS S3 (prod) / MinIO (dev) — Boto3 |
| 인프라 | Docker Compose + Nginx (리버스 프록시 + HTTPS) |

## 3. Data Model

### `file_blobs` — CAS Layer
| Column | Explanation |
|------|------|
| `hash_id` (PK) | SHA-256 해시. 파일 내용의 주소 |
| `size_bytes` | 파일 크기 |
| `mime_type` | MIME 타입 |
| `s3_key` | S3/MinIO 오브젝트 키 (= hash_id) |
| `ref_count` | 참조 카운터 (0 도달 시 GC) |

### `fs_nodes` — VFS Layer
| Column | Explanation |
|------|------|
| `node_id` (UUID, PK) | 노드 고유 ID |
| `owner_id` (FK) | 소유자. 모든 조회에 스코프로 적용 |
| `parent_id` (FK) | 부모 노드 (self-reference) |
| `node_type` | `'file'` 또는 `'folder'` |
| `name` | 이름 |
| `hash_id` (FK) | `file_blobs` 참조 (file 타입만) |
| `visibility` | `private` / `public` / `shared` |

### 공유 레이어
| Table | Explanation |
|------|------|
| `access_grants` | 공유 1건 = 수신자 1명. `share_token`(256비트), 만료·열람/인쇄 한도와 카운터, `grantee_email`, `revoked_at` |
| `content_keys` | grant별 CEK를 마스터키로 감싼 값 (`wrapped_cek`) |
| `audit_logs` | 열람·인쇄·다운로드·거부 이력 |

`file_blobs`는 전역 dedup 레이어로 두고 `fs_nodes`만 사용자별로 분리한다. 다른 유저가
같은 파일을 올려도 S3에는 하나만 존재하지만 접근 권한은 완전히 갈린다.

## 4. API

인증이 필요한 엔드포인트는 `Authorization: Bearer <id_token>`을 받는다.

| Method | Endpoint | 인증 | 설명 |
|--------|----------|------|------|
| `GET` | `/health` | — | 헬스 체크 |
| `GET` | `/auth/me` | 필요 | 내 프로필·쿼터 |
| `DELETE` | `/auth/me` | 필요 | 계정 하드 삭제 |
| `POST` | `/files/upload` | 필요 | 업로드 (해시 일치 시 dedup) |
| `GET` | `/nodes` | 필요 | 특정 폴더의 자식 목록 |
| `GET` | `/nodes/tree` | 필요 | 전체 트리 한 번에 (그래프 뷰용) |
| `GET` | `/nodes/<id>/download` | 필요 | 다운로드 |
| `PATCH` | `/nodes/<id>/visibility` | 필요 | 공개 범위 변경 (shared 이탈 시 grant 일괄 취소) |
| `DELETE` | `/nodes/<id>` | 필요 | 삭제 (ref_count 감소, GC 트리거) |
| `POST` | `/folders` | 필요 | 폴더 생성 |
| `POST` | `/folders/ensure-path` | 필요 | 경로 배열 → 폴더 생성 (멱등) |
| `GET` | `/search?q=` | — | 공개 파일 검색 |
| `GET` | `/public/nodes/<id>/download` | — | 공개 파일 다운로드 |
| `POST` | `/shares` | 필요 | 보호 공유 생성 (PDF/IMG, `visibility=shared` 필수) |
| `GET` | `/shares` | 필요 | 내 공유 목록 |
| `DELETE` | `/shares/<grant_id>` | 필요 | 공유 취소 |
| `GET` | `/shares/<grant_id>/audit` | 필요 | 열람·인쇄 이력 |
| `GET` | `/access/policy?token=` | 조건부 | 정책 + CEK (열람 1회 차감) |
| `GET` | `/access/content?token=` | 조건부 | `.epf` 스트리밍 |
| `POST` | `/access/print` | 조건부 | 인쇄 1회 차감 |
| `GET` | `/access/download?token=` | 조건부 | 원본 (`allow_download` 시) |

`/access/*`의 자격 증명은 256비트 `share_token`이다. 수신자 이메일을 지정하지 않은
공유는 링크만으로 열리고, 지정한 공유는 그 이메일로 로그인해야 열린다.

## 5. Local Development

로컬은 MinIO로 S3를 대신한다.

```bash
./scripts/dev-up.sh                       # postgres + minio + flask
npm --prefix frontend run dev             # 5173
cd backend && python -m pytest            # 정책 판정 테스트
./scripts/dev-down.sh
```

**확인해볼 것**
- 중복 업로드: 같은 파일을 다른 경로에 올려 S3 저장 없이 노드만 느는지
- 파일 삭제: `ref_count`가 0이 될 때만 S3 오브젝트가 지워지는지
- 공유 링크: 수신자를 지정한 링크가 다른 계정에서 거부되는지

## 6. Deployment

AWS EC2 단일 인스턴스 + RDS + S3 + Cognito. IAM Role로 S3에 접근하므로 액세스 키를
두지 않는다. 절차·마이그레이션·인증서 갱신·위협 모델은 [docs/DEPLOY.md](docs/DEPLOY.md).

## 7. Roadmap

### Phase 1 — 배포
- [x] EC2 + RDS PostgreSQL + S3 프로덕션 배포
- [x] Nginx HTTPS (Let's Encrypt)
- [ ] GitHub Actions CI/CD
- [ ] 모니터링 (인증서 만료 알림 포함)

### Phase 2 — 사용자 분리 & 인증
- [x] Cognito 로그인 (Google / ID·PW), JWT 세션
- [x] `owner_id` 스코프, 사용자별 쿼터
- [ ] 관리자 대시보드
- [ ] `/settings` 페이지

### Phase 2.5 — 업로드 편의성 & 공개 범위
- [x] 다중 파일 / 폴더 업로드 (동시 4개)
- [x] `visibility` (`private` / `public` / `shared`)
- [x] 공개 파일 검색 (비로그인 접근 가능)

> 폴더 업로드에서 폴더 생성을 업로드 워커와 병렬로 돌리면 경로 prefix를 공유하는
> 요청끼리 같은 폴더를 동시에 INSERT 하다 유니크 제약에 걸린다. 그래서 폴더 생성은
> 업로드 전 순차 prepass로 분리했다.

### Phase 3 — `.epf` 보호 공유
적용 범위는 사용자가 명시적으로 선택한 **PDF / 이미지**뿐이다. 다른 포맷은 일반 파일로
다루고, 외부 변환 API는 쓰지 않는다.

```
[Magic "EPF1"][HdrLen][JSON Header: alg, iv, key_id, policy_url, meta][GCM Tag][AES-256-GCM Payload]
```

- [x] `.epf` 인코더/디코더 (Python / TypeScript)
- [x] `access_grants` · `content_keys` · `audit_logs`
- [x] 정책 검증 + CEK 발급, 인쇄 카운트 API
- [x] 보호 뷰어 — Canvas 렌더, 워터마크 오버레이, 만료·한도 즉시 차단
- [x] 수신자 이메일 지정 시 Cognito 이메일 일치 요구
- [ ] `EPF_MASTER_KEY`를 AWS KMS로 이관

> 접근 주체는 **링크 토큰**이다. 수신자가 castor 계정 없이도 열람할 수 있어야 해서
> `grantee_user_id` FK 대신 256비트 `share_token`을 자격 증명으로 쓴다. 이메일을
> 지정하면 그때만 신원 확인이 추가된다.
>
> **`.epf`는 저장하지 않는다.** S3에는 평문 원본만 두고 요청 시점에 감싸므로 유출될
> 수 있는 영구 암호문 사본이 생기지 않는다.

### Phase 4 — 온라인 뷰 & 공동 작업
- [ ] 일반 미리보기 (PDF, 이미지, 텍스트, 코드)
- [ ] 텍스트/마크다운 인라인 편집
- [ ] 실시간 공동 편집 (Yjs + WebSocket)
- [ ] 버전 히스토리 (S3 Versioning)

### Phase 5 — 하위 도메인 & 멀티테넌시
- [ ] Nginx wildcard 인증서
- [ ] 사용자/팀별 하위 도메인 + 자동 프로비저닝
- [ ] 테넌트 격리 미들웨어

### 검토했으나 보류
- **rename/move API** — 현재 이름 변경 수단이 없다. 삭제 후 재업로드는 `node_id`가
  바뀌어 그 파일의 공유 grant가 CASCADE로 사라지므로 `PATCH /nodes/<id>`가 필요하다.
- **2단계 업로드** — 지금은 dedup이 확실한 경우에도 본문을 전송한다. 해시를 먼저
  조회하고 miss일 때만 올리면 전송량을 아낄 수 있다.
- **Obsidian 플러그인** — 로컬 편집 후 commit으로 업로드. 위 두 가지가 선행돼야 한다.

## 8. 프로젝트 구조

```
hash_storage/
├── backend/
│   ├── app/
│   │   ├── auth/          # Cognito 검증, require_auth
│   │   ├── routes/        # upload, nodes, folders, search, shares, access, auth, admin
│   │   ├── services/      # node, share, epf, user
│   │   └── config.py · db.py · storage.py · blob_deletion.py
│   ├── tests/             # 공유 정책 판정 (DB 없이 실행)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── auth/          # Cognito SDK, OAuth, 토큰 저장
│   │   ├── components/    # file-manager, graph, landing, viewer
│   │   ├── epf/           # .epf 디코더
│   │   ├── hooks/ · services/ · types/ · utils/
│   │   └── pages/
│   ├── nginx.conf         # .mjs MIME (PDF.js worker)
│   ├── Dockerfile
│   └── package.json
├── infra/
│   ├── postgres/init/     # 001~007 스키마
│   ├── minio/
│   └── nginx/
├── scripts/               # dev-up.sh · dev-down.sh
├── docs/DEPLOY.md
├── docker-compose.yml · docker-compose.prod.yml
└── .env.example
```
