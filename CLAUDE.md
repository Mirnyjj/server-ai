# server-ai — Progress

> Branch: `fix/instagram-api-db-sync`

## Stack

| Role | Provider |
|------|----------|
| Brain | GPT-6 Luna |
| Image | stub \| **http** |
| Video | stub \| **http** |
| Storage | local \| s3 \| r2 \| minio |

## PROGRESS MAP

| Block | % |
|-------|---|
| Instagram API + OAuth + queues | 100 |
| Policy + Telegram + Luna agent | 90 |
| Webhook → auto agent | 90 |
| Object Storage | 80 |
| Pipeline + auto publish | 75 |
| **HTTP image/video adapters** | **70** |
| **Content plan slots** | **70** |
| **Strategy agent** | **70** |
| Cron schedules per profile | 40 |

**Infra ~90% · Product ~75%**

## New

```env
IMAGE_GENERATOR_PROVIDER=http
IMAGE_GENERATOR_BASE_URL=https://api.../v1/images/generations
IMAGE_GENERATOR_API_KEY=
IMAGE_GENERATOR_MODEL=

VIDEO_GENERATOR_PROVIDER=http
VIDEO_GENERATOR_BASE_URL=
VIDEO_GENERATOR_API_KEY=
```

```
POST /api/ai/plan/run-slot { profileId, autoPublish? }
POST /api/ai/plan/run-slot/async
POST /api/ai/strategy/run { profileId }
POST /api/ai/strategy/run/async
```

Strategy updates **contentStrategy only** (not Policy flags).

Queues: **9** (+ content-plan)
