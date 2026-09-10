# School Diary — Changelog

## v1.8.7 — 2026-09-10

### ❌ Homework Failure Tracking ("Failed in Class") & Analytics
- **Tri-State Homework Status (`is_failed`)**:
  - Added support to mark homework assignments as failed (`is_failed: true`), representing situations where the student was unprepared or failed the assignment in class and received a poor mark.
  - Implemented mutual exclusivity on backend and frontend: marking an assignment as failed automatically unmarks it as completed, and marking it completed clears the failed status. Clicking a failed assignment's checkbox resets it back to pending.
- **Database Schema & Startup Safety Migrations**:
  - Added `is_failed` (`BOOLEAN DEFAULT FALSE NOT NULL`) to `HomeworkEntry` model in `backend/app/models/homework.py`.
  - Added Alembic migration `008_homework_is_failed.py`.
  - Added idempotent startup safety migration check in `backend/app/main.py` lifespan (`ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS is_failed BOOLEAN DEFAULT FALSE;`).
  - Updated backup export and import serialization in `backend/app/routers/system.py` to preserve `is_failed` status across system snapshots.
- **Visual Design & Mobile Interactions (`HomeworkInline.tsx`)**:
  - Checkbox turns into a distinct rose-red indicator with a cross mark (`X`) when failed.
  - Added a dedicated "Failed in class" pill badge (`hw_failed_badge`) next to the homework text.
  - Failed assignments display muted text with subtle rose-tinted strikethrough styling.
  - Added a quick "Mark as failed / Unmark failed" button (`XCircle`) in the inline action toolbar, accessible on both desktop hover and always visible on mobile touch viewports.
- **Comprehensive Weekly Failure Analytics (`stats_service.py`, `StatsPage.tsx`)**:
  - Updated `get_weekly_stats` in backend to aggregate `failed` counts, `failure_rate`, daily `homework_failed` metrics, and detailed `failed_items` with subject names and colors.
  - **Multi-Segment Progress Bar**: Enhanced the weekly Homework Rate card in `StatsPage.tsx` to visualize Completed (emerald green) and Failed (rose red) percentages alongside Pending counts.
  - **Failed Homework Detail Card**: When failed homework exists in the active week, renders an insightful summary card detailing the subjects, due dates, and assignment descriptions that resulted in bad marks.
  - **Daily Breakdown Metrics**: Displayed failed homework counters alongside completion rates in day cards.
  - Excluded failed homework from `LiveScheduleWidget.tsx` pending homework counts so only active to-do items remain in the countdown.
- **Bilingual Localization (i18n)**:
  - Added complete Ukrainian and English translations for failed homework statuses, action tooltips, badges, and statistical summary headers in `translations.ts`.

## v1.8.6 — 2026-09-10

### ⚡ Vercel React Best Practices Optimization & 60/120 FPS Modal Scrolling
- **Decoupled Backdrop Blur Compositor Layers (`LessonOverrideModal.tsx`, `AddLinkModal.tsx`, `ScheduleEditorModal.tsx`, `AiImportModal.tsx`, `AiBellsImportModal.tsx`, `CommandPalette.tsx`, `SettingsPage.tsx`)**:
  - Separated the fixed `backdrop-blur` overlay from the modal dialog content into sibling DOM elements across all application modals.
  - Resolved the low-FPS scroll issue in the Lesson Substitution & Events modal: nesting scrollable lists inside a parent container with `backdrop-filter: blur(...)` forced browser GPU compositors to re-rasterize the entire viewport blur texture on every scroll tick. With a decoupled static sibling backdrop and isolated `transform-gpu` layer on the dialog, scrolling runs at native 60/120 FPS with 0 backdrop recalculations.
  - Added `overscroll-contain` to modal body and nested subject lists to prevent scroll chaining and jitter.
  - Removed continuous CSS `animate-pulse` from the 🚨 Air Alert toggle button inside the scroll body to prevent active repaints during scrolling.
- **Non-blocking Search & Map Indexing (`LessonOverrideModal.tsx`)**:
  - Implemented `useDeferredValue` (`rerender-use-deferred-value`) for subject search filtering, keeping typing and scrolling snappy and fluid.
  - Memoized base subject sorting on `[subjects, language]` so typing in the search box no longer re-sorts the entire array on every keystroke.
  - Pre-indexed subjects into a `Map<string, Subject>` (`js-index-maps`) for O(1) selections and preview rendering.
- **In-Memory Storage Cache Layer (`lib/storage.ts`, `js-cache-storage`)**:
  - Implemented an in-memory `Map` cache layer for browser `localStorage` reads (`show_cabinets`, `skip_weekends_to_monday`, `live_widget_enabled`), eliminating repeated synchronous disk I/O and main-thread stalls during schedule rendering and ticker intervals.
  - Added listeners for cross-tab `storage` events and `visibilitychange` to guarantee automatic cache synchronization.
- **Instant O(1) Custom Event & Lesson Type Lookups (`lib/customTypes.ts`)**:
  - Converted `getAllEventTypes()`, `getEventTypeInfo()`, `getAllLessonTypes()`, and `getLessonTypeInfo()` from linear JSON-parsing scans into cached in-memory arrays and case-insensitive index Maps.
  - Eliminated dozens of synchronous `localStorage.getItem` and `JSON.parse` operations that previously executed per frame across every lesson slot.
