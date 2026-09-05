# School Diary — Changelog

## v1.0.1 — 2026-09-05

### 🚀 Modern Stack & Dependency Upgrades
- **Frontend Stack Bump**:
  - React `19.2.8` & React DOM `19.2.8`
  - TypeScript `7.0.2` with native TS7 configuration (`paths` relative resolution without deprecated `baseUrl`)
  - Vite `8.2.2` with Rolldown unified bundler engine
  - Tailwind CSS `4.3.3` with `@tailwindcss/vite` first-party plugin and CSS-first `@theme` configuration
  - TanStack React Query `5.102.8`
  - Lucide React `1.41.0`
  - Axios `1.20.0`
  - Date-fns `4.4.0`
  - Clsx `2.1.1`
  - Recharts `3.10.1`
- **Backend Stack Bump**:
  - FastAPI `0.141.1`
  - Uvicorn `0.52.4`
  - SQLAlchemy `2.0.52` (async)
  - AsyncPG `0.31.0`
  - Alembic `1.19.2`
  - Pydantic `2.13.5` & Pydantic Settings `2.15.0`
  - Python-multipart `0.0.32`
  - HTTPX `0.28.1`
  - Google GenAI SDK `2.22.0`
  - Psycopg2-binary `2.9.12`
- **Build & Typing Fixes**:
  - Added Node 22 Alpine builder for frontend Dockerfile
  - Added `vite-env.d.ts` and `@types/node` declarations for clean TypeScript compilation
  - Fixed null-safety type error on `default_cabinet` input in `SettingsPage.tsx`
  - Integrated `formatTime` in `DiaryPage.tsx` to display start/end lesson times in diary view
  - Migrated styling pipeline to Tailwind v4 CSS-first `@import "tailwindcss";` and `@theme` variables, removing obsolete PostCSS config

## v1.0.0 — 2026-09-05

### 🎉 Initial Release

#### Backend (FastAPI + PostgreSQL)
- **Data models**: Subject, ScheduleRule, HomeworkEntry with full async SQLAlchemy 2.0 ORM
- **Schedule API**: Date range queries with automatic numerator/denominator week detection based on configurable semester anchor date
- **AI timetable import**: Gemini 2.0 Flash integration for parsing schedule images into structured data
- **Bulk commit endpoints**: Both by subject ID and by subject name (auto-creates missing subjects)
- **Homework CRUD**: Full create/read/update/delete with completion toggling
- **Weekly statistics**: Total hours per subject calculation for any given week
- **Alembic migrations**: Auto-run on container startup

#### Frontend (React 19 + TypeScript + Tailwind CSS)
- **Daily View**: Ordered lesson cards with inline homework management and completion toggles
- **Diary Spread View**: Classic two-column layout (Mon-Wed | Thu-Sat) on desktop, horizontal swipeable cards on mobile
- **AI Import Modal**: File dropzone, side-by-side image/table preview, editable parsed data, week type selector
- **Stats View**: Recharts bar chart with per-subject hours, colored by subject, total/busiest summary cards
- **Settings Page**: Subject CRUD management with color picker, light/dark theme toggle
- **Theme System**: Light/dark modes with calm neutral palette, CSS custom properties, localStorage persistence

#### Docker Deployment
- **Zero-local-toolchain**: Full `docker compose up --build` — no local Node.js or Python required
- **Multi-stage frontend build**: node:20-alpine → nginx:alpine with SPA fallback and API proxy
- **Backend container**: Python 3.12 slim with auto-migration entrypoint
- **PostgreSQL 16**: Alpine image with persistent volume and health checks
