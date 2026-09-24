# server-ai — Autonomous AI Instagram Agent

## Что это

Backend для автономного управления Instagram-профилем AI-персонажа через **официальный Meta Graph API**.
Управление через Telegram (control plane), autonomous jobs работают без Telegram.

Стек: Node.js · TypeScript · Fastify · Prisma · PostgreSQL · Redis · BullMQ · Anthropic Claude

## Соответствие ТЗ (на момент ветки fix/instagram-api-db-sync)

| Блок ТЗ | Статус | Где |
|---------|--------|-----|
| OAuth Instagram Login | ✅ | `modules/instagram/auth` |
| Encrypted tokens at rest | ✅ | `lib/crypto` + `InstagramConnection` |
| Token refresh (periodic) | ✅ | BullMQ `token-refresh` worker |
| Graph API client | ✅ | `modules/instagram/client` |
| Profile / Account sync | ✅ | profile + media services |
| Media list + DB sync | ✅ | `media.service.syncPosts` |
| Content publish (image/reel/carousel/story) | ✅ | content + publish queue |
| Container status polling | ✅ | `container-status` queue |
| Webhooks (verify + signature + idempotency) | ✅ | webhooks + `webhook` queue |
| Comments API (list/reply/delete) | ✅ | comments module |
| Comments → DB via webhook | ✅ | webhook worker |
| DM send | ✅ | messages module |
| DM → DB via webhook | ✅ | webhook worker |
| BullMQ infrastructure | ✅ | `infrastructure/queue` |
| Insights API + storage | ❌ | **следующий приоритет** |
| Comment Agent (Claude) | ❌ | |
| DM Agent + messaging window policy | ❌ | |
| Policy Engine | ❌ | |
| InstagramProvider abstraction | ⚠️ partial (client only) | |
| Object Storage (S3/R2) | ❌ | |
| Media generation | ❌ | |
| Content strategy agent | ❌ | |
| Telegram control plane | ❌ | |
| MCP adapter | ❌ | |

## Следующие приоритеты (по ТЗ)

1. **Insights module** — Graph API insights + `PostMetric` / AccountMetric, очередь сбора
2. **Comment reconciliation** — periodic sync комментариев (fallback к webhook)
3. **Policy Engine** — whitelist действий до любого Meta API call от агента
4. **Comment / DM Agent** — Claude structured output → policy → API
5. **InstagramProvider interface** — изоляция Agent от Graph API деталей
6. **Object Storage** — публичные URL для media containers
7. **Telegram bot** — control plane (connect, approve, escalate)

## Структура

```
src/
├── app.ts / index.ts / worker.ts
├── config/env.ts
├── infrastructure/
│   ├── prisma.ts
│   ├── redis.ts
│   └── queue/          # BullMQ
├── lib/crypto/         # AES-256-GCM token encryption
└── modules/instagram/
    ├── auth/
    ├── client/
    ├── profile/
    ├── media/
    ├── content/
    ├── comments/
    ├── messages/
    └── webhooks/
```

Каждый модуль содержит свой `CLAUDE.md` с описанием «что сделано» и «как работает».
