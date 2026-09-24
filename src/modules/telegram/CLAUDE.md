# Telegram Control Plane (TZ)

Telegram — **control plane only**. Autonomous jobs (publish, sync, agent) работают без Telegram.

## Env

```env
TELEGRAM_BOT_TOKEN=123:ABC          # from @BotFather
TELEGRAM_ALLOWED_CHAT_IDS=111,222   # your chat id(s), comma-separated
TELEGRAM_WEBHOOK_URL=https://api.example.com/api/telegram/webhook  # optional
```

Без `TELEGRAM_BOT_TOKEN` — модуль выключен, API 503, notifications no-op.

## Commands

| Command | Action |
|---------|--------|
| `/start` `/help` | Help |
| `/status` | Dev/OAuth mode, pending counts |
| `/profiles` | AI profiles + IG accounts |
| `/pending` | Comments/DMs with requiresHuman |
| `/sync <profileId>` | Enqueue media sync |
| `/connect <profileId>` | OAuth URL or bootstrap hint |

## Escalation alerts (TZ §25)

`notifySensitiveComment` / `notifySensitiveDm` → message with buttons:

- **Send suggested** → Graph API reply + mark replied
- **Ignore** → clear requiresHuman

Called from agent when policy denies with REQUIRES_HUMAN / SENSITIVE.

## HTTP

| Method | Path |
|--------|------|
| POST | `/api/telegram/webhook` — Telegram updates |
| GET | `/api/telegram/status` |
| POST | `/api/telegram/setup-webhook` |
| DELETE | `/api/telegram/webhook` |
| POST | `/api/telegram/test` |

## Setup

1. Create bot via @BotFather → token
2. Write to bot once → get chat id (`@userinfobot` or logs)
3. Set env + restart
4. Production: `POST /api/telegram/setup-webhook` with public HTTPS URL
5. Local: use polling later or ngrok → webhook

## Files

- `telegram.client.ts` — Bot API fetch wrapper
- `telegram.notify.ts` — outbound alerts
- `telegram.handlers.ts` — commands + callbacks
- `telegram.routes.ts` — Fastify routes
