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
