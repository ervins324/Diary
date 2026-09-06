import uuid
from pydantic import BaseModel, ConfigDict, Field

class SubjectCreate(BaseModel):
    name: str = Field(..., max_length=100)
    short_name: str = Field(..., max_length=30)
    color_hex: str = Field(default="#6B7280", max_length=7)
    default_cabinet: str | None = Field(default=None, max_length=20)

class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    short_name: str | None = Field(default=None, max_length=30)
    color_hex: str | None = Field(default=None, max_length=7)
    default_cabinet: str | None = Field(default=None, max_length=20)

class SubjectRead(BaseModel):
    id: uuid.UUID
    name: str
    short_name: str
    color_hex: str
    default_cabinet: str | None

    model_config = ConfigDict(from_attributes=True)
