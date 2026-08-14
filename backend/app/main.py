import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import engine, get_session
from .db_models import Base, KnowledgeCard, KnowledgeMeta
from .models import Card, CardListResponse, ImportResponse, KnowledgeImport, SearchResponse
from .repository import get_card, import_knowledge, list_cards, modules, search_cards


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine) as session:
        count = await session.scalar(select(func.count()).select_from(KnowledgeCard)) or 0
        if not count:
            seed = json.loads(Path("/app/data/db.json").read_text(encoding="utf-8"))
            await import_knowledge(session, KnowledgeImport.model_validate(seed))
    yield
    await engine.dispose()


app = FastAPI(title="Green Clinic Intelligence API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health(session: AsyncSession = Depends(get_session)):
    records = await session.scalar(select(func.count()).select_from(KnowledgeCard)) or 0
    version = await session.get(KnowledgeMeta, "data_version")
    return {"status": "ok", "records": records, "data_version": version.value if version else ""}


@app.get("/modules")
async def get_modules(session: AsyncSession = Depends(get_session)):
    return await modules(session)


@app.get("/cards", response_model=CardListResponse)
async def cards(module: str | None = None, kind: str | None = None, urgency: str | None = None, limit: int = Query(80, ge=1, le=200), offset: int = Query(0, ge=0), session: AsyncSession = Depends(get_session)):
    total, results = await list_cards(session, module, kind, urgency, limit, offset)
    return {"total": total, "results": results}


@app.get("/cards/{card_id}", response_model=Card)
async def card(card_id: str, session: AsyncSession = Depends(get_session)):
    result = await get_card(session, card_id)
    if not result:
        raise HTTPException(status_code=404, detail="Card not found")
    return result


@app.get("/search", response_model=SearchResponse)
async def search(q: str = Query(min_length=1), module: str | None = None, limit: int = Query(80, ge=1, le=200), session: AsyncSession = Depends(get_session)):
    results = await search_cards(session, q, module, limit)
    return {"query": q, "total": len(results), "results": results}


@app.post("/admin/import", response_model=ImportResponse)
async def import_data(payload: KnowledgeImport, session: AsyncSession = Depends(get_session)):
    updated, deleted = await import_knowledge(session, payload)
    return {"status": "ok", "inserted_or_updated": updated, "deleted": deleted, "data_version": payload.data_version}
