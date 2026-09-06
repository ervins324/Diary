import uuid
from datetime import time
from pydantic import BaseModel, ConfigDict


class BellSlotBase(BaseModel):
    lesson_order: int
    start_time: time
    end_time: time
    name: str | None = None


class BellSlotCreate(BellSlotBase):
    pass


class BellSlotUpdate(BaseModel):
    lesson_order: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    name: str | None = None


class BellSlotRead(BellSlotBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class BellBulkCommitRequest(BaseModel):
    slots: list[BellSlotCreate]


class AiParsedBellSlot(BaseModel):
    order: int
    start_time: str
    end_time: str
    name: str | None = None


class AiParseBellsResponse(BaseModel):
    slots: list[AiParsedBellSlot]
