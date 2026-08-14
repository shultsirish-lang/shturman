import json
from pathlib import Path
from .models import Card

class KnowledgeRepository:
    def __init__(self, path: Path):
        self.path = path
        self.reload()

    def reload(self) -> None:
        raw = json.loads(self.path.read_text(encoding="utf-8"))
        self.meta = raw
        self.cards = [Card.model_validate(x) for x in raw.get("cards", [])]
        self.by_id = {c.id: c for c in self.cards}

    @property
    def data_version(self) -> str:
        return str(self.meta.get("data_version", ""))

    def get(self, card_id: str) -> Card | None:
        return self.by_id.get(card_id)

    def modules(self) -> list[dict]:
        counts: dict[str, int] = {}
        for c in self.cards:
            counts[c.module] = counts.get(c.module, 0) + 1
        return [{"module": k, "count": v} for k, v in sorted(counts.items())]
