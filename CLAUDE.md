# server-ai — Autonomous AI Instagram Agent

> Branch: `fix/instagram-api-db-sync` · Updated: 2026-09-24

---

## PROGRESS MAP (ТЗ)

| # | Блок ТЗ | Статус | % |
|---|---------|--------|---|
| 1 | Meta Graph API only (no instagrapi) | ✅ | 100 |
| 2 | OAuth + encrypted tokens + refresh | ✅ | 100 |
| 3 | Local dev mode (MARKER, no HTTPS) | ✅ | 100 |
| 4 | Graph client + API version env | ✅ | 100 |
| 5 | Profile / Account / Media sync → DB | ✅ | 100 |
| 6 | Publish image/reel/carousel/story | ✅ | 100 |
| 7 | Container status polling (BullMQ) | ✅ | 100 |
| 8 | Webhooks (verify, HMAC, idempotency) | ✅ | 100 |
| 9 | Comments API + reconciliation | ✅ | 100 |
| 10 | DM send + webhook → DB | ✅ | 100 |
| 11 | Insights → PostMetric | ✅ | 100 |
| 12 | BullMQ (7 queues) | ✅ | 100 |
| 13 | Policy Engine | ✅ | 100 |
| 14 | Comment / DM Agent pipeline | ✅ | 90 |
| 15 | **Telegram control plane** | ✅ | **85** |
| 16 | Claude real Anthropic | ❌ stub | 20 |
| 17 | Agent auto-trigger from webhook | ❌ | 0 |
| 18 | InstagramProvider interface | ⚠️ | 40 |
| 19 | Object Storage (S3/R2) | ❌ | 0 |
| 20 | Media generators | ❌ | 0 |
| 21 | Content Plan pipeline | ❌ | 0 |
| 22 | Strategy Agent | ❌ | 0 |
| 23 | AccountMetric model | ❌ | 0 |
| 24 | MCP adapter | ❌ | 0 |

**Overall MVP infrastructure: ~75%**  
**Full autonomous product (ТЗ end-to-end): ~55%**

---

## Telegram (только что)

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_CHAT_IDS=123456789
TELEGRAM_WEBHOOK_URL=https://your.api/api/telegram/webhook
```

| Feature | Status |
|---------|--------|
| Commands /status /pending /profiles /sync /connect | ✅ |
| Sensitive comment/DM alerts + inline Send/Ignore | ✅ |
| Agent → notify on escalate | ✅ |
| Webhook endpoint + setup | ✅ |
| Long polling (local without HTTPS) | ❌ later |

`GET /api/telegram/status` · `POST /api/telegram/test`

---

## Next priorities

1. Anthropic Claude (SDK already in package.json)
2. Webhook worker → auto `processComment` / `processDirectMessage`
3. Telegram long-polling for local dev
4. Object Storage + generators
5. Strategy Agent

---

## Queues (7)

token-refresh · webhook · publish · container-status · media-sync · insights · comment-reconcile

## Modules with CLAUDE.md

`config` · `crypto` · `infrastructure/queue` · `instagram/*` · `agent` · `agent/policy` · `telegram`
