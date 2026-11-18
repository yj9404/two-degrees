# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TwoDegrees (투디그리)** is a curated blind date matching web app where users register profiles and admins facilitate AI-assisted matches. The app is Korean-language, mobile-first (max-width: md), and built entirely on free-tier cloud services.

## Repository Structure

- `backend/` — FastAPI backend (Python 3.11)
- `frontend/` — Next.js 15 frontend (TypeScript)

## Commands

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Linux/Mac
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # then fill in credentials
uvicorn main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

**Tests:**
```bash
cd backend
pytest                     # run all tests
pytest tests/test_main.py  # run a specific test file
pytest -k "test_name"      # run a single test by name
```

**Deploy to GCP Cloud Run:**
```bash
cd backend
gcloud run deploy twodegrees-backend --source . --region asia-northeast3 --allow-unauthenticated
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

## Architecture

### Backend (`backend/main.py`)

Single-file FastAPI application (~1200+ lines). Key sections:

- **Auth**: JWT-based admin auth (`POST /api/admin/login`), bcrypt password hashing for users
- **Users**: CRUD at `/api/users` — `UserRead` (public) vs `UserReadAdmin` (includes contact info) schemas
- **Matchings**: Admin creates pairs at `/api/matchings`; each user gets a unique token for accessing the shared profile page (`/p/[token]`)
- **AI Recommendations**: `POST /api/matchings/ai-recommend` calls Gemini 2.5 Flash via `utils/gemini.py` and caches results in `AiRecommendHistory` table
- **Images**: Presigned URL upload flow via `utils/s3.py` — frontend uploads directly to R2/S3, then stores the public URL

**Database:** SQLite in local dev, PostgreSQL (Neon) in production. Configured in `database.py` — falls back to `twodegrees.db` if `DATABASE_URL` is unset.

**Models** (`models.py`): `User`, `Matching` (with `user_a_token`/`user_b_token` for shared profile access), `AiRecommendHistory`, `Notice`

**Schemas** (`schemas.py`): Pydantic v2. `UserCreate` includes password; `UserRead` is user-facing (no contact); `UserReadAdmin` is admin-facing (includes contact).

### Frontend (`frontend/`)

Next.js 15 App Router. All pages are under `app/`:

| Route | Purpose |
|-------|---------|
| `/` | Landing + live stats |
| `/register` | Multi-step registration form (`RegistrationForm.tsx`) |
| `/edit` | Profile editing |
| `/auth` | User login |
| `/admin` | Admin dashboard (user list, matching creation, AI recommendations) |
| `/matching-status` | User's pending/accepted matchings |
| `/p/[token]` | Token-gated shared profile page for matched pairs |
| `/notices` | Announcements |

API calls go through `lib/api.ts`. UI components use shadcn/ui (`components/ui/`).

### Infrastructure

- **Frontend**: Vercel (auto-deploy from GitHub, root directory: `frontend/`)
- **Backend**: GCP Cloud Run (manual `gcloud run deploy`)
- **Database**: Neon PostgreSQL (free tier)
- **Storage**: Cloudflare R2 (S3-compatible, `AWS_REGION=auto`)

### Required Environment Variables

**Backend (`.env`):**
```
DATABASE_URL=        # Neon PostgreSQL connection string
ADMIN_PASSWORD=      # Admin login password
AWS_ACCESS_KEY_ID=   # R2/S3 access key
AWS_SECRET_ACCESS_KEY=
AWS_REGION=auto
S3_BUCKET_NAME=
S3_ENDPOINT_URL=     # https://<account_id>.r2.cloudflarestorage.com
S3_PUBLIC_BASE_URL=  # Public CDN URL for uploaded images
GEMINI_API_KEY=      # Google AI API key
ALLOWED_ORIGINS=     # Comma-separated CORS origins
```

**Frontend (`.env.local`):**
```
NEXT_PUBLIC_API_URL= # Backend URL (e.g. https://twodegrees-backend-xxxx.run.app)
```

---

> Antigravity 규칙에서 이관 (2026-10-14). 원본 파일은 그대로 보존되어 있습니다.
> 출처: `.agent/rules/project-rules.md`

## Tech Stack & UI/UX Guidelines
당신은 숙련된 풀스택 개발자이자 UI/UX 디자이너입니다. 앞으로 작성할 모든 코드는 다음 규칙을 엄격하게 따르십시오.

1. Tech Stack

Backend: Python (FastAPI), SQLAlchemy

Frontend: Next.js, React, TypeScript

Styling: Tailwind CSS

UI Components: shadcn/ui, Lucide Icons

2. UI/UX Design System

Mobile-First: 모든 레이아웃은 모바일 화면을 기준으로 우선 작성하십시오. 웹앱 전체 컨테이너의 최대 너비는 max-w-md (448px)로 제한하고 화면 중앙에 정렬(mx-auto)하십시오.

Strict Styling: 별도의 CSS 파일 작성이나 인라인 스타일(style="")을 엄격히 금지합니다. 오직 Tailwind CSS 유틸리티 클래스만 사용하십시오.

Color Palette: 배경은 bg-slate-50, 메인 콘텐츠 영역(카드 등)은 bg-white (약간의 그림자 shadow-sm 추가)를 사용하십시오. 메인 액션 버튼의 색상은 bg-blue-600으로 통일하십시오.

Typography: 텍스트 위계를 명확히 하십시오. 제목은 text-slate-900 font-semibold, 부가 설명이나 덜 중요한 정보는 text-slate-500 text-sm을 사용하십시오.

Spacing: 모든 패딩(p)과 마진(m), 컴포넌트 간격(gap)은 4의 배수(4, 8 등)를 사용하여 일관성을 유지하십시오.

3. Development Rule

한 번에 전체 페이지의 코드를 쏟아내지 마십시오. 컴포넌트 단위(예: 프로필 카드, 폼 입력 필드)로 하나씩 구현하고 구조를 확인받은 뒤 다음 단계로 넘어가십시오.
