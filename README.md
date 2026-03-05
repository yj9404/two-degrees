# TwoDegrees (투디그리)

지인을 통한 안전한 소개팅 매칭 풀, **투디그리(TwoDegrees)** 입니다.
모바일 최적화된 웹 앱 형태로, 사용자가 본인의 프로필 및 원하는/기피하는 조건을 등록하고 관리자가 이를 바탕으로 알맞은 상대를 매칭해 주는 서비스입니다.

## ✨ 주요 기능

- **철저한 신원 확인**: 초대한 지인의 이름과 인스타그램 아이디, 프로필 사진을 필수로 입력받습니다.
- **상세한 프로필 등록**: 기본 정보(나이, 직업, 활동 지역 등) 및 민감한 정보(흡연 여부, 종교 등)를 입력할 수 있습니다.
- **조건 기반 매칭**: 사용자가 '원하는 조건'과 '기피 조건'을 명확히(최소 10자 이상) 기재하여 확률 높은 매칭을 돕습니다.
- **S3 호환 이미지 업로드**: Cloudflare R2 등 오브젝트 스토리지를 통해 Presigned URL 방식으로 이미지를 안전하고 빠르게 업로드합니다.
- **관리자 시스템**: `.env`에 설정된 관리자 비밀번호를 통해 어드민 페이지에 접근하여 전체 사용자 목록과 상세 정보를 열람할 수 있습니다.

## 🛠 기술 스택

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI, SQLAlchemy (SQLite/PostgreSQL 지원), Pydantic v2
- **Infrastructure**: Vercel (Frontend 배포), GCP Cloud Run (Backend 무상 배포), Neon (PostgreSQL 무료 데이터베이스), Cloudflare R2 (이미지 스토리지 10GB 무료)

---

## 💻 로컬 환경에서 실행하기

이 프로젝트는 `frontend`와 `backend` 두 개의 디렉토리로 구성되어 있습니다. 각각 별도로 실행해야 합니다.

### 1. Backend 실행
백엔드는 FastAPI로 구성되어 있으며 기본적으로 로컬 SQLite 데이터베이스(`twodegrees.db`)를 사용합니다.

```bash
cd backend

# 1. 가상환경 생성 및 활성화 (Windows 기준)
python -m venv .venv
.venv\Scripts\activate

# 2. 의존성 패키지 설치
pip install -r requirements.txt

# 3. 환경변수 설정 (필요 시)
# .env.example 파일을 복사하여 .env 파일을 생성하고 관리자 비밀번호 등을 입력합니다.
cp .env.example .env

# 4. 앱 실행
uvicorn main:app --reload --port 8000
```
- API 서버: `http://localhost:8000`
- Swagger API 문서: `http://localhost:8000/docs`

### 2. Frontend 실행
프론트엔드는 Next.js로 구성되어 있습니다.

```bash
cd frontend

# 1. 의존성 패키지 설치
npm install

# 2. 환경변수 설정
# .env.example 파일을 복사해 .env.local 파일을 생성합니다.
# 기본적으로 백엔드는 http://localhost:8000 을 바라보도록 설정되어 있습니다.
cp .env.example .env.local

# 3. 앱 실행
npm run dev
```
- 클라이언트 웹 페이지: `http://localhost:3000`

---

## 🚀 배포(Deployment) 가이드

배포는 모두 **무료로 제공되는 서비스(Free Tier)** 들을 기준으로 작성되었습니다. Frontend는 Vercel, Backend는 GCP Cloud Run, DB는 Neon 서버리스 Postgres, 이미지 스토리지는 Cloudflare R2를 사용합니다.

### 1. Backend 배포 (GCP Cloud Run 무료 플랜 기준)

Google Cloud Platform(GCP)의 Cloud Run은 매월 200만 건의 요청이 무료로 제공되며, 콜드 스타트가 빠르고 안정적입니다.