- **Schedule Card & Diary Rendering Optimizations (`LessonCard.tsx`, `DiaryPage.tsx`, `lib/utils.ts`)**:
  - Memoized `LessonCard` with `React.memo` (`rerender-memo`) to avoid full re-renders of the daily schedule tree when unrelated parent state changes.
  - Applied CSS `content-visibility: auto; contain-intrinsic-size: 0 300px;` (`rendering-content-visibility`) to day cards in `DiaryPage`, deferring layout calculations for off-screen day columns.
  - Short-circuited `isLessonNow` on non-today days in `DiaryPage` and added a 60-second cached ISO date string in `isLessonNow` to avoid creating and re-formatting `Date` instances 40+ times per render.
- **Throttled Scroll Handlers (`SettingsContents.tsx`)**:
  - Wrapped `handleScroll` in `requestAnimationFrame` to prevent layout thrashing from querying 9 section bounding rects on every scroll tick.
  - Fixed an undefined reference in `handleToggleWeekendSkip` in `SettingsPage.tsx`.

## v1.8.5 — 2026-09-10

### 🪟 Modal Portaling, Z-Index Stacking Context Fix & Air Alert Override Robustness
- **Fixed Stacking Context Trap with React Portals (`LessonOverrideModal.tsx`, `AddLinkModal.tsx`, `LightboxGallery.tsx`)**:
  - Re-anchored modal dialogues and image lightbox components to `document.body` via `createPortal`.
  - Resolved the critical CSS issue where lesson cards with `opacity-75` (cancelled lessons) created isolated stacking contexts, trapping `position: fixed; z-index: 50` modals inside the parent card and causing subsequent sibling cards (Lessons 2, 3, 4, etc.) to paint over the modal dialog and block clicks to the action buttons.
- **Null Safety & Resilience for Cancelled/Auto-Cancelled Lessons (`LessonCard.tsx`, `LessonOverrideModal.tsx`)**:
  - Added safe optional chaining on `lesson.subject` properties across color strips, subject headers, and lesson locator triggers, preventing runtime TypeErrors on lessons with null or missing subject references.
  - Sanitized `subject_id` in `handleSave` to avoid passing empty strings `""` to UUID backend validation endpoints.
  - Added state synchronization (`useEffect`) so form controls and subject selectors reliably re-hydrate whenever opening or switching between lesson slots.
- **Dismissal & Interaction Polish (`LessonOverrideModal.tsx`, `AddLinkModal.tsx`)**:
  - Added backdrop click dismissal (`onClick` outside card bounds) and global `Escape` keyboard dismissal.
  - Handled mutation failure alerts with descriptive feedback instead of silently swallowing errors.
  - Conditionally unmounted modals in `LessonCard.tsx` when closed to avoid holding stale form state.
- **Docker Compose Image & Container Naming (`docker-compose.yml`, `docker/db/Dockerfile`)**:
  - Configured custom image naming (`diary-db:16-alpine`, `diary-api:latest`, `diary-web:latest`) and container names (`diary-db`, `diary-api`, `diary-web`) for instant identification in Docker Desktop.
  - Backed by an atomic Dockerfile (`docker/db/Dockerfile`) referencing `postgres:16-alpine`.
  - Fully preserved existing persistent database volume (`pgdata:/var/lib/postgresql/data`) and internal DNS routing (`db`), ensuring zero impact on existing database records, files, or configurations during `docker compose up -d`.

## v1.8.4 — 2026-09-09

### 🛡️ Neptun Air Alerts Stream Stability & Visual De-Flickering
- **Eliminated Visual Blinking on Alert Banners (`LiveScheduleWidget.tsx`)**:
  - Removed `animate-pulse` from the outer banner container (`Sidebar.tsx`) and mobile pill (`LiveScheduleWidget.tsx`), which was causing the entire component to continuously cycle opacity (100% → 50%) every 2 seconds.
  - Kept a calm radar ping on the indicator dot (`animate-ping`) for clear alert status without visually jarring card-level blinking.
- **Canonical Stem Region Matching (`neptunAlerts.ts`)**:
  - Replaced naive substring checking (`ukName.includes(...)`) with an explicit canonical stems dictionary (`REGION_STEMS`) and minimum string length guards (`length >= 3`).
  - Completely resolved false-positive alarms caused by empty strings (`""`) in API payloads matching all regions.
  - Distinctly separated Kyiv City (`м. Київ`) from Kyiv Oblast (`Київська область`) to avoid cross-triggering alarms between municipality and province.
- **WebSocket Frame Handling & Snapshot Recovery (`neptunAlerts.ts`)**:
  - Updated message parsing to accept raw payload objects regardless of whether top-level `payload.type` is specified.
  - Fixed false watchdog disconnects that were forcibly dropping the connection every 90 seconds due to ignored snapshot frames.
- **Subscription Lifecycle Debouncing & Reconnect Backoff (`neptunAlerts.ts`, `useAirAlerts.ts`)**:
  - Introduced a 10-second debounce grace period on unsubscribing before tearing down WebSocket connections, preventing connection thrashing during React page transitions and hook re-evaluations.
  - Isolated the air alerts stream subscription from schedule query refetches and mutation callbacks in `useAirAlerts.ts`, eliminating the root cause of `HTTP 429: Too Many Requests` rate limits.
