# server-ai — Autonomous AI Instagram Agent

> Ветка: `fix/instagram-api-db-sync`  
> Аудит ТЗ: 2026-09-24

Backend для автономного управления Instagram AI-персонажем через **официальный Meta Graph API**.
Telegram — control plane; autonomous jobs работают без Telegram.

Стек: Node.js · TypeScript · Fastify · Prisma · PostgreSQL · Redis · BullMQ · Anthropic SDK (есть в deps, agent пока stub)

---

## Полная матрица ТЗ ↔ реализация

### §1–2 Цель и архитектура

| Требование | Статус | Где |
|------------|--------|-----|
| Official Meta Graph API only | ✅ | `modules/instagram/client` |
| No instagrapi / password / private API | ✅ | — |
| Node.js API + PostgreSQL + Redis/BullMQ | ✅ | `src/`, `prisma/`, `infrastructure/` |
| Python Instagram Worker удалён | ✅ | отсутствует в репо |
| Telegram control plane | ❌ | не начат |
| 24/7 autonomous jobs без Telegram | ⚠️ | workers есть; agent auto-trigger из webhook — нет |

### §3–4 Meta integration & permissions

| Требование | Статус |
|------------|--------|
| CORE MVP scopes в OAuth | ✅ `auth.service` |
| Graph version из env | ✅ `INSTAGRAM_API_VERSION` |

### §5–7 Auth, tokens, account

| Требование | Статус | Где |
|------------|--------|-----|
| OAuth flow | ✅ | `auth/` |
| Tokens encrypted at rest | ✅ | `lib/crypto` + `InstagramConnection` |
| Token refresh periodic | ✅ | BullMQ `token-refresh` |
| Connection statuses | ⚠️ | schema: ACTIVE/EXPIRED/REVOKED/ERROR (нет REAUTH_REQUIRED/DISABLED как в ТЗ) |
| InstagramAccount model | ✅ | Prisma |
| **Local dev без HTTPS redirect** | ✅ | `isInstagramDevMode()`, MARKER, bootstrap |

### §8–10 Client / Provider

| Требование | Статус |
|------------|--------|
| Meta client layer | ✅ `instagram.client.ts` |
| **InstagramProvider interface** (Agent не знает Graph) | ⚠️ partial — agent вызывает client напрямую |
| Centralized API version | ✅ |

### §11–12 Webhooks

| Требование | Статус |
|------------|--------|
| GET verify + POST events | ✅ |
| Signature X-Hub-Signature-256 | ✅ |
| Idempotency + raw event store | ✅ `InstagramWebhookEvent` |
| Queue processing | ✅ `webhook` queue |
| Soft-disable в local dev | ✅ |

### §13–17 Publishing

| Требование | Статус |
|------------|--------|
| Image / Reel / Carousel / Story containers | ✅ `content/` |
| Async processing + poll status | ✅ `container-status` queue |
| Post + InstagramMediaContainer DB | ✅ |
| Object Storage (S3/R2) public URL | ❌ |
| Media generators (image/video) | ❌ |
| Content Plan → Claude → Visual Brief | ❌ |

### §18–21 Comments + Policy + Agent

| Требование | Статус |
|------------|--------|
| Comments Graph API | ✅ |
| Webhook → Comment DB | ✅ |
| Periodic reconciliation | ✅ `comment-reconcile` |
| Comment Agent structured JSON | ✅ pipeline; **Claude = stub** |
| Policy Engine | ✅ `agent/policy` |
| Claude never calls Meta directly | ✅ |

### §22–25 Direct Messages

| Требование | Статус |
|------------|--------|
| Send DM API | ✅ |
| Webhook → Thread + Message DB | ✅ |
| DM Agent + Policy | ✅ pipeline; **Claude = stub** |
| 24h messaging window | ✅ heuristic |
| Sensitive → requiresHuman | ✅ |
| Telegram escalate UI | ❌ |
| Periodic DM reconciliation | ❌ |

