# server-ai — Progress

> Branch: `fix/instagram-api-db-sync`  
> HEAD note: `необходимо доработать импорты и типы не совпадают со схемой`  
> Docs only — no code changes in this update.

## Stack

| Role | Provider |
|------|----------|
| Brain | **GPT-6 Luna** (OpenAI-compatible) |
| Image / Video | `stub` \| `http` |
| Storage | `local` \| `s3` \| `r2` \| `minio` |
| Queues | BullMQ + Redis (**9** queues) |
| Control plane | Telegram (webhook + **long polling in non-prod**) |
| MCP | **stdio** (`npm run mcp`) + **HTTP** `POST/GET/DELETE /mcp` |
| Deploy | `Dockerfile` + `docker-compose` (api + redis) |

## PROGRESS MAP

| Block | % | Notes |
|-------|---|--------|
| Instagram Graph + OAuth + dev mode | 100 | MARKER bootstrap when no HTTPS redirect |
| Webhooks + HMAC + idempotency | 100 | → agent queue |
| Publish pipeline + container poll | 100 | |
| Comments reconcile + Insights | 100 | |
| Policy Engine | 100 | |
| Luna agent (comment/DM) | 85 | fallback heuristics if no key |
| Telegram control plane | **95** | polling added (dev); webhook for prod |
| Object Storage | 80 | |
| Content pipeline + autoPublish | 75 | |
| HTTP image/video adapters | 70 | |
| Content plan + strategy agent | 70 | |
| MCP stdio | 80 | |
| **MCP Streamable HTTP `/mcp`** | **75** | Bearer `MCP_SERVER_TOKEN` |
| Docker compose | 70 | api+redis; DB external via `DATABASE_URL` |
| Per-profile cron schedules | 40 | |
| **TypeScript build / import hygiene** | **⚠️ broken** | see Known issues |

**Feature surface ~80% · Build health: needs fix before prod**

## Known issues (do not ignore)

Latest commit message on branch:

> «необходимо доработать импорты и типы не совпадают со схемой»

Observed drift to fix later (code change, not docs):

1. **Mixed import style** — some entrypoints use `.js` suffix (`src/index.ts`), many modules still extensionless; risk under `NodeNext` / Docker `dist/` layout.
2. **Prisma client path** — generated under `src/generated/prisma`; runtime imports via `prisma/prisma` must stay consistent after `prisma generate`.
3. **Schema vs application types** — enums/models in code may lag `prisma/schema.prisma` (regenerate + align agent/AI modules).
4. **Dockerfile CMD** — `node dist/src/index.js` depends on `tsconfig` `outDir`/`rootDir`; verify after `npm run build`.
5. **App Review / IG link** — product code assumes IG Business linked to Page; Graph tests need `instagram_business_account`.

## Queues (9)

`token-refresh` · `webhook` · `publish` · `container-status` · `media-sync` · `insights` · `comment-reconcile` · `agent` · `content-plan`

## Autonomous loops

```
Webhook → DB Comment/DM → agent queue → Luna → Policy → reply | Telegram

plan/pipeline → Luna scenario → gen → Object Storage → Post READY
  → [autoPublish] publish queue
```

## MCP

```bash
npm run mcp                    # stdio
# HTTP (API process):
# Authorization: Bearer $MCP_SERVER_TOKEN
# POST /mcp  (initialize + tools)
```

Env: `MCP_SERVER_TOKEN` (min 32 chars) enables HTTP MCP.

## Telegram

- **Production:** webhook (`TELEGRAM_WEBHOOK_URL`)
- **Non-production:** `startTelegramPolling()` from `src/index.ts` (long poll)

## Docker

```bash
docker compose up --build
# api :8000  redis :6379
# PostgreSQL not in compose — set DATABASE_URL in .env
```

## Module docs

| Path | Topic |
|------|--------|
| `src/infrastructure/queue/CLAUDE.md` | BullMQ |
| `src/infrastructure/storage/CLAUDE.md` | Object Storage |
| `src/modules/telegram/CLAUDE.md` | Control plane + polling |
| `src/modules/ai/CLAUDE.md` | Luna / generators / refs |
| `src/mcp/CLAUDE.md` | MCP stdio + HTTP |
| `src/modules/agent/CLAUDE.md` | Policy + agents |

## Next engineering (when allowed to change code)

1. Fix imports/types vs Prisma schema so `npm run build` passes
2. Align Docker dist path with tsconfig
3. Per-profile content cron
4. Real image/video vendor adapters as needed
