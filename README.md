# Hash Storage — Content-Addressable File Management System

## 1. 핵심 아이디어 및 용어 (Core Concepts)

**CAS (Content-Addressable Storage)**
파일의 '경로'가 아닌 '내용(SHA-256 Hash)'을 주소로 저장. 시스템 전체에서 동일한 파일은 단 하나만 존재하며, 나머지는 같은 Hash ID를 가리키는 참조(Reference)로 처리됨 (중복 제거).

**DAG-Tree Indexing**
폴더 구조를 PostgreSQL 내에서 부모-자식 노드로 연결. 중복 파일은 여러 fs_node가 하나의 hash_id를 가리키는 형태로 구현됨. B-Tree 인덱스를 통해 O(log n) 탐색 보장.

**Virtual File System (VFS)**
사용자는 익숙한 트리 구조(탐색기)를 보지만, 백엔드에서는 DB 쿼리를 통해 파일 메타데이터를 즉시 반환. 실제 바이너리는 S3에 존재하며 DB에는 메타데이터만 존재.

**Reference Counting GC**
파일 삭제 시 ref_count를 감소시키고, 0이 되면 S3 오브젝트와 DB 레코드를 함께 삭제. 폴더 삭제 시 하위 트리를 재귀적으로 순회하여 ref_count를 일괄 처리.

**S3-backed Storage**
실제 바이너리 데이터는 AWS S3(혹은 로컬의 MinIO)에 Hash값을 Key로 저장. 무한한 확장성과 내구성 확보.

---

## 2. 기술 스택 (Tech Stack)

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| 클라이언트 해시 | crypto-js (SHA-256, 업로드 전 계산) |
| API 통신 | Axios + TanStack React Query |
| Backend | Python 3.12 + Flask 3 + Gunicorn |
| ORM / DB | SQLAlchemy 2.0 + PostgreSQL (Alpine) |
| 오브젝트 스토리지 | AWS S3 (prod) / MinIO (dev) — Boto3 |
| 인프라 | Docker Compose + Nginx (리버스 프록시 + HTTPS) |

---

## 3. 데이터 모델

### `file_blobs` — CAS 레이어
| 컬럼 | 설명 |
|------|------|
| `hash_id` (PK) | SHA-256 해시, 실제 파일 내용의 주소 |
| `size_bytes` | 파일 크기 |
| `mime_type` | MIME 타입 |
| `s3_key` | S3/MinIO 내 오브젝트 경로 |
| `ref_count` | 참조 카운터 (0 도달 시 GC 대상) |

### `fs_nodes` — VFS 레이어
| 컬럼 | 설명 |
|------|------|
| `node_id` (UUID, PK) | 노드 고유 ID |
| `parent_id` (FK) | 부모 노드 (self-reference, 폴더 계층) |
| `node_type` | `'file'` 또는 `'folder'` |
| `name` | 파일 또는 폴더 이름 |
| `hash_id` (FK) | file_blobs 참조 (file 타입만) |

---

## 4. API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/files/upload` | 파일 업로드 (해시 체크 후 dedup 또는 신규 저장) |
| `GET` | `/nodes` | 루트 또는 특정 폴더의 자식 노드 목록 |
| `GET` | `/nodes/<id>/download` | S3에서 파일 다운로드 |
| `DELETE` | `/nodes/<id>` | 노드 삭제 (ref_count 감소, GC 트리거) |
| `POST` | `/folders` | 새 폴더 생성 |
| `GET` | `/health` | 헬스 체크 |

---

## 5. 로컬 개발 환경 (Local Development)

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

## 6. AWS 프로덕션 배포 (Deployment)

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
- [ ] AWS EC2 + RDS(PostgreSQL) + S3 프로덕션 배포
- [ ] Nginx HTTPS 설정 (Let's Encrypt)
- [ ] GitHub Actions CI/CD 파이프라인 구성
- [ ] 모니터링: CloudWatch 또는 Grafana + Prometheus

### Phase 2 — 사용자 공간 분리 & OAuth (2~3주)
- [ ] Google / GitHub OAuth 2.0 로그인 (Authlib)
- [ ] JWT 기반 세션 관리
- [ ] `fs_nodes`에 `owner_id` 컬럼 추가, 모든 쿼리에 user scope 적용
- [ ] 사용자별 스토리지 쿼터 관리
- [ ] 관리자 대시보드 (유저 목록, 스토리지 사용량)

> **설계 주의점**: `file_blobs`는 전역 dedup 레이어로 유지하되, `fs_nodes`는 사용자별로 완전히 분리. 동일 파일을 다른 유저가 올려도 S3에는 하나만 존재하면서 접근 권한은 분리됨.

### Phase 3 — E2EE 공유 (3~5주)
- [ ] 공유 링크 생성 (만료 시간, 비밀번호 옵션)
- [ ] Web Crypto API (AES-GCM) 기반 클라이언트사이드 암호화
- [ ] 암호화 키를 URL fragment(`#key=...`)에 포함 — 서버는 키를 알 수 없음
- [ ] 수신자는 링크만으로 브라우저에서 복호화 후 다운로드

> **설계 트레이드오프**: E2EE 파일은 암호화 후 해시가 달라지므로 **dedup이 깨짐**. 공유 전용 암호화 사본을 별도로 관리하는 방식으로 해결 예정. 개인 공간은 dedup 유지, 공유 파일만 암호화 사본 생성.

### Phase 4 — 온라인 뷰 & 공동 작업 (4~8주)
- [ ] 온라인 미리보기: PDF.js (PDF), 이미지, 텍스트, 코드 하이라이팅
- [ ] Office 파일 뷰어: LibreOffice 변환 또는 Microsoft Office Web Viewer 연동
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
