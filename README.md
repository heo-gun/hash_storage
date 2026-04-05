새로운 File Management Storage를 구상할거야. MVP Terms는 다음과 같아. 
1. MVP 핵심 아이디어 및 용어 요약 (MVP Terms)
CAS (Content-Addressable Storage): 파일의 '경로'가 아닌 '내용(Hash)'을 주소로 저장. 동일 파일은 시스템 전체에서 단 하나만 존재함 (중복 제거).

DAG-Tree Indexing: 파일 시스템의 폴더 구조를 PostgreSQL 내에서 부모-자식 노드로 연결. 중복 파일은 여러 노드가 하나의 Hash ID를 가리키는 형태로 구현.

Virtual File System (VFS): 사용자는 익숙한 트리 구조를 보지만, 백엔드에서는 DB 쿼리(이진 탐색 성능)를 통해 파일 메타데이터를 즉시 반환.

S3-backed Storage: 실제 바이너리 데이터는 AWS S3에 Hash값을 Key로 저장하여 무한한 확장성과 내구성 확보.

[최종 MVP 기술 스택]
Frontend: React (Tailwind CSS로 탐색기 UI 구현, crypto-js로 클라이언트단 해시 계산)

Backend: Python Flask (REST API, Boto3를 이용한 S3 연동)

Database: PostgreSQL (Docker: postgres:alpine, B-Tree 인덱스를 통한 고속 검색)

Infrastructure: Docker Compose (로컬), AWS Lightsail/EC2 (프로덕션)

2. 로컬 테스트 방법 (Local Development)
로컬 환경에서는 AWS 비용 걱정 없이 MinIO(S3 호환 오픈소스)를 사용하여 동일한 환경을 구축할 수 있습니다.

Docker Compose 구성:

postgres 컨테이너: 메타데이터 및 트리 구조 저장.

minio 컨테이너: 로컬 S3 저장소 역할.

flask-app: 백엔드 로직.

초기화 스크립트:

DB 테이블 생성 (파일 정보 테이블, 노드 트리 테이블).

MinIO 버킷 생성 및 API Key 설정.

테스트 시나리오:

중복 업로드: 동일한 파일을 다른 이름/폴더에 업로드 시, S3에는 추가 저장되지 않고 DB 노드만 늘어나는지 확인.

대용량 조회: DB에 가상 데이터(10만 건 이상)를 넣고 트리 탐색 속도 측정.

파일 삭제: 특정 경로에서 삭제 시 실제 S3 데이터는 유지하되(Reference Count 방식), 논리적 경로만 삭제되는지 확인.

3. AWS 프로덕션 배포 단계 (Deployment Steps)
로컬 테스트가 완료되면 AWS로 이전하는 단계입니다.

Step 1: 저장소 및 권한 설정 (S3 & IAM)
S3 버킷 생성 및 보안 정책 설정 (퍼블릭 액세스 차단).

EC2가 S3에 접근할 수 있도록 IAM Role을 생성하여 인스턴스에 연결.

Step 2: 서버 인프라 구축 (Lightsail/EC2)
Docker 및 Docker Compose 설치.

PostgreSQL 데이터 볼륨 설정: 컨테이너가 내려가도 DB 데이터가 유지되도록 호스트 디렉토리와 마운트.

Step 3: 환경 변수 관리
.env 파일을 통해 실제 AWS S3 버킷 이름, DB 접속 정보 등을 관리.

Flask에서 boto3.client('s3') 호출 시 별도의 인증키 없이 IAM Role을 통해 통신하도록 설정.

Step 4: 도메인 및 리버스 프록시 (Nginx)
Nginx 컨테이너를 추가하여 HTTPS(Certbot/Let's Encrypt) 적용.

사용자 요청을 Flask(Gunicorn/uWSGI)로 포워딩.


천천히 하나씩 구현해보자. 디렉토리 구조를 잡고, 사전에 필요한 라이브러리나 node_modules, Docker image를 알려줘