# server-ai — Autonomous AI Instagram Agent

## Что это

Backend для автономного управления Instagram-профилем AI-персонажа через **официальный Meta Graph API**.

Стек: Node.js · TypeScript · Fastify · Prisma · PostgreSQL · Redis · BullMQ · Anthropic Claude

## Соответствие ТЗ

| Блок ТЗ | Статус |
|---------|--------|
| OAuth + encrypted tokens + refresh | ✅ |
| Local dev mode (без HTTPS redirect) | ✅ |
| Graph API client | ✅ |
| Profile / Account / Media sync → DB | ✅ |
| Publish image/reel/carousel/story | ✅ |
| Container status polling (BullMQ) | ✅ |
| Webhooks (verify, signature, idempotency, queue) | ✅ |
| Comments API + webhook → DB | ✅ |
| DM send + webhook → DB | ✅ |
| BullMQ (6 очередей) | ✅ |
| **Insights** (media + account + PostMetric) | ✅ |
| Comment reconciliation (periodic) | ❌ next |
| Comment/DM Agent (Claude) | ❌ |
| Policy Engine | ❌ |
| InstagramProvider interface | ⚠️ partial |
| Object Storage / Media generators | ❌ |
| Telegram control plane | ❌ |
| MCP adapter | ❌ |

## Следующие приоритеты

1. **Comment reconciliation** — periodic sync comments as webhook fallback
2. **Policy Engine** — whitelist before any Meta API call from agent
3. **Comment / DM Agent** — Claude structured output → policy → API
4. **InstagramProvider interface**
5. Object Storage → generators → content plan
6. Telegram bot

## Local dev

Если `INSTAGRAM_REDIRECT_URI` не задан / не HTTPS → dev mode:
- OAuth и webhooks отключены
- Работает через `INSTAGRAM_MARKER`
- Bootstrap: `POST /api/instagram/auth/dev/bootstrap`

## Структура

См. `CLAUDE.md` в каждом модуле.
