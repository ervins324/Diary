from datetime import datetime
from sqlalchemy import String, Boolean, Integer, JSON, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class AppSettings(Base):
    """
    Database-backed application settings.
    Stored centrally so all client devices, offline sync, background automation,
    and server-side schedule calculations work even when browser tabs are closed.
    """
    __tablename__ = "app_settings"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default="default")
    
    # Diary & Schedule Display Preferences
    skip_weekends_to_monday: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    day_shift_after_hour: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    show_cabinets: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    live_widget_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    live_widget_show_lesson: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    live_widget_show_homework: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    live_widget_show_events: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    hw_icon_size: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)

    # Air Raid Alerts Configuration (Neptun API)
    air_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    air_alerts_region: Mapped[str] = mapped_column(String(100), default="kyiv_city", nullable=False)
    air_alerts_auto_cancel: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Bells & Academic Timetable Preferences
    default_lesson_duration: Mapped[int] = mapped_column(Integer, default=45, nullable=False)
    default_break_duration: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    auto_bell_notifications: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    semester_anchor_date: Mapped[str] = mapped_column(String(20), default="2026-09-01", nullable=False)

    # Appearance & UI
    font_family: Mapped[str] = mapped_column(String(50), default="inter", nullable=False)
    theme: Mapped[str] = mapped_column(String(20), default="dark", nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="uk", nullable=False)

    # Dynamic Extensible Lists & Automation
    custom_event_types: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    custom_lesson_types: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    auto_clean_settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