### §26–29 Insights & Strategy

| Требование | Статус |
|------------|--------|
| Media insights → PostMetric JSON | ✅ |
| Account insights API | ✅ (без отдельной AccountMetric model) |
| Strategy Agent | ❌ |

### §30–33 AI Profile, Posts, state machine

| Требование | Статус |
|------------|--------|
| AiProfile model | ✅ |
| MediaReference | ✅ schema only |
| Post status machine | ✅ enum; partial transitions |
| AgentMemory / AgentAction | ✅ schema + agent writes AgentAction |

---

## Что сделано в этой ветке (changelog)

1. Token resolver (DB → MARKER)
2. Webhooks security + queue
3. Media sync → Post/MediaAsset/PostMedia
4. BullMQ: token-refresh, webhook, publish, container-status, media-sync, insights, comment-reconcile
5. Local dev mode без OAuth/webhooks
6. Insights module
7. Comment reconciliation
8. Policy Engine
9. Comment + DM Agent pipelines (stub classifier)
10. CLAUDE.md по модулям

---

## Очереди BullMQ (7)

| Queue | Назначение |
|-------|------------|
| token-refresh | refresh expiring tokens (repeat 6h) |
| webhook | process Meta events → DB |
| publish | create container + publish |
| container-status | poll FINISHED → publish |
| media-sync | Graph media → DB |
| insights | collect PostMetric |
| comment-reconcile | Graph comments → DB |

**Нет:** agent-process queue (comment/DM agent вызывается только HTTP вручную).

---

## CLAUDE.md карта

| Файл | Актуальность |
|------|--------------|
| `CLAUDE.md` (корень) | ✅ этот файл |
| `src/config/CLAUDE.md` | ✅ dev mode |
| `src/lib/crypto/CLAUDE.md` | ✅ |
| `src/infrastructure/CLAUDE.md` | ⚠️ не упоминает insights/comment-reconcile queues |
| `src/infrastructure/queue/CLAUDE.md` | ⚠️ устарел (5 queues вместо 7) |
| `src/modules/instagram/CLAUDE.md` | ⚠️ «осталось» устарело |
| `src/modules/instagram/auth/CLAUDE.md` | ✅ |
| `src/modules/instagram/client/CLAUDE.md` | ⚠️ нет insights methods |
| `src/modules/instagram/profile/CLAUDE.md` | ✅ |
| `src/modules/instagram/media/CLAUDE.md` | ✅ |
| `src/modules/instagram/content/CLAUDE.md` | ✅ |
| `src/modules/instagram/comments/CLAUDE.md` | ✅ reconcile |
| `src/modules/instagram/messages/CLAUDE.md` | ⚠️ не упоминает agent |
| `src/modules/instagram/webhooks/CLAUDE.md` | ✅ |
| `src/modules/instagram/insights/CLAUDE.md` | ✅ |
| `src/modules/agent/CLAUDE.md` | ✅ |
| `src/modules/agent/policy/CLAUDE.md` | ✅ |

---

## Приоритетный backlog (по ТЗ)

1. **Wire agent из webhook worker** — после upsert Comment/DM → enqueue processComment/processDM
2. **Real Anthropic Claude** — `@anthropic-ai/sdk` уже в package.json; заменить stubs
3. **InstagramProvider interface** — agent не импортирует client
4. **AccountMetric model** + persist account insights
5. **Object Storage** — публичные media URL
6. **Telegram bot** — connect, escalate requiresHuman, approve publish
7. **Strategy Agent** — анализ metrics → contentStrategy
8. **Media generators** + Content Plan pipeline

---

## Local dev (кратко)

```env
NODE_ENV=development
INSTAGRAM_MARKER=IGQWR...
# без INSTAGRAM_REDIRECT_URI (или не https) → dev mode
```

```
POST /api/instagram/auth/dev/bootstrap  { "profileId": "..." }
GET  /api/instagram/auth/status
```
