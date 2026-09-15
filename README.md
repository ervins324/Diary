# 📚 School Diary (Шкільний Щоденник)

A modern, production-ready, self-hosted personal school diary web application with AI-powered timetable and bell schedule recognition. Built with FastAPI, PostgreSQL, React 19, and Tailwind CSS.

---

## ✨ Features

- **📅 Daily & Diary Views**:
  - **Daily View**: Step-by-step view of lessons for any day with inline homework tracking and completion toggles.
  - **Weekly Diary Spread**: Traditional Ukrainian 5-day school week (Monday to Friday) with two-column desktop layout and swipeable mobile view.
- **🔔 Bell Schedule (Розклад Дзвінків)**:
  - Dedicated tab for managing school bell intervals, custom lesson labels, and automated break calculations.
- **🤖 AI Timetable & Bell Schedule Import (Prompt & JSON)**:
  - Import schedule or bell timetable using ready-made prompts and structured JSON.
  - Compatible with any LLM (ChatGPT, Claude, Gemini Web, DeepSeek) without requiring a backend API key.
  - Interactive side-by-side review and editing before saving to the database.
  - Automatic creation of missing subjects with smart Ukrainian abbreviations (e.g., *Українська мова* -> *Укр мова*, *Фізична культура* -> *Фізра*) and distinct palette colors.
  - Ukrainian system prompts with 24-hour time format (HH:MM).
- **🌐 Full Ukrainian & English Localization**:
  - Instant language switching between Українська and English in Settings with automatic persistence.
- **⚙️ Standalone Schedule Editor & Data Management**:
  - Open and edit timetable directly in Settings without needing an image upload.
  - Export registered subjects to clean JSON format.
  - Granular data cleanup: "Delete Schedule Only" or full "Delete All Data" with confirmation safeguards.
- **📊 Subject Statistics**:
  - Interactive weekly charts powered by Recharts showing total study hours and busiest subjects.
- **🎨 Appearance**:
  - Default dark theme with calm neutral tones and smooth light/dark toggle.
- **📱 Mobile-First Design**:
  - Fully responsive with mobile bottom navigation bar and adaptive card layouts.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query 5, Recharts, Lucide Icons |
| **Backend** | FastAPI (Python 3.12), SQLAlchemy 2.0 (Async), Alembic, Pydantic v2 |
| **Database** | PostgreSQL 16+ (Alpine) |
| **Reverse Proxy** | Nginx Alpine (serves SPA and proxies /api) |
| **AI Import** | Prompt-driven JSON import (ChatGPT / Claude / Gemini Web) |
| **Containerization** | Docker & Docker Compose |

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### 1. Configuration
Create a .env file in the project root:

```env
POSTGRES_USER=diary_user
POSTGRES_PASSWORD=diary_pass
POSTGRES_DB=diary_db
POSTGRES_HOST=db
POSTGRES_PORT=5432

SEMESTER_START_DATE=2026-09-01
```

### 2. Run with Docker Compose
To start the entire application stack:

```bash
docker compose up --build -d
```

The services will be available at:
- **Web Application**: [http://localhost:8080](http://localhost:8080)
- **API Swagger Docs**: [http://localhost:8080/docs](http://localhost:8080/docs)

### 3. Stop the Application
```bash
docker compose down
```

---

## 📁 Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── database.py         # Async database session engine
│   │   ├── main.py             # FastAPI entrypoint & middleware
│   │   ├── models.py           # SQLAlchemy 2.0 data models
│   │   ├── schemas.py          # Pydantic validation schemas
│   │   ├── routers/
│   │   │   ├── bells.py        # Bell schedule endpoints
│   │   │   ├── homework.py     # Homework CRUD
│   │   │   ├── schedule.py     # Timetable rules & JSON import
│   │   │   └── subjects.py     # Subjects management
│   │   └── services/           # Schedule services
│   ├── alembic/                # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                # API client & queries
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ai-import/      # AI JSON modal & preview
│   │   │   ├── homework/       # Homework inline editing
│   │   │   ├── layout/         # Sidebar, BottomNav, ThemeToggle
│   │   │   └── schedule/       # Lesson cards & week columns
│   │   ├── i18n/               # Ukrainian & English translations
│   │   ├── pages/              # Daily, Diary, Bells, Stats, Settings
│   │   └── types/              # TypeScript interfaces
│   ├── Dockerfile
│   ├── nginx.conf              # SPA fallback & API proxy
│   └── package.json
├── docker-compose.yml
├── UPDATES.md                  # Release changelog
└── README.md
```

---

## 📄 License
MIT License
