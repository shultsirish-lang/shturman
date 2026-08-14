from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CardBase(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=100)
    module: str = ""
    kind: str = ""
    title: str = Field(min_length=1)
    quick: str = ""
    patient_answer: str = ""
    ask: list[str] = Field(default_factory=list)
    dont: list[str] = Field(default_factory=list)
    next: str = ""
    price: str | int | float | None = ""
    code: str = ""
    keywords: list[str] = Field(default_factory=list)
    urgency: str = ""
    prep: str = ""
    doctor: str = ""
    source: str = ""
    related: list[str] = Field(default_factory=list)
    priority: str = ""
    audience: str = ""
    duration: str = ""
    patient_phrases: list[str] = Field(default_factory=list)


class Card(CardBase):
    updated_at: datetime | None = None


class CardListResponse(BaseModel):
    total: int
    results: list[Card]


class SearchResponse(CardListResponse):
    query: str


class KnowledgeImport(BaseModel):
    schema_version: str = ""
    data_version: str = ""
    deleted_ids: list[str] = Field(default_factory=list)
    cards: list[CardBase] = Field(min_length=1)


class ImportResponse(BaseModel):
    status: str
    inserted_or_updated: int
    deleted: int
    data_version: str
