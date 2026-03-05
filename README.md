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
- **Infrastructure**: Vercel (Frontend 배포), Railway/Render (Backend 배포), Neon/Supabase (PostgreSQL), Cloudflare R2 (이미지 스토리지)

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

배포는 Vercel(프론트엔드)과 Railway(백엔드)를 권장합니다. 백엔드 DB로는 Neon이나 Supabase 등 무료 PostgreSQL 서비스를 사용할 수 있습니다.

### 1. Backend 배포 (Railway 기준)

1. [Railway](https://railway.app/) 대시보드에서 **New Project** → **Deploy from GitHub repo**를 선택합니다.
2. `TwoDegrees` 리포지토리를 선택한 후, 배포할 **Root Directory**를 `/backend` 로 설정합니다.
3. 배포 환경 변수(`Variables`)에 다음 항목들을 추가합니다:
   - `DATABASE_URL`: (예) `postgresql://user:pass@host/dbname?sslmode=require` (Neon 등에서 발급받은 URL)
   - `ADMIN_PASSWORD`: (예) `your_strong_admin_password`
   - **(선택) 이미지 업로드 설정 (Cloudflare R2 등)**
     - `AWS_ACCESS_KEY_ID`: R2 토큰의 Access Key
     - `AWS_SECRET_ACCESS_KEY`: R2 토큰의 Secret Key
     - `AWS_REGION`: `auto` (R2인 경우)
     - `S3_BUCKET_NAME`: 생성한 버킷 이름
     - `S3_ENDPOINT_URL`: `https://<account_id>.r2.cloudflarestorage.com` (R2인 경우)
     - `S3_PUBLIC_BASE_URL`: 퍼블릭 캐시 및 CDN 도메인 (`https://pub-<hash>.r2.dev`)
4. 환경변수를 모두 넣고 배포를 진행합니다.
5. 배포 완료 후 생성된 백엔드 도메인을 복사해 둡니다. (예: `https://twodegrees-backend.up.railway.app`)

### 2. Frontend 배포 (Vercel 기준)

1. [Vercel](https://vercel.com/) 대시보드에서 **Add New...** → **Project**를 선택합니다.
2. `TwoDegrees` 프로젝트를 Import 합니다.
3. **Framework Preset**은 `Next.js`로 두고, **Root Directory**는 `frontend`를 선택합니다.
4. **Environment Variables**에 다음을 추가합니다:
   - `NEXT_PUBLIC_API_URL`: 위에서 복사한 백엔드 도메인 주소 (예: `https://twodegrees-backend.up.railway.app`)
5. **Deploy** 버튼을 클릭하여 배포합니다.

### 3. 클라우드 스토리지(R2/S3) CORS 설정 추가
프론트엔드 배포가 완료되면 프론트엔드 도메인 주소(예: `https://twodegrees.vercel.app`)를 복사하여 이미지 스토리지의 CORS 설정에 추가해야 합니다.
(그래야 브라우저에서 사진을 스토리지로 직접 업로드할 수 있습니다.)

- **Cloudflare R2 CORS 정책 설정 예시:**
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://twodegrees.vercel.app"
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
