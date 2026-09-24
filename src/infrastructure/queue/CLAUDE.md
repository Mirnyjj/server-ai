# BullMQ Queue Infrastructure

## Очереди (7)

| Queue | Jobs | Concurrency |
|-------|------|-------------|
| `token-refresh` | refresh-connection, refresh-all-expiring | 2 |
| `webhook` | process-webhook-event | 5 |
| `publish` | publish-post, create-and-publish | 3 |
| `container-status` | poll-container | 5 |
| `media-sync` | sync-account-media | 2 |
| `insights` | collect-profile-insights, collect-post-insights | 2 |
| `comment-reconcile` | reconcile-profile-comments, reconcile-post-comments | 2 |

## Enqueue API

```ts
import {
  enqueueTokenRefresh,
  enqueueWebhookEvent,
  enqueueCreateAndPublish,
  enqueuePollContainer,
  enqueueMediaSync,
  enqueueCollectInsights,
  enqueueCommentReconciliation,
} from "./infrastructure/queue";
```

## Workers

`startWorkers()` в `src/index.ts` (или `npm run worker`).

Repeatable: token-refresh every 6h.

## Не сделано

- `agent` queue — processComment / processDM пока только HTTP
- Repeatable comment-reconcile / insights (можно добавить cron jobs)
