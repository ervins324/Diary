import uuid
from datetime import date
from pydantic import BaseModel, ConfigDict

class HolidayCreate(BaseModel):
    name: str
    start_date: date
    end_date: date

class HolidayUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None

class HolidayRead(BaseModel):
    id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    model_config = ConfigDict(from_attributes=True)

class AiParsedHoliday(BaseModel):
    name: str
    start_date: date
    end_date: date

class AiParseHolidaysResponse(BaseModel):
    holidays: list[AiParsedHoliday]

class JsonHolidaysParseRequest(BaseModel):
    raw_json: str

class HolidayBulkCommitRequest(BaseModel):
    holidays: list[HolidayCreate]