- **Command Palette & Alt-Tab Quick Runner (`CommandPalette.tsx`, `mathEvaluator.ts`, `Layout.tsx`)**:
  - Added a global Spotlight / Flow Launcher / KRunner command panel accessible via `Ctrl+K`, `Cmd+K`, `Alt+Space`, and `Alt+Q`.
  - Added an **Alt-Tab rapid tab switcher**: displays recent pages in visited order, allowing seamless back-and-forth toggling between recent views with `Tab` or number keys (`1`..`5`).
  - **Built-in Safe Math Calculator**: typing arithmetic expressions (e.g. `25 * 4`, `(120 - 30) / 3`, `15% of 200`, `sqrt(144)`) calculates results in real-time without `eval()`, with one-click or `Enter` copying to clipboard.
  - **Fast Subject & Action Search**: search across all configured subjects with colored badges, jump to Today/Tomorrow, toggle themes, switch languages, open backup exports, and access bell timetables instantly.
  - **Desktop & Mobile Ergonomics**: full keyboard navigation (`↑`/`↓`/`Tab` to navigate, `↵` to select, `ESC` to close), styled button in the desktop sidebar (`⌘K`), and mobile header trigger button.

## v1.8.3 — 2026-09-09

### 🚀 Mobile HW Actions, App Version Display, Improved Media Viewer & Background Auto-Refresh
- **Mobile Homework Edit/Delete Actions (`HomeworkInline.tsx`)**:
  - Made homework edit, delete, timer, and locate action buttons always visible on mobile (touch) devices using responsive opacity classes (`opacity-100 md:opacity-0 md:group-hover:opacity-100`).
  - Desktop retains the clean hover-to-reveal behavior.
- **App Version Display in Sidebar (`Sidebar.tsx`, `vite.config.ts`)**:
  - Added build-time version injection via Vite `define` block, reading from `package.json` version field.
  - Displays `v1.8.3` label in the sidebar footer below the theme toggle.
  - Added `__APP_VERSION__` TypeScript declaration in `vite-env.d.ts`.
- **Improved Lightbox Media Viewer (`LightboxGallery.tsx`, `HomeworkInline.tsx`)**:
  - Replaced the basic single-image lightbox with a full-featured gallery component.
  - Gallery navigation with prev/next arrows and dot indicators for multi-image homework.
  - Keyboard support: Escape to close, Arrow keys to navigate, +/- to zoom.
  - Touch swipe support for mobile navigation between images.
  - Double-click or button-based zoom (up to 4x).
  - Combined gallery view across inline images and image-type attachments.
- **Background Auto-Refresh on Tab Focus (`App.tsx`)**:
  - Enabled `refetchOnWindowFocus: true` so stale queries (>5 min) automatically refresh when the user returns to the browser tab.
  - Added `refetchOnReconnect: true` to also refresh stale data when network connectivity is restored.
- **Dynamic Island Live Schedule & Alerts Widget (`LiveScheduleWidget.tsx`)**:
  - Redesigned the sidebar widget with Dynamic Island aesthetics (smooth live progress bar, remaining time countdown, circular ring indicator on mobile, and next lesson preview with color accents).
  - Integrated real-time air alert status directly into the widget: active alerts display a high-visibility pulsing warning banner and mobile pill indicator.
- **Neptun Air Alerts Watchdog & Low-Latency Polling (`neptunAlerts.ts`)**:
  - Added a background heartbeat watchdog checking every 25s to detect and recover from silent or stalled WebSocket streams.
  - Reduced REST fallback throttle from 45s to 20s and polling interval to 30s for prompt alert activations and all-clear notifications.
  - Decreased tab refocus refresh delay to 15s and added instant initial REST sync upon subscription.
- **Lesson Card & Homework Button Touch Target UX (`LessonCard.tsx`, `HomeworkInline.tsx`)**:
  - Enforced touch-friendly button hit targets (34-36px minimum on mobile, tactile `active:scale-95` feedback).
  - Increased icon sizes to 14-16px and enlarged homework checkbox to `w-5 h-5` for effortless tapping on touchscreens.
  - Upgraded "Add Homework" from plain text to a styled, accessible button with a plus icon.
- **Keyboard Shortcuts & Mobile Touch Swipes (`DailyPage.tsx`, `DiaryPage.tsx`, `StatsPage.tsx`, `useSwipeGesture.ts`)**:
  - Added natural touch swipe gestures (horizontal swipe left for next day/week, right for previous day/week) with vertical scroll discrimination.
  - Added global keyboard navigation: `←` / `A` for previous day/week, `→` / `D` for next day/week, and `T` to jump directly to today/current week (automatically disabled while editing inputs/textareas).
- **Cancellation Reasons Statistics Breakdown (`stats_service.py`, `StatsPage.tsx`)**:
  - Tracked and aggregated lesson cancellation reasons and durations across weekly schedules.
  - Added an interactive reasons breakdown card in the Stats view displaying proportional progress bars, lesson counts, and lost study minutes for air alerts, teacher illness, or custom notes.

## v1.8.2 — 2026-09-08

### 🚀 Sidebar Wikipedia Navigation, Live Schedule & HW Widget, Custom Event/Lesson Types & Stats Breakdown
- **Sidebar Wikipedia Table of Contents Navigation (`Sidebar.tsx`)**:
  - Relocated the Wikipedia-style table of contents navigation directly into the main app sidebar (`Sidebar.tsx`) when browsing `/settings`.
  - Synchronizes active section highlights on scroll and automatically hides when the user navigates away to other tabs.
  - Removed the redundant desktop right sidebar from `SettingsPage.tsx`, keeping a compact collapsible accordion on mobile viewports.
