from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from .models import Card, SearchResponse, HealthResponse
from .repository import KnowledgeRepository
from .search import search

BASE_DIR = Path(__file__).resolve().parent.parent
repo = KnowledgeRepository(BASE_DIR / "data" / "master.json")

app = FastAPI(
    title="Green Clinic Intelligence API",
    version="0.1.0",
    description="Backend prototype over the Green Clinic Intelligence MASTER knowledge base."
)

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        data_version=repo.data_version,
        records=len(repo.cards),
    )

@app.get("/version")
def version():
    return {
        "schema_version": repo.meta.get("schema_version"),
        "data_version": repo.data_version,
        "record_count": len(repo.cards),
    }

@app.get("/modules")
def modules():
    return repo.modules()

@app.get("/cards/{card_id}", response_model=Card)
def get_card(card_id: str):
    card = repo.get(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card

@app.get("/search", response_model=SearchResponse)
def search_cards(
    q: str = Query(min_length=1),
    module: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
):
    results = search(repo.cards, q=q, module=module, limit=limit)
    return SearchResponse(query=q, total=len(results), results=results)

@app.post("/admin/reload")
def reload_master():
    # Prototype-only endpoint. Production must protect/remove it.
    repo.reload()
    return {"status": "reloaded", "data_version": repo.data_version, "records": len(repo.cards)}
