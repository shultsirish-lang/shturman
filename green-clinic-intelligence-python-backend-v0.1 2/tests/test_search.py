from pathlib import Path
from app.repository import KnowledgeRepository
from app.search import search

repo = KnowledgeRepository(Path("data/master.json"))

def test_unique_ids():
    assert len(repo.cards) == len(repo.by_id)

def test_search_returns_results():
    assert search(repo.cards, "узи", limit=5)

def test_known_domain_search():
    results = search(repo.cards, "гиалуроновая кислота", limit=10)
    assert results