1. **GCP 프로젝트 준비**
   - [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트를 생성합니다.
   - 결제 정보(신용카드)를 등록해야 Cloud Run 구동이 가능합니다. (가입 시 지급되는 크레딧 및 매월 주어지는 무료 할당량 내에서 과금되지 않습니다.)
   - Cloud Run API를 활성화합니다.
   
2. **gcloud CLI 설치 및 로그인**
   - 로컬 환경에 [gcloud CLI](https://cloud.google.com/sdk/docs/install)를 설치합니다.
   - 터미널에서 아래 명령어로 로그인 및 프로젝트 설정을 진행합니다.
     ```bash
     gcloud auth login
     gcloud config set project [본인의_GCP_프로젝트_ID]
     ```

3. **Cloud Run 배포**
   - `backend` 디렉토리로 이동 후 소스코드를 빌드하고 배포합니다.
     ```bash
     cd backend
     gcloud run deploy twodegrees-backend --source . --region asia-northeast3 (서울 리전 추천) --allow-unauthenticated
     ```
   - 명령어 실행 중 터미널 프롬프트에서 `Cloud Build API` 활성화 등을 물어보면 `y`를 입력합니다.

4. **환경 변수 설정 (중요)**
   - 배포가 완료되면 GCP Console의 **Cloud Run** 메뉴 → 생성된 서비스(`twodegrees-backend`) 클릭 → **버전 수정 및 새 버전 배포** 메뉴로 들어갑니다.
   - **컨테이너, 연결, 보안** 탭 아래의 **변수 및 보안 비밀** 탭에서 로컬 컴퓨터의 `.env.example`에 있던 다음 값들을 추가합니다:
     - `DATABASE_URL`: (예) `postgresql://...!neon.tech/dbname?sslmode=require` ([Neon](https://neon.tech/) 무료 DB URL)
     - `ADMIN_PASSWORD`: (예) `your_strong_admin_password`
     - `AWS_ACCESS_KEY_ID`: R2 Access Key
     - `AWS_SECRET_ACCESS_KEY`: R2 Secret Key
     - `AWS_REGION`: `auto`
     - `S3_BUCKET_NAME`: 생성한 버킷 이름
     - `S3_ENDPOINT_URL`: `https://<account_id>.r2.cloudflarestorage.com`
     - `S3_PUBLIC_BASE_URL`: 퍼블릭 캐시/CDN (예: `https://pub-<hash>.r2.dev`)
   - 환경 변수 입력 후 **배포** 버튼을 눌러 새 설정을 적용합니다.

5. **API URL 생성 완료**
   - 서비스 페이지 상단에 표기된 URL 주소를 복사해 둡니다. (예: `https://twodegrees-backend-xxxx.run.app`)

### 2. Frontend 배포 (Vercel 기준)

1. [Vercel](https://vercel.com/) 대시보드에서 **Add New...** → **Project**를 선택합니다.
2. `TwoDegrees` 프로젝트를 Import 합니다.
3. **Framework Preset**은 `Next.js`로 두고, **Root Directory**는 `frontend`를 선택합니다.
4. **Environment Variables**에 다음을 추가합니다:
   - `NEXT_PUBLIC_API_URL`: 위에서 복사한 Cloud Run 백엔드 도메인 주소 (예: `https://twodegrees-backend-xxxx.run.app`)
5. **Deploy** 버튼을 클릭하여 배포합니다.

### 3. 클라우드 스토리지(R2/S3) CORS 설정 추가
프론트엔드 배포가 완료되면 프론트엔드 도메인 주소(예: `https://twodegrees.vercel.app`)를 복사하여 이미지 스토리지의 CORS 설정에 추가해야 합니다.
(그래야 브라우저에서 사진을 스토리지로 직접 업로드할 수 있습니다.)

- **Cloudflare R2 CORS 정책 설정 예시:**
```json
[
  {
    "AllowedOrigins": [
      "https://twodegrees.vercel.app",
      "https://twodegrees-backend-xxxx.run.app"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": []
  }
]
```
