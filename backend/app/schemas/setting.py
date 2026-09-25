from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Any

class AppSettingsBase(BaseModel):
    skip_weekends_to_monday: bool = True
    day_shift_after_hour: int | None = None
    show_cabinets: bool = True
    live_widget_enabled: bool = True
    live_widget_show_lesson: bool = True
    live_widget_show_homework: bool = True
    live_widget_show_events: bool = True
    hw_icon_size: str = "medium"

    air_alerts_enabled: bool = False
    air_alerts_region: str = "kyiv_city"
    air_alerts_auto_cancel: bool = False

    default_lesson_duration: int = 45
    default_break_duration: int = 10
    auto_bell_notifications: bool = False
    semester_anchor_date: str = "2026-09-01"

    font_family: str = "inter"
    theme: str = "dark"
    language: str = "uk"

    custom_event_types: list[dict[str, Any]] = Field(default_factory=list)
    custom_lesson_types: list[dict[str, Any]] = Field(default_factory=list)
    auto_clean_settings: dict[str, Any] = Field(default_factory=dict)


class AppSettingsUpdate(BaseModel):
    skip_weekends_to_monday: bool | None = None
    day_shift_after_hour: int | None = None
    show_cabinets: bool | None = None
    live_widget_enabled: bool | None = None
    live_widget_show_lesson: bool | None = None
    live_widget_show_homework: bool | None = None
    live_widget_show_events: bool | None = None
    hw_icon_size: str | None = None

    air_alerts_enabled: bool | None = None
    air_alerts_region: str | None = None
    air_alerts_auto_cancel: bool | None = None

    default_lesson_duration: int | None = None
    default_break_duration: int | None = None
    auto_bell_notifications: bool | None = None
    semester_anchor_date: str | None = None

    font_family: str | None = None
    theme: str | None = None
    language: str | None = None

    custom_event_types: list[dict[str, Any]] | None = None
    custom_lesson_types: list[dict[str, Any]] | None = None
    auto_clean_settings: dict[str, Any] | None = None


class AppSettingsRead(AppSettingsBase):
    id: str = "default"
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class EffectiveDateResponse(BaseModel):
    date: str  # YYYY-MM-DD
    is_shifted: bool = False
    is_weekend_skipped: bool = False
    reason: str | None = None
