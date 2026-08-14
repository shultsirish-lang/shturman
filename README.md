# Green Clinic Intelligence

Полный стек: React + FastAPI + PostgreSQL, запускаемый в Docker.

```bash
docker compose up --build
```

После запуска:

- интерфейс: http://localhost:5173
- API и Swagger: http://localhost:8000/docs
- PostgreSQL: `localhost:5432` (пользователь/БД: `green_clinic`, пароль: `green_clinic`)

При первом старте backend автоматически импортирует 483 карточки из `db.json` в PostgreSQL. Данные сохраняются в Docker volume `postgres_data`.

## Обновление базы

`POST /admin/import` принимает JSON в том же формате, что и `db.json`. Загрузка идемпотентна: записи обновляются по `id`, новые добавляются. Чтобы удалить записи, передайте их идентификаторы в `deleted_ids`.

```bash
curl -X POST http://localhost:8000/admin/import \
  -H 'Content-Type: application/json' \
  --data-binary @db.json
```

Основные read endpoints: `GET /health`, `GET /modules`, `GET /cards`, `GET /cards/{id}`, `GET /search?q=колено`.

## Supabase Edge Functions

Для облачного варианта API доступна Edge Function `knowledge-api`. SQL-схема, RLS-политики и индексы находятся в `supabase/migrations`; чтение открыто только с publishable key, импорт требует secret key.

После авторизации в Supabase и привязки проекта:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy knowledge-api --use-api
```

Заполните базу через облачный endpoint, используя secret key (никогда не добавляйте его в frontend):

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/knowledge-api/admin/import' \
  -H 'apikey: YOUR_SECRET_KEY' \
  -H 'Content-Type: application/json' \
  --data-binary @db.json
```

Для отдельного static-хостинга React скопируйте `frontend/.env.example` в `.env` и задайте URL Edge Function и publishable key при сборке.