- **Persistent Live Schedule & Homework Status Widget (`LiveScheduleWidget.tsx`, `Sidebar.tsx`, `Layout.tsx`)**:
  - Added a persistent real-time schedule awareness widget in the desktop sidebar and mobile header.
  - Displays ongoing lesson status (subject, times, room) OR break state (`Break • X min until [Next Subject]`), or day end state.
  - Displays live pending homework counter (`3 HW to do`) and planned academic events counter (`1 control work planned`).
  - Added user toggles in Settings under Preferences to customize which indicators are visible or disable the widget.
- **Air Alert Cancellation in Lesson Substitution Modal (`LessonOverrideModal.tsx`)**:
  - Moved the Air Alert cancellation button away from lesson card headers (`LessonCard.tsx`, `DiaryPage.tsx`), cleaning up the card action toolbar.
  - Added a prominent 1-click **Air Alert Cancellation** preset inside `LessonOverrideModal.tsx` that sets `is_cancelled: true` and notes `"Повітряна тривога"` / `"Air raid alert"`.
- **Custom Event Types & Lesson Types Manager (`customTypes.ts`, `SettingsPage.tsx`, `LessonOverrideModal.tsx`)**:
  - Added user management in Settings to create, customize, and delete custom event types (e.g. Olympiad, Exam, Lab, Presentation) and custom lesson types with custom names, emoji icons, and color palettes.
  - Dynamically integrated all user-defined types into the `LessonOverrideModal.tsx` selector and rendered dynamic custom badges on lesson cards across Daily and Diary views.
- **Stats Tab Clean Up & Standalone Breaks / Interruptions Box (`StatsPage.tsx` & `stats_service.py`)**:
  - Excluded break duration from the main study metrics grid, focusing core metrics strictly on academic instruction time.
  - Updated backend `stats_service.py` to calculate `total_cancelled_minutes` for scheduled lessons that were cancelled.
  - Created a dedicated standalone **"Breaks & Schedule Interruptions"** (`Перерви та скасовані уроки`) box displaying break time, cancelled lessons count, and cancelled duration separately from study hours.

## v1.8.1 — 2026-09-08

### 🚀 Wikipedia-Style Settings Navigation, Persistent Homework Timer, Stats Study Time & Air Alert Optimizations
- **Wikipedia-Style Quick Jump Navigation in Settings (`SettingsContents.tsx` & `SettingsPage.tsx`)**:
  - Implemented an authentic Wikipedia-style table of contents navigation panel featuring `Contents [hide]` / `[show]` toggle (with persistent state in `localStorage`).
  - Added `(Top)` jump link and numbered quick links to all 8 settings sections: Appearance & Language, Cabinets & Preferences, Subjects Directory, Schedule & AI Tools, Backup & Restore, Data Cleaning & Storage, Air Raid Alerts, and Danger Zone.
  - Active section indicator dynamically updates as the user scrolls, with smooth scrolling on click.
  - **Responsive Mobile Adaptation**: Sticky floating sidebar on desktop viewports (`xl:`), transitioning to a collapsible inline card directly below the Settings header on mobile and tablet screens.
- **Persistent Background Homework Stopwatch Timer (`HomeworkInline.tsx`)**:
  - Upgraded the stopwatch to use timestamp-based accumulation (`localStorage`) so the timer keeps ticking accurately in the background even if the student navigates between tabs, switches pages, or closes the browser.
  - **Relocated Directly Near Checkbox**: Positioned the interactive stopwatch chip right next to the completion checkbox (`[ ] [⏱️ 15m] Read Chapter 4...`), complete with pulsing active indicator and 1-click pause/resume.
  - Automatically finalizes and persists study time when the assignment is checked off as completed.
- **Homework Study Time Metrics in Stats (`StatsPage.tsx` & `stats_service.py`)**:
  - Added `total_time_spent_seconds` and `avg_time_spent_seconds` to `homework_stats` in `WeeklyStatsResponse`.
  - Added `homework_time_spent_seconds` to daily breakdown objects.
  - Rendered a new **Homework Study Time** summary metric card on `StatsPage.tsx` showing total hours and minutes spent on homework along with average time per assignment, plus daily timer badges in the breakdown cards.
- **Optimized Neptun Air Alerts & 1-Click Manual Lesson Cancellation (`neptunAlerts.ts`, `LessonCard.tsx`, `DiaryPage.tsx`)**:
  - **Request Optimization**: Reduced fallback polling interval to 60s and added a 45s in-memory fetch throttle.
  - **Visibility Awareness**: Automatically pauses network polling when the browser tab is hidden in the background (`document.hidden`), resuming only when brought back into focus.
  - **Exponential Reconnection Backoff**: Added smooth backoff (15s → 30s → 60s) for WebSocket reconnection attempts.
  - **Manual Air Alert Lesson Action**: Added a 1-click "Cancel by Air Alert" button with Radio icon on lesson cards in Daily (`LessonCard.tsx`) and Weekly Diary (`DiaryPage.tsx`), setting `is_cancelled: true` and note `"Повітряна тривога"` with 1-click restore functionality.

## v1.8.0 — 2026-09-08

### 🚀 Homework Stopwatch Timer, Stats Overhaul, Neptun Air Alerts, UX Refinements & Expanded Settings
- **Homework Stopwatch Timer (`HomeworkInline.tsx`)**:
  - Embedded an interactive stopwatch into homework assignment cards with Start, Pause, and Reset controls.
  - Automatically records and persists study time into `homeworks.time_spent_seconds` upon pausing or stopping.
  - Displays a compact, stylized elapsed time chip (`⏱️ mm:ss` or `hh:mm:ss`) with live pulsing indicators during active homework sessions.
  - Added Alembic migration `007_homework_time_spent.py` and zero-downtime startup safety column verification in `main.py`.
