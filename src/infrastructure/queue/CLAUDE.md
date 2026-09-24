# BullMQ Queue Infrastructure

## Что сделано

Полная инфраструктура очередей по ТЗ (token refresh, webhooks, publish, container polling, media sync).

### Очереди

| Queue | Jobs | Worker concurrency |
|-------|------|--------------------|
| `token-refresh` | refresh-connection, refresh-all-expiring | 2 |
| `webhook` | process-webhook-event | 5 |
| `publish` | publish-post, create-and-publish | 3 |
| `container-status` | poll-container | 5 |
| `media-sync` | sync-account-media | 2 |

### Файлы

```
queue/
├── types.ts          # QUEUE_NAMES, JOB_NAMES, payload types
├── connection.ts     # Redis connection options, defaultJobOptions
├── queues.ts         # Queue instances + enqueue* helpers
├── index.ts          # Public exports
├── README.md
└── workers/
    ├── index.ts                  # startWorkers / stopWorkers
    ├── token-refresh.worker.ts
    ├── webhook.worker.ts
    ├── publish.worker.ts
    ├── container-status.worker.ts
    └── media-sync.worker.ts
```

## Как работает

### Старт

- `src/index.ts` вызывает `startWorkers()` вместе с API
- Либо отдельный процесс: `npm run worker` → `src/worker.ts`

### Default job options

- attempts: 5
- backoff: exponential, 3s base
- removeOnComplete: 24h / 1000 jobs
- removeOnFail: 7 days

### Token refresh

Repeatable job каждые 6 часов: `refresh-all-expiring` (withinHours=48).
При ошибке refresh → connection.status = ERROR.

### Publish pipeline (async)

```
enqueueCreateAndPublish
  → create container
  → IMAGE/STORY: publish сразу, Post=PUBLISHED
  → REEL/VIDEO/CAROUSEL: enqueuePollContainer (15s delay)
       → poll every 30s, max 20 attempts
       → FINISHED → enqueuePublishPost
       → ERROR/EXPIRED/timeout → Post=FAILED
```

### Enqueue API

```ts
import {
  enqueueTokenRefresh,
  enqueueWebhookEvent,
  enqueueCreateAndPublish,
  enqueuePollContainer,
  enqueueMediaSync,
} from "./infrastructure/queue";
```

## Зависимости

- Redis (`REDIS_URL`, docker-compose service `redis`)
- bullmq ^6, ioredis ^6
