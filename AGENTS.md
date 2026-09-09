# Agent Guidelines & Repository Context

## Core Rules (Mandatory)
1. **Preserve comments**: Never delete existing comments. You may update comments to make them more relevant, but do not delete them so the code is left without comments.
2. **Atomic code**: Make code atomic so changes in one place do not break other features. Code must be easy to maintain, update, and scale.
3. **Log updates**: Log important new features to [UPDATES.md](file:///C:/Users/ervin/Documents/Projects/Diary/UPDATES.md) specifying the current date and application version (refer to recent version tags in `UPDATES.md`, e.g. v1.8.x).
4. **Mobile-first UI**: When designing UI, adapt it for mobile immediately (`hidden md:flex` for desktop sidebar, [BottomNav](file:///C:/Users/ervin/Documents/Projects/Diary/frontend/src/components/layout/BottomNav.tsx) on mobile, `pb-16 md:pb-0` on `<main>`, responsive modal drawers).
5. **Language**: Always reply to the user in English.
6. **AI model**: Gemini Flash 2.5 is outdated; use Gemini 3.5 Flash or newer (`gemini-3.5-flash` / `gemini-3.8-flash`) with the `google-genai` SDK.

---

## Developer Commands & Verification

### Docker Stack (Primary Execution)
- Start complete stack: `docker compose up --build -d`
- Stop stack: `docker compose down`
- View logs: `docker compose logs -f api` or `docker compose logs -f web`
- App endpoint: `http://localhost:8080` (API docs: `http://localhost:8080/docs`)

### Backend (Python 3.12+ / FastAPI)
- Working directory: `backend/`
- Set Python path for testing:
  - PowerShell (Windows): `$env:PYTHONPATH="backend"; python -m unittest discover -s backend/tests`
  - Bash (Linux/macOS): `PYTHONPATH=backend python -m unittest discover -s backend/tests`
- Run a single test file (PowerShell):
  - `$env:PYTHONPATH="backend"; python -m unittest backend.tests.test_stats_and_timer`
  - `$env:PYTHONPATH="backend"; python -m unittest backend.tests.test_schedule_locator`
- Run unit tests inside Docker:
  - `docker compose exec api python -m unittest discover tests`
- Start local dev server:
  - `uvicorn app.main:app --reload --port 8000` (run from `backend/` directory)
- Apply database migrations:
  - `alembic upgrade head` (run from `backend/` directory)

### Frontend (React 19 / TypeScript / Vite 8)
- Working directory: `frontend/`
- Install dependencies: `npm install`
- Typecheck & Build: `npm run build` (`tsc -b && vite build`)
- Dev server: `npm run dev` (proxies `/api` to `http://localhost:8000`)

---

## Architecture & Repository Quirks

### Database & Storage Architecture
- **Async + Sync Drivers**:
  - FastAPI runtime uses `DATABASE_URL` with asyncpg driver (`postgresql+asyncpg://...`).
  - Alembic migrations use `ALEMBIC_DATABASE_URL` with psycopg2 driver (`postgresql://...`).
- **Startup Safety Migrations**:
  - [main.py](file:///C:/Users/ervin/Documents/Projects/Diary/backend/app/main.py) runs idempotent raw SQL checks (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) in its lifespan context to ensure newly added columns exist even if migrations are delayed.
- **Binary File Storage in PostgreSQL**:
  - Uploaded files (PDF, PPT/PPTX, images) are stored directly as BLOBs (`LargeBinary`) in the `stored_files` table in PostgreSQL ([stored_file.py](file:///C:/Users/ervin/Documents/Projects/Diary/backend/app/models/stored_file.py)), NOT on the local filesystem.
  - Homework attachments in `homeworks.attachments` store JSON metadata referencing `stored_files.id`.
- **System Backup & Pruning**:
  - Full atomic JSON backups (`/api/v1/system/backup/export` and `/import`) serialize all tables including base64-encoded `stored_files`.
  - Selective cleanup (`/api/v1/system/clean-data`) prunes historical homework, overrides, and unreferenced (orphaned) binary files.

### Timetable & Academic Calendar Mechanics
- **Numerator vs. Denominator Weeks**:
  - Calculated based on `SEMESTER_ANCHOR_DATE` (default `2026-09-01`) via Monday-based ISO week difference in [week_type.py](file:///C:/Users/ervin/Documents/Projects/Diary/backend/app/utils/week_type.py).
  - Even week offsets resolve to `"numerator"`, odd offsets resolve to `"denominator"`.
  - Master schedule rules ([schedule_rule.py](file:///C:/Users/ervin/Documents/Projects/Diary/backend/app/models/schedule_rule.py)) support `week_type: "all" | "numerator" | "denominator"`.
- **Temporal Overrides vs. Master Rules**:
  - Date-specific changes, teacher substitutions, lesson cancellations (`is_cancelled: true`), and academic event tags ([schedule_override.py](file:///C:/Users/ervin/Documents/Projects/Diary/backend/app/models/schedule_override.py)) are stored in `schedule_overrides` by `(date, lesson_order)`.
  - Never mutate recurring `schedule_rules` when making a single-week modification.
- **Academic Event Types**:
  - Tagged via `event_type`: built-in types (`control_work`, `test`, `essay`, `project`) or user-defined custom types configured in Settings.

### Frontend Conventions & Design System
- **Tailwind CSS v4 Semantic Theming**:
  - Theme colors are defined via CSS custom properties in [index.css](file:///C:/Users/ervin/Documents/Projects/Diary/frontend/src/styles/index.css) and exposed through `@theme`.
  - Always use semantic classes: `bg-bg-primary`, `bg-bg-secondary`, `bg-bg-tertiary`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border`, `accent`, `accent-light`, `success`, `danger`.
  - Dark mode is activated via the `.dark` class on the root HTML element.
- **Bilingual Localization (i18n)**:
  - Supports Ukrainian (`uk`, default) and English (`en`).
  - All user-facing strings must have corresponding keys in [translations.ts](file:///C:/Users/ervin/Documents/Projects/Diary/frontend/src/i18n/translations.ts) and be retrieved using `useLanguage().t('key')`.
- **TanStack Query Caching**:
  - Global query defaults: `staleTime: 5 mins`, `gcTime: 30 mins`. Invalidate queries (`queryClient.invalidateQueries(...)`) after creating, updating, or deleting entities to prevent stale UI state.
- **Mobile Navigation Structure**:
  - Desktop: sticky [Sidebar](file:///C:/Users/ervin/Documents/Projects/Diary/frontend/src/components/layout/Sidebar.tsx).
  - Mobile: fixed [BottomNav](file:///C:/Users/ervin/Documents/Projects/Diary/frontend/src/components/layout/BottomNav.tsx) + top sticky [LiveScheduleWidget](file:///C:/Users/ervin/Documents/Projects/Diary/frontend/src/components/schedule/LiveScheduleWidget.tsx). Main viewport requires `pb-16 md:pb-0` to avoid overlap.

### External Integrations & AI
- **Air Raid Alerts (Neptun API)**:
  - Integrates with `wss://neptun.in.ua/api/v1/stream` (fallback: `GET https://neptun.in.ua/api/v1/alerts`).
  - Polling automatically pauses when the browser tab is hidden (`document.hidden`).
  - Required attribution: *"Дані: Карта повітряних тривог — NEPTUN (neptun.in.ua)"*.
- **AI Timetable & Bell Schedule Parser**:
  - Uses `google-genai` SDK with `automatic_function_calling` disabled.
  - Prompts are strictly in Ukrainian and require 24-hour time format (`HH:MM`).
  - Supports image upload as well as direct JSON pasting for users without a backend API key.