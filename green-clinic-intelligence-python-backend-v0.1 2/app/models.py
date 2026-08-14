from typing import Any
from pydantic import BaseModel, ConfigDict, Field

class Card(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    module: str = ""
    kind: str = ""
    title: str
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

class SearchResponse(BaseModel):
    query: str
    total: int
    results: list[Card]

class HealthResponse(BaseModel):
    status: str
    data_version: str
    records: int