- **Comprehensive Weekly Stats Overhaul (`StatsPage.tsx` & `stats_service.py`)**:
  - **Template vs Actual Switcher**: Added top mode segmented toggle `[ This Week (Actual) ]` | `[ Numerator Template ]` | `[ Denominator Template ]` to view stats for the live week or recurring schedule templates.
  - **Study Time vs Lesson Count Metric Toggle**: Added switcher allowing users to view lesson counts (e.g., "1 lesson", "4 lessons") instead of hours/minutes across bar charts and daily breakdown tables.
  - **Automatic Cancellation Deduction**: Filtered out cancelled lessons (`is_cancelled == True`) from active study hours and lesson totals, with an alert banner highlighting total cancelled lessons for the week.
  - **Academic Events Milestone Summary**: Integrated event milestone counters for Control Works, Tests, Essays, and Projects scheduled during the selected week.
- **Real-Time Air Alert Integration (Neptun API - `neptun.in.ua`)**:
  - Added real-time WebSocket connection to `wss://neptun.in.ua/api/v1/stream` with REST fallback `GET https://neptun.in.ua/api/v1/alerts`.
  - Configurable region/oblast selector in Settings (covering all 25 Ukrainian regions).
  - **Automatic Lesson Cancellation**: Option to automatically cancel ongoing lessons during active air alerts with note "Повітряна тривога (Автоскасовано)", with 1-click manual override/undo capability.
  - Included required attribution: *"Дані: Карта повітряних тривог — NEPTUN (neptun.in.ua)"*.
- **Hide Classroom Cabinets Setting**:
  - Added global user setting `show_cabinets` to toggle classroom numbers across Daily cards, Diary schedule rows, and modals.
- **Lesson Substitution & Events Modal UX Overhaul (`LessonOverrideModal.tsx`)**:
  - Removed top warning banner and helper description label.
  - Removed classroom cabinet input from the modal.
  - Replaced native select with an alphabetical, searchable subject picker featuring colored subject indicators and instant text filtering.
- **Cleaned UI & Relocated AI Schedule Importer**:
  - Removed the floating action button (`Wand2`) from `DailyPage.tsx`.
  - Moved the AI Timetable Importer into `SettingsPage.tsx` under **Schedule & Data Tools**.
- **Automated Tests**:
  - Added `backend/tests/test_stats_and_timer.py` testing homework timer schemas, stats cancellation deductions, academic event counts, and mode switching.

## v1.7.3 — 2026-09-07

### 🚀 Lesson Event Types (Control Work, Test, Essay, Project) & Maximum Stability Polish
- **Lesson Event Tagging (`event_type`)**:
  - Added support for marking lessons with special academic events:
    - 🔥 **Control Work / Контрольна робота** (`control_work`)
    - 📝 **Test / Quiz / Самостійна робота / Тест** (`test`)
    - ✍️ **Essay / Твір / Есе** (`essay`)
    - 🚀 **Project / Презентація / Проєкт** (`project`)
    - 🎓 **Regular Lesson / Звичайний урок** (`null` / `regular`)
  - Supported directly through the enhanced Lesson Substitution & Event modal (`LessonOverrideModal.tsx`). Users can tag any lesson with an event milestone without needing to alter the subject or classroom.
- **Visual Badges & Highlight Styling**:
  - **Daily View (`LessonCard.tsx`)**: High-contrast, distinctive pill badges with emoji and localized text, complemented by subtle accent colored borders (rose for Control Work, amber for Tests, purple for Essays, sky blue for Projects).
  - **Weekly Timetable (`DiaryPage.tsx`)**: Compact event badges in weekly schedule rows to allow students to spot upcoming tests across the whole week at a glance.
- **Database & Architecture Polish for Maximum Stability**:
  - **Alembic Migration**: Created `006_lesson_event_types.py` adding `event_type VARCHAR(50)` to `schedule_overrides`.
  - **Startup Safety Check**: Added a zero-downtime startup lifespan handler in `backend/app/main.py` executing `ALTER TABLE schedule_overrides ADD COLUMN IF NOT EXISTS event_type VARCHAR(50);`, ensuring compatibility even if migrations are bypassed.
  - **Full Backup & Restore Fidelity**: Updated `/api/v1/system/backup/export` and `/api/v1/system/backup/import` to version `1.7.3`, ensuring all event milestone tags persist across backup exports and restores.
- **Automated Unit Tests**:
  - Added `backend/tests/test_lesson_events.py` verifying:
    - Creating and updating overrides with `event_type` tags.
    - Automatic mapping of `event_type` onto `LessonSlot` in `schedule_service.py`.
    - Backup schema serialization and deserialization roundtrip.

## v1.7.2 — 2026-09-07

### 🚀 Data Storage Breakdown Statistics & File Size Comparison Diagram
- **Storage Space Consumption Breakdown (`GET /api/v1/system/storage-stats`)**:
  - Implemented backend storage inspection endpoint calculating exact byte sizes and record counts across 6 distinct categories:
    - **Attached Files**: Stored documents and media (`StoredFile`), with granular breakdown for PDF documents, PowerPoint presentations, images, and others.
    - **Homework Records**: Row overhead, text content, and embedded attachment metadata.
    - **Schedule Rules**: Master weekly timetable entries.
    - **Weekly Substitutions**: Single-date temporal overrides.
    - **Bell Timetables**: Bell schedule intervals.
    - **Subjects Directory**: School subjects catalog.
