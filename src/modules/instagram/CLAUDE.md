# Instagram API — Status (updated)

## Цель

Backend для AI Instagram-агента на официальном Instagram Graph API.
Используем Instagram Login / Business Login for Instagram, не `instagrapi` и не Facebook Login.

Архитектура:

HTTP route → service → instagram.client → Instagram Graph API

Токены: DB (encrypted) → fallback INSTAGRAM_MARKER (dev only).

## Что исправлено в ветке fix/instagram-api-db-sync

### 1. Env
- Добавлены `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `INSTAGRAM_MARKER` (optional), `DIRECT_URL` (optional), `INSTAGRAM_WEBHOOK_APP_SECRET`.

### 2. Token resolver
- `src/modules/instagram/auth/token.resolver.ts`
- Приоритет: Active InstagramConnection (decrypt) → INSTAGRAM_MARKER
- Все routes используют resolver вместо хардкода MARKER.

### 3. Webhooks (приоритет ТЗ)
- GET verification исправлен (сравнивает с `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`).
- POST: проверка `X-Hub-Signature-256` (HMAC-SHA256).
- Сохранение в `InstagramWebhookEvent` с idempotency по eventId.
- Обработка comments → upsert `Comment` (если Post уже в БД).
- Обработка messaging → upsert `DirectThread` + `DirectMessage`.

### 4. Types
- Убраны дубликаты в `instagram.types.ts`.

### 5. Pagination
- `listMedia` / `listComments` принимают `after` + `limit` и прокидывают в client.

### 6. Scopes
- CORE MVP: basic, content_publish, manage_comments, manage_insights, manage_messages.

### 7. Prisma
- `src/infrastructure/prisma.ts` реэкспортирует канонический клиент.

### 8. Content / Comments / Messages / Profile / Media routes
- Переведены на token resolver.
- Убраны debug console.log.
- Корректная обработка ошибок (400/500).

## Что осталось (следующие итерации)

1. Comment sync endpoint (listComments → DB upsert).
2. Insights module.
3. BullMQ: token refresh, container polling, webhook queue.
4. Persist Post + InstagramMediaContainer после publish.
5. Убрать INSTAGRAM_MARKER полностью после стабильного OAuth.
6. MCP adapter.
