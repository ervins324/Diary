# School Diary — Changelog

## v1.5.1 — 2026-09-06

### 🛡️ Subject Short Name Length Fix & Dual-Week Schedule Switcher
- **Subject `short_name` Column Expansion**:
  - Expanded `Subject.short_name` from `String(10)` to `String(30)` in `models/subject.py` and `schemas/subject.py`.
  - Added Alembic migration `003_expand_subject_short_name.py` altering `subjects.short_name` column in PostgreSQL to `VARCHAR(30)`.
  - Resolved `StringDataRightTruncationError` (500 Internal Server Error) during `POST /api/v1/schedule/bulk-commit-by-name` when importing subjects with longer abbreviations (such as "Історія Укр", "Громадянська Освіта", "Всес. Історія").
  - Clamped all auto-assigned short names with `[:30]` safely in `schedule.py`.
- **Dual-Week Numerator & Denominator Schedule Switching**:
  - Overhauled `AiImportModal.tsx` to maintain completely independent schedule states for **Numerator (Чисельник)** and **Denominator (Знаменник)**.
  - Replaced static single-state dropdown with a segmented tab switcher (`📘 Чисельник` / `📙 Знаменник`): switching tabs now instantly loads and displays that specific week's lessons in the editable preview table.
  - Added 1-click **"Copy from other week"** helper button to quickly sync or clone lessons between numerator and denominator.
  - Added commit scope selector allowing users to commit **Both Weeks** (saves both Numerator and Denominator simultaneously) or **Current Week Only**.
- **Updated AI Parser System Instructions & Template**:
  - Synchronized `backend/app/services/ai_parser.py` and frontend prompt template with revised Ukrainian subject abbreviations ("Історія Укр", "Громадянська Освіта", "Всес. Історія", etc.).

## v1.5.0 — 2026-09-06