- **Space Distribution Diagram & Visual Ratio Bar (`SettingsPage.tsx`)**:
  - Embedded an interactive storage statistics panel directly in the **Data Cleaning & Storage** section.
  - **Overview Stat Cards**: Displays Total Space Consumed, Attachment Files Total (with % share badge), and Relational Database Records.
  - **Visual Ratio Comparison Bar**: Segmented proportion bar comparing File storage against Database records, highlighting the percentage difference.
  - **Visual Diagram**: Responsive Recharts horizontal bar chart comparing disk consumption across all categories with formatted units (B, KB, MB) and interactive hover tooltip with record counts.
  - **File Type Subcategory Breakdown**: Displays separate count and size pills for PDFs, Presentations, Images, and other files.
  - **Storage Insight Callout**: Clearly illustrates to users that uploaded binary documents and photos consume orders of magnitude more space than structured timetable records and notes, and explains why pruning old attachments is the most effective cleanup action.
  - **Mobile Responsive Design**: Multi-column cards and diagram collapse gracefully to compact single-column layouts on mobile screens.
- **Unit Testing (`backend/tests/test_cleaning.py`)**:
  - Added unit test suite for `get_storage_stats`, verifying size calculations for binary files vs database rows, verifying that files account for >99% of space in realistic scenarios, and ensuring empty database handling without division errors.

## v1.7.1 — 2026-09-07

### 🚀 Previous Lesson Locator, PPT/PPTX Presentation Storage/Download, & Unit Tests
- **Previous Lesson Return Locator (`RotateCcw` icon)**:
  - Added return-to-previous lesson action alongside the next lesson button in `HomeworkInline`, `LessonCard` (Daily tab), and `DiaryPage` (weekly schedule rows).
  - Added backend search endpoint `GET /api/v1/schedule/previous-lesson` and `find_closest_previous_lesson` service function: performs reverse chronological backward search from `(current_date, current_lesson_order)`, jumping to the closest previous lesson of that subject across past dates, alternating numerator/denominator schedules, and temporal overrides.
  - Automatically flips the calendar backward in Daily and Diary views, scrolls the previous lesson into center view, and triggers a glowing accent ring pulse animation.
