# Telegram Control Plane (TZ)

Telegram — **control plane only**. Autonomous jobs (publish, sync, agent) work without Telegram.

## Env

```env
TELEGRAM_BOT_TOKEN=123:ABC
TELEGRAM_ALLOWED_CHAT_IDS=111,222
TELEGRAM_WEBHOOK_URL=https://api.example.com/api/telegram/webhook
```

Without `TELEGRAM_BOT_TOKEN` — module off, routes 503, notifications no-op.

## Transports

| Mode | When | Implementation |
|------|------|----------------|
| **Long polling** | `NODE_ENV !== production` | `telegram.polling.ts` started from `src/index.ts` |
| **Webhook** | Production / public HTTPS | `POST /api/telegram/webhook` |

Polling is **disabled in production** (use webhook).  
Do not run polling and webhook on the same bot token at once.

## Commands

| Command | Action |
|---------|--------|
| `/start` `/help` | Help |
| `/status` | Modes + pending counts |
| `/profiles` | AI profiles + IG |
| `/pending` | requiresHuman comments/DMs |
| `/sync <profileId>` | Enqueue media sync |
| `/connect <profileId>` | OAuth or bootstrap hint |

(Handlers may include extra chat helpers — see `telegram.handlers.ts` / `telegram.chat.ts`.)

## Escalation (TZ §25)

`notifySensitiveComment` / `notifySensitiveDm` → inline **Send suggested** / **Ignore**.  
Wired from agent when Policy returns REQUIRES_HUMAN / SENSITIVE / LOW_CONFIDENCE.

## HTTP

| Method | Path |
|--------|------|
| POST | `/api/telegram/webhook` |
| GET | `/api/telegram/status` |
| POST | `/api/telegram/setup-webhook` |
| DELETE | `/api/telegram/webhook` |
| POST | `/api/telegram/test` |

## Files

| File | Role |
|------|------|
| `telegram.client.ts` | Bot API |
| `telegram.notify.ts` | Outbound alerts |
| `telegram.handlers.ts` | Commands + callbacks |
| `telegram.polling.ts` | Dev long poll |
| `telegram.routes.ts` | Fastify |
| `telegram.chat.ts` | Chat helpers |

## Setup

1. @BotFather → token  
2. Message bot once → chat id  
3. Env + restart  
4. Local: polling starts automatically if token set and not production  
5. Prod: set webhook HTTPS URL  