### 📋 Direct JSON Schedule Import (No Gemini API Key Required)
- **Direct JSON Parsing Endpoint (`POST /api/v1/schedule/parse-json`)**:
  - Added dedicated endpoint allowing users to submit timetable JSON directly (from external AI chats like ChatGPT, Claude, Gemini Web, DeepSeek, etc.).
  - Strips markdown code fences (` ```json `), supports either root `{"days": [...]}` object or top-level array `[...]`.
  - Enriches any missing or `null` start/end lesson times automatically from the database's `bell_schedules` table (or standard defaults).
  - Eliminates the requirement for a configured backend `GEMINI_API_KEY` for timetable importing.
- **Enhanced AI Import Modal UI**:
  - Added tab switcher between **Photo (AI)** and **JSON from AI**.
  - Added **"Copy Prompt for AI"** button that copies a pre-formatted system prompt and JSON schema with 1-click.
  - Added JSON input textarea with `.json` file upload support.
  - Side-by-side review mode displays the source JSON formatted in a scrollable viewer next to the interactive `EditablePreview` table and week type selector (`numerator`, `denominator`, `both`).
  - Mobile-adapted responsive layout with touch-friendly tabs and buttons.
- **Localization**:
  - Added complete English (`en`) and Ukrainian (`uk`) translations for all new JSON import controls, tooltips, and placeholders.

## v1.4.0 — 2026-09-06

### 🔔 Dynamic Bell Schedule Time Integration
- **Backend: Database-Driven Bell Time Fallback**:
  - Refactored `POST /api/v1/schedule/ai-parse` to query the `bell_schedules` database table when AI-parsed lesson times are missing.
  - Removed hardcoded time population from the Pydantic `AiParsedLesson` model validator; time assignment now happens in the router endpoint where the DB session is available.
  - 3-tier fallback chain: AI-extracted times → imported bell schedule from DB → hardcoded `DEFAULT_BELL_TIMES` as last resort.
  - Added structured logging indicating which bell time source is being used (database vs hardcoded defaults).
- **Frontend: Bell-Aware Schedule Editing**:
  - `AiImportModal.tsx`, `ScheduleEditorModal.tsx`, and `EditablePreview.tsx` now fetch imported bell schedule data via `useBells()` hook.
  - All time fallbacks (commit handlers, new lesson defaults, rule loading) use imported bell times instead of hardcoded values.
  - Adding a new lesson in the editable preview table now auto-fills the correct start/end time based on the imported bell schedule for that lesson order.

## v1.3.0 — 2026-09-06

### ⚙️ Standalone Schedule Editor, Subject Export & Data Management Danger Zone
- **Standalone Schedule Editor**:
  - Added dedicated Schedule Editor modal accessible directly from Settings (`SettingsPage.tsx` -> `ScheduleEditorModal.tsx`).
  - Allows manual viewing, editing, adding, or deleting timetable lessons across all weekdays (Mon–Fri) and week types (`numerator`, `denominator`, `both`) without requiring an image upload.
  - Backend support via `GET /api/v1/schedule/rules` to retrieve raw schedule rules independently of calendar dates.
- **Export Only Subjects**:
  - Added an "Export Subjects" feature in Settings that downloads all registered subjects as a clean JSON file (`subjects-export-YYYY-MM-DD.json`).
  - Contains subject details (`name`, `short_name`, `color_hex`, `default_cabinet`).
- **Data Management & Danger Zone**:
  - Added a dedicated Danger Zone card in Settings with destructive action safeguards.
  - **Delete Schedule Only**: Atomically removes all schedule rules (`DELETE /api/v1/schedule`) while preserving subjects, homework entries, and bell schedules intact.
  - **Delete All Data**: Complete application reset (`POST|DELETE /api/v1/subjects/clear-all-data`) with strict foreign-key cascade order (`HomeworkEntry` -> `ScheduleRule` -> `BellSchedule` -> `Subject`). Protected by a double-confirmation modal requiring the user to type `DELETE`.
- **Localization**:
  - Added full Ukrainian (`uk`) and English (`en`) translations for all new editor, export, and danger zone actions.


### 🇺🇦 Ukrainian Localization, Clipboard Paste, Modal Scrolling & Schedule Refinements
- **Ukrainian Localization (`uk`) & Language Switcher**:
  - Added comprehensive Ukrainian (`uk`) and English (`en`) translation system (`frontend/src/i18n/translations.ts` and `LanguageContext.tsx`).
  - Added language toggle in `SettingsPage.tsx` with `localStorage` persistence, defaulting to Ukrainian.
  - Fully translated navigation tabs, headers, timetable cards, bell tables, settings, and modal controls.
- **Clipboard Image Paste (`Ctrl+V`)**:
  - Enabled clipboard image paste in `FileDropzone.tsx`, allowing instant screenshot pasting into both schedule and bell timetable AI import modals.
- **Edit Schedule Screen Scrolling Fix**:
  - Restructured `AiImportModal.tsx` and `EditablePreview.tsx` with dedicated scroll containers (`min-h-0`, `max-h-[50vh] md:max-h-[550px] overflow-y-auto`) to ensure smooth table scrolling on desktop and mobile.
- **Removed Saturday from Diary View**:
  - Streamlined `DiaryPage.tsx` to a standard 5-day school week (Monday to Friday), with Monday–Wednesday in the left column and Thursday–Friday in the right column.
- **Smart Ukrainian Subject Canonical Naming**:
  - Added canonical Ukrainian subject abbreviation dictionary in `backend/app/routers/schedule.py` (e.g., "Українська мова" -> "Укр мова", "Українська література" -> "Укр літ", "Англійська мова" -> "Англ мова", "Фізична культура" -> "Фізра").
  - Auto-assigns distinct pastel palette colors during automatic subject creation.
- **Gemini 3.5 Flash Ukrainian System Instructions & 24h Time Format**:
  - Rewrote system instructions in `backend/app/services/ai_parser.py` completely in Ukrainian.
  - Enforced strict 24-hour time format (`HH:MM`, no AM/PM) for both timetable and bell schedule image analysis.

## v1.1.0 — 2026-09-06

### 🔔 Bell Schedule ("Розклад Дзвінків"), AI Photo Parse & Default Dark Theme
- **Bell Schedule Feature**:
  - **Database Model & Migration**: Created `BellSchedule` model and Alembic migration (`002_bell_schedule`) storing `lesson_order`, `start_time`, `end_time`, and custom label `name`.
  - **REST API**: Added `/api/v1/bells` router providing listing, creation, single-slot editing, deletion, and atomic bulk replacement.
  - **AI Bell Timetable Parser**: Added `parse_bells_image` utilizing Gemini 3.5 Flash to automatically detect lesson numbers, start times, and end times from timetable photos.
  - **Dedicated UI Tab**: Added `/bells` page with lesson cards, duration indicators, and automatic break calculation between lessons.
  - **AI Bell Import Modal**: Added `AiBellsImportModal.tsx` allowing photo drop, interactive review table, and one-click database commit.
  - **Navigation**: Added "Bells" with `Bell` icon to desktop Sidebar and mobile BottomNav.
- **504 Gateway Timeout Fix**:
  - Configured 300s proxy read, send, and connect timeouts in `nginx.conf`.
  - Configured 180s request timeout in Axios client (`client.ts`), eliminating premature 504 timeouts during AI image parsing.
- **Default Dark Theme**:
  - Set Dark Mode as the default theme in `useTheme.ts` and added `class="dark"` to root `index.html` to prevent any initial render flash.

## v1.0.4 — 2026-09-06

### ⏰ Resilient AI Timetable Time Parsing & Default Bell Schedule
- **Flexible Lesson Time Schema**:
  - Made `start_time` and `end_time` nullable in `AiParsedLesson` (`str | None = None`) to handle timetables that only display subject names and lesson order numbers without explicit start/end hour columns.
  - Added a Pydantic `model_validator` in `schedule.py` that automatically populates standard school bell times based on the lesson order (e.g., Lesson 1: 08:30–09:15, Lesson 2: 09:25–10:10, Lesson 3: 10:25–11:10, etc.) if omitted by the image.
- **AI Prompt Guidance**:
  - Updated the Gemini 3.5 Flash system instruction in `ai_parser.py` instructing the model to pass `null` for `start_time`/`end_time` if exact times are not printed on the timetable, allowing automatic fallback time assignment.
- **Frontend Safeguards**:
  - Made time substring operations in `EditablePreview.tsx` null-safe (`(lesson.start_time || '').substring(0, 5)`) to prevent runtime crashes.
  - Added fallback default times in `AiImportModal.tsx` commit handler.

## v1.0.3 — 2026-09-06

### 🔍 Logging & Diagnostics Overhaul
- **Centralized Backend Logging**:
  - Configured structured logging with timestamps, logger names, and standard log levels in `main.py`.
  - Added request/response lifecycle logging middleware tracking HTTP method, path, and response status codes.
  - Added a global FastAPI exception handler ensuring any unhandled server errors log full tracebacks to stdout.
- **AI Parser Diagnostics (`ai_parser.py`)**:
  - Added fine-grained logging for AI parse operations (filename, MIME type, payload size in bytes, extraction results).
  - Explicitly handled `google.genai.errors.APIError` with status code mapping (400, 401, 403, 404, 429, 502, 503) instead of masking everything under generic 500 errors.
  - Added automatic markdown code block stripping (` ```json `) to prevent JSON decode failures.
  - Added raw response logging when Gemini returns malformed JSON or validation fails.
- **Frontend Error Visibility (`AiImportModal.tsx`)**:
  - Updated error display to extract and render the exact backend error message (`error.response.data.detail`) directly in the modal, giving immediate feedback if an image cannot be processed, API key is missing, or quota is exceeded.

## v1.0.2 — 2026-09-05

### 🛠️ API Routing & AI Engine Fixes
- **Eliminated 307 Temporary Redirects**:
  - Configured non-trailing and trailing slash route handlers (`""` and `"/"`) across `schedule`, `subjects`, and `homework` routers so requests like `GET /api/v1/schedule` resolve directly with `200 OK` without intermediate `307 Temporary Redirect` responses.
- **Google GenAI SDK 2.x Warning Resolution**:
  - Explicitly set `automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)` in `GenerateContentConfig` for `ai_parser.py`, eliminating the SDK warning regarding AFC in `Models.generate_content`.
  - Added dynamic MIME type detection for uploaded schedule images supporting JPEG, PNG, and WebP formats.

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