- **PPT / PPTX File Uploading, PostgreSQL Storage & Direct Downloading**:
  - Added PowerPoint presentation support (`.ppt`, `.pptx`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`) across all homework creation and edit file inputs in Daily, Diary, and HomeworkInline views.
  - Normalized presentation MIME types and added automatic attachment disposition in `backend/app/routers/files.py`.
  - Added `download: bool = False` query parameter support in `GET /api/v1/files/{file_id}` to force browser file download.
  - Enhanced `AttachmentChip.tsx` with dedicated presentation badge, file size indicator, and 1-click `Download` icon button.
- **Automated Unit Tests**:
  - Added `backend/tests/test_schedule_locator.py` covering:
    - Forward search skipping clicked slot and finding next occurrences.
    - Backward search skipping clicked slot and finding previous occurrences on same day or earlier dates.
    - Handling absent prior lessons gracefully (`None`).
  - Added `backend/tests/test_files.py` covering:
    - PPTX upload MIME normalization.
    - Direct download headers and attachment disposition for PowerPoint presentations.
    - PDF inline preview versus explicit download headers.
- **Website Icon & Branding (`favicon.svg`)**:
  - Designed custom school diary SVG icon featuring a soft indigo squircle book base, open timetable pages, golden ribbon bookmark, and homework completion checkmark badge.
  - Set as browser favicon (`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`) with `#6366F1` theme color in `index.html`.
  - Added the branded icon to the sidebar header beside the application title.
- **Data Cleaning & Storage Management (`SettingsPage.tsx`)**:
  - Added dedicated **Data Cleaning & Storage** section in Settings.
  - **Automatic Background Cleaning**: Toggleable automated pruning upon app startup with customizable retention periods (2 weeks, 1 month, 3 months, 6 months, 1 year) and granular target filters (all homework, completed homework only, temporary schedule substitutions, orphaned attachment files).
  - **Manual Time-Step Cleanup**: Selective deletion tool supporting either historical cutoff dates (`before_date`) or specific date ranges (`start_date` to `end_date`), with item counts breakdown and query cache invalidation.
  - Backend endpoint `POST /api/v1/system/clean-data` handling batch deletions and identifying unreferenced stored attachments.
  - Added unit test suite `backend/tests/test_cleaning.py`.

## v1.7.0 — 2026-09-07

### 🚀 Next Lesson Locator, PDF & Presentation Storage/Linking, and Temporal Weekly Substitutions
- **Next Lesson Locator Button (`Compass` icon)**:
  - Added next-lesson locator action near the edit/delete buttons in `HomeworkInline` and directly on lesson cards in the **Daily** tab (`LessonCard`) and **Diary** tab weekly rows.
  - Backend search endpoint `GET /api/v1/schedule/next-lesson`: Finds the closest upcoming lesson for any subject on or after today, factoring in numerator/denominator week alternation and temporal overrides.
  - Smoothly navigates the calendar view (auto-advancing date in Daily tab or jumping to the target week in Diary tab), centers the lesson in the viewport (including mobile horizontal swipe container), and triggers a glowing accent ring pulse animation for 2.5 seconds.
  - Alerts user with a friendly localized notification if no upcoming lesson exists for that subject.
- **Persistent Binary File Storage (PDFs, Images) & Presentation/PDF Linking**:
  - **PostgreSQL Binary Storage (`stored_files` table)**: Added binary file storage in PostgreSQL via Alembic migration `005_attachments_and_overrides.py`. Uploaded PDFs and images persist inside the database volume without requiring external host directories or volume mount changes.
  - **REST Endpoints (`/api/v1/files`)**: Added `POST /api/v1/files/upload`, `GET /api/v1/files/{file_id}` (serving files with native inline browser headers for PDF viewing), and `DELETE /api/v1/files/{file_id}`.
  - **Multi-Attachment Homework**: Extended `HomeworkEntry` with `attachments` JSON column. Supports uploading PDFs, images, and attaching external links.
  - **Interactive Attachment Chips (`AttachmentChip.tsx`)**: Renders visual chips for attachments: red document badge for PDFs with formatted file size (`KB`/`MB`), amber badge for Presentations, emerald badge for images (with full lightbox viewer), and sky-blue badge for web links.
  - **Link Embedding Modal (`AddLinkModal.tsx`)**: Quick dialog for adding external presentation links (Google Slides, Canva, OneDrive, PowerPoint Online, Prezi) and direct web PDF links with auto-detection of link types.
- **Temporal Weekly Schedule Changes (Substitutions & Overrides)**:
  - **Database Model (`schedule_overrides` table)**: Added table for single-date schedule overrides without mutating recurring master timetable rules.
  - **Changed Lesson Format with Previous in Brackets**: Substituted lessons render as `New Subject (Original Subject)` (e.g. `Хімія (Фізика)` / `Chemistry (Physics)`) with an amber **"Заміна / Substitution"** pill badge. Cancelled lessons display with strikethrough and original class in brackets.
  - **Interactive Substitution Modal (`LessonOverrideModal.tsx`)**: Accessible via the `ArrowLeftRight` quick action on any lesson card or row. Allows picking a substitute subject, updating the classroom/cabinet, marking a lesson as cancelled/free period, or 1-click **Reset to Regular Schedule**.
  - **REST Endpoints (`/api/v1/schedule/override`)**: Added `POST /override`, `DELETE /override`, and `GET /overrides`.
  - **Full Backup & Restore Support**: Updated `/api/v1/system/backup/export` and `/api/v1/system/backup/import` to version `1.7.0`, serializing all `stored_files` (base64), `schedule_overrides`, and homework `attachments`.
- **Ukrainian & English Localization**:
  - Added localized strings for substitutions, cancellations, locator tooltips, attachment chips, and modals in `frontend/src/i18n/translations.ts`.

## v1.6.1 — 2026-09-07

### 🐛 Bug Fixes & Improvements
- **Stats Homework Completion Rate Fix**:
  - Fixed homework completion percentage not updating in Stats when toggling, creating, or deleting homework.
  - Root cause: `useHomework` hooks did not invalidate `['stats']` React Query cache, so 5-minute staleTime served stale data.
  - Added `queryClient.invalidateQueries({ queryKey: ['stats'] })` to `useCreateHomework`, `useUpdateHomework`, and `useDeleteHomework`.
- **Diary Tab Homework Creation**:
  - Added inline "Add HW" button to every lesson in the Diary weekly view.
  - Compact form with text input, file browser, and Ctrl+V clipboard image paste (same capabilities as Daily tab).
  - Attached image thumbnail previews with remove buttons.
- **Docker Build Caching Optimization**:
  - Added BuildKit cache mounts (`--mount=type=cache`) for pip (`/root/.cache/pip`) and npm (`/root/.npm`) to persist dependency packages across rebuilds.
  - Configured `npm install` with npm cache mount for rapid image compilation without requiring a checked-in lockfile.
  - Added `.dockerignore` files for both backend and frontend to reduce build context size.
- **Subject Color Palette Distinctness & Non-Overlapping Hues**:
  - Expanded `DISTINCT_SUBJECT_COLORS` to 20 maximally spaced hues across the 360° color wheel (Red, Green, Blue, Violet, Amber, Cyan, Pink, Lime, Orange, Purple, Teal, Indigo, Fuchsia, Mustard, Sky, Brown, etc.).
  - Re-mapped `UKRAINIAN_SUBJECT_SHORT_NAMES` so each major subject has a distinct, contrasting color (e.g. History of Ukraine is Warm Brown, World History is Golden Amber, Chemistry is Crimson Red, Biology is Dark Teal, Geography is Mustard Yellow, Geometry is Sky Blue, Algebra is Bright Purple, Civics is Deep Indigo).
  - Eliminates visual similarity between subjects in both timetable views and Stats charts.
- **Current / Ongoing Lesson Live Highlighting (Daily, Diary & Bells tabs)**:
  - Added real-time ongoing lesson tracking with `isLessonNow(startTime, endTime, date)` helper.
  - **Daily Tab (`LessonCard`)**: Highlights currently running lesson with active glowing accent border, soft background tint, and pulsing **"Now / Зараз • Ongoing / Триває"** badge.
  - **Diary Tab (`DiaryPage`)**: Highlights the active ongoing lesson inside the weekly grid with accented border, highlight ring, and **"Now"** live badge.
  - **Diary Tab High-Contrast Font**: Replaced colored subject name text with crisp standard theme text (`text-text-primary`) alongside dedicated colored subject indicator dots (`w-2.5 h-2.5 rounded-full`), ensuring 100% legibility in both light and dark themes regardless of whether a subject was assigned a light or white shade.
  - **Bells Tab (`BellsPage`)**: Highlights the active bell slot with glowing accent ring, colored order icon, and **"Now / Зараз"** indicator. Also tracks and actively highlights ongoing breaks between classes with accent background glow, bouncing coffee icon, and live **"Break Now / Зараз перерва"** pulsing pill badge.

## v1.6.0 — 2026-09-06

### 🚀 Full Backup/Restore, Multi-Image Homework, Rich Stats & Bell JSON Import
- **Bell Schedule JSON Import (`POST /api/v1/bells/parse-json`)**:
  - Added dedicated JSON parse tab in `AiBellsImportModal.tsx` matching timetable import.
  - Added 1-click **"Copy Prompt for AI"** button with custom bell schedule extraction instructions and JSON schema.
  - Dual-mode review step showing formatted source JSON viewer alongside the interactive editable bells table.
- **Weekend Auto-Advance with Settings Toggle**:
  - Automatically advances to next week's Monday when visiting Daily or Diary views on Saturday and Sunday.
  - Added toggle switch in Settings (`SettingsPage.tsx`) backed by `localStorage` (`skip_weekends_to_monday`).
- **Improved Deterministic Subject Color Palette**:
  - Introduced 16 curated high-contrast vibrant colors (`DISTINCT_SUBJECT_COLORS`) preventing visual overlaps.
  - Implemented deterministic hashing (`get_deterministic_color`) so identical subjects always receive the same color across both Numerator and Denominator.
- **Full System Backup & Restore (JSON)**:
  - Added backend system endpoints `GET /api/v1/system/backup/export` and `POST /api/v1/system/backup/import`.
  - Exports a complete snapshot of all app data (subjects, bell timetable, lesson rules, homework with photos).
  - Restores full database state in an atomic transaction maintaining foreign key relationships.
  - Added Backup & Restore card in Settings with one-click export and file restore with confirmation prompts.
  - **PostgreSQL/asyncpg Time Coercion Fix**: Added `parse_time_str()` parser in `backend/app/routers/system.py` to ensure time fields (`start_time`, `end_time`) are explicitly converted to Python `datetime.time` instances, eliminating `asyncpg.exceptions.DataError ('str' object has no attribute 'hour')` on Linux/Docker servers.
- **Homework Multi-Image Attachments with Text & Lightbox**:
  - Added `images` JSON column to `homeworks` table in PostgreSQL with Alembic migration `004_homework_images.py`.
  - Added multi-image file upload and direct `Ctrl+V` clipboard image pasting on homework input.
  - Integrated client-side canvas compression (1280px max, JPEG 0.82) keeping payloads compact.
  - Rendered image thumbnails in `LessonCard` and `HomeworkInline` with full-screen lightbox image viewer.
- **Enriched Statistics & Analytics**:
  - Enhanced `GET /api/v1/stats/weekly` with: Active Subjects count, Total Lessons, Daily Average Lessons, Break Duration, and Homework Completion Rate.
  - Upgraded `StatsPage.tsx` with a responsive 6-card metrics grid featuring icons, time breakdown, and completion progress bar.
  - **Deterministic Subject Bar Chart Ordering**: Sorted subjects alphabetically so subject bars stay in the exact same order and positions when toggling between numerator and denominator weeks.
  - **Day-by-Day Statistics Breakdown (`By Days` view)**: Added a segmented view toggle (`By Subjects` vs `By Days`) in `StatsPage.tsx`. Includes a daily study hours bar chart (Mon–Fri) and interactive day cards displaying total lessons, study time, break duration, homework counts, and colored subject chips for every day of the week.
- **Alphabetical Subject Sorting & Instant Search in Settings**:
  - Added deterministic Ukrainian/English alphabetical sorting (`А-Я` / `Я-А` toggle) in Settings under **Manage Subjects**.
  - Added click-to-sort column header for subject name.
  - Added real-time search input to instantly filter subjects by name, abbreviation, or room cabinet.
- **Full-Stack Performance & Stability Overhaul**:
  - **Database N+1 Query Elimination**: Refactored `get_schedule_for_range` in `schedule_service.py` to batch-fetch homework and eager-load subjects (`selectinload`), reducing database roundtrips from 50+ down to 2 instant queries per schedule request.
  - **Database Connection Pool Tuning**: Tuned SQLAlchemy engine in `database.py` with `pool_size=10, max_overflow=20, pool_pre_ping=True, pool_recycle=300` for connection reusability and crash resilience.
  - **Code-Splitting & Lazy Loading**: Converted all pages to `React.lazy` with `<Suspense>`, reducing the initial JavaScript entry bundle from 810 KB down to **30 KB** (10 KB gzipped).
  - **Modular Vendor Chunking**: Configured Rollup manual chunking in `vite.config.ts` (`vendor-react`, `vendor-charts`, `vendor-dates`, `vendor-icons`, `vendor-query`) for persistent browser-level asset caching.
  - **Nginx Gzip & Caching Engine**: Configured Nginx with compression level 6 across all text/js/css/svg formats and 1-year immutable caching for static assets.
  - **Zero-Latency In-Memory Query Caching**: Tuned React Query `staleTime: 5 min` and `gcTime: 30 min`, making tab navigation between Daily, Diary, Bells, Stats, and Settings 100% instantaneous without loading spinners.
- **Daily Tab Cabinet Localization**:
  - Fixed hardcoded `"Cab"` in `LessonCard.tsx` to use localized `t('cabinet_short')` (`Каб` in Ukrainian).

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
