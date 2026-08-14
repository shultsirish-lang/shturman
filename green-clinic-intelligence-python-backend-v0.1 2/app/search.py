import re
import unicodedata
from .models import Card

def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").lower().replace("ё", "е")
    value = re.sub(r"[^\w\s-]+", " ", value, flags=re.UNICODE)
    return " ".join(value.split())

def score(card: Card, query: str) -> int:
    q = normalize(query)
    if not q:
        return 0
    tokens = q.split()
    title = normalize(card.title)
    keywords = " ".join(normalize(x) for x in card.keywords)
    quick = normalize(card.quick)
    answer = normalize(card.patient_answer)
    doctor = normalize(card.doctor)
    module = normalize(card.module)
    kind = normalize(card.kind)
    code = normalize(card.code)

    s = 0
    if title == q:
        s += 1000
    if title.startswith(q):
        s += 400
    if q in title:
        s += 250
    if q in keywords:
        s += 180
    if q in quick:
        s += 100
    if q in doctor:
        s += 100
    if q in module or q in kind or q in code:
        s += 70
    if q in answer:
        s += 40

    # Token fallback: useful for multi-word patient phrases.
    searchable = f"{title} {keywords} {quick} {answer} {doctor} {module} {kind} {code}"
    matched = sum(1 for token in tokens if token in searchable)
    s += matched * 15
    if tokens and matched == len(tokens):
        s += 40
    return s

def search(cards: list[Card], query: str, module: str | None = None, limit: int = 20) -> list[Card]:
    pool = cards
    if module:
        wanted = normalize(module)
        pool = [c for c in pool if normalize(c.module) == wanted]

    ranked = [(score(c, query), c) for c in pool]
    ranked = [(s, c) for s, c in ranked if s > 0]
    ranked.sort(key=lambda item: (-item[0], item[1].title))
    return [c for _, c in ranked[:limit]]
