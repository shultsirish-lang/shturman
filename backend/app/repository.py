from sqlalchemy import Text, delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .db_models import KnowledgeCard, KnowledgeMeta
from .models import Card, CardBase, KnowledgeImport


def as_card(row: KnowledgeCard) -> Card:
    return Card.model_validate({
        "id": row.id, "module": row.module, "kind": row.kind, "title": row.title,
        "quick": row.quick, "patient_answer": row.patient_answer, "urgency": row.urgency,
        **(row.data or {}), "updated_at": row.updated_at,
    })


def values(card: CardBase) -> dict:
    raw = card.model_dump(mode="json")
    return {
        "id": raw.pop("id"), "module": raw.pop("module"), "kind": raw.pop("kind"),
        "title": raw.pop("title"), "quick": raw.pop("quick"),
        "patient_answer": raw.pop("patient_answer"), "urgency": raw.pop("urgency"), "data": raw,
    }


async def import_knowledge(session: AsyncSession, payload: KnowledgeImport) -> tuple[int, int]:
    rows = [values(card) for card in payload.cards]
    statement = insert(KnowledgeCard).values(rows)
    updates = {name: getattr(statement.excluded, name) for name in ("module", "kind", "title", "quick", "patient_answer", "urgency", "data")}
    await session.execute(statement.on_conflict_do_update(index_elements=[KnowledgeCard.id], set_=updates))
    deleted = 0
    if payload.deleted_ids:
        result = await session.execute(delete(KnowledgeCard).where(KnowledgeCard.id.in_(payload.deleted_ids)))
        deleted = result.rowcount or 0
    await session.execute(insert(KnowledgeMeta).values(key="data_version", value=payload.data_version).on_conflict_do_update(index_elements=[KnowledgeMeta.key], set_={"value": payload.data_version}))
    await session.commit()
    return len(rows), deleted


async def get_card(session: AsyncSession, card_id: str) -> Card | None:
    row = await session.get(KnowledgeCard, card_id)
    return as_card(row) if row else None


async def list_cards(session: AsyncSession, module: str | None, kind: str | None, urgency: str | None, limit: int, offset: int) -> tuple[int, list[Card]]:
    filters = []
    for field, value in ((KnowledgeCard.module, module), (KnowledgeCard.kind, kind), (KnowledgeCard.urgency, urgency)):
        if value:
            filters.append(field == value)
    query = select(KnowledgeCard).where(*filters).order_by(KnowledgeCard.title)
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = (await session.scalars(query.limit(limit).offset(offset))).all()
    return total, [as_card(row) for row in rows]


async def search_cards(session: AsyncSession, query: str, module: str | None, limit: int) -> list[Card]:
    pattern = f"%{query.strip()}%"
    statement = select(KnowledgeCard).where(or_(
        KnowledgeCard.title.ilike(pattern), KnowledgeCard.quick.ilike(pattern),
        KnowledgeCard.patient_answer.ilike(pattern), KnowledgeCard.module.ilike(pattern),
        KnowledgeCard.kind.ilike(pattern), KnowledgeCard.data["keywords"].cast(Text).ilike(pattern),
    ))
    if module:
        statement = statement.where(KnowledgeCard.module == module)
    rows = (await session.scalars(statement.order_by(KnowledgeCard.title).limit(limit))).all()
    return [as_card(row) for row in rows]


async def modules(session: AsyncSession) -> list[dict]:
    rows = await session.execute(select(KnowledgeCard.module, func.count()).group_by(KnowledgeCard.module).order_by(KnowledgeCard.module))
    return [{"module": module, "count": count} for module, count in rows]
