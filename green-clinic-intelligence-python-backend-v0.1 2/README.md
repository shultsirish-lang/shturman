# Green Clinic Intelligence — Python backend prototype

Это **не переписывание UI на Python**. Это отдельный backend-прототип, который использует текущий `MASTER JSON` Green Clinic Intelligence v2.4 (483 карточки).

## Зачем

Цель — дать backend-разработчику минимальную, понятную основу, которую можно критиковать, менять и развивать:
- отделённая база знаний;
- FastAPI;
- Pydantic-модель карточки;
- repository layer;
- отдельный search layer;
- REST API;
- Swagger/OpenAPI автоматически;
- никаких зависимостей от HTML-прототипа.

## Структура

```text
app/
  main.py        API endpoints
  models.py      модели данных
  repository.py  загрузка MASTER
  search.py      текущая простая поисковая логика
data/
  master.json    актуальная база (483 карточки)
tests/
  test_search.py
```

## Запуск

Python 3.11+.

```bash
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate       # Windows

pip install -r requirements.txt
uvicorn app.main:app --reload
```

После запуска:
- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`

## Примеры

```bash
curl "http://127.0.0.1:8000/health"
curl "http://127.0.0.1:8000/modules"
curl "http://127.0.0.1:8000/search?q=узи%20нервов"
curl "http://127.0.0.1:8000/search?q=укол%20в%20колено"
curl "http://127.0.0.1:8000/cards/TR-046"
```

## Что здесь намеренно НЕ сделано

Это архитектурный sandbox, а не production:
- нет авторизации;
- нет PostgreSQL;
- нет миграций;
- нет Redis/cache;
- нет vector/semantic search;
- нет LLM/RAG;
- нет интеграции с Клиентикс;
- нет audit log;
- нет CI/CD;
- нет автоматического обновления MASTER по URL.

## Что предлагается сыну оценить

1. Нужен ли PostgreSQL или для knowledge layer достаточно document storage.
2. Как разделить `knowledge`, `prices`, `services`, `doctors`, `routing`.
3. Какой search stack выбрать: PostgreSQL FTS / OpenSearch / Meilisearch / embeddings + hybrid.
4. Как версионировать карточки и делать rollback.
5. Как валидировать обновления до production.
6. Как организовать API для Штурмана.
7. Где должна жить бизнес-логика маршрутизации.
8. Нужен ли event/audit log.
9. Как безопасно подключить LLM, не отдавая ей принятие медицинских решений.
10. Как синхронизировать динамические данные Клиентикс отдельно от нашей knowledge base.

Текущий `search.py` специально простой. Его можно выбросить и написать заново — MASTER данные от этого не меняются.
