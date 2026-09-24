# BullMQ — 9 queues

| Queue | Jobs |
|-------|------|
| token-refresh | refresh connection / all expiring (repeat 6h) |
| webhook | Meta events → DB → **enqueue agent** |
| publish | create container + publish |
| container-status | poll until FINISHED |
| media-sync | Graph media → DB |
| insights | PostMetric |
| comment-reconcile | Graph comments → DB |
| agent | process-comment, process-direct-message |
| **content-plan** | content-plan-slot, strategy-run |

Workers started via `startWorkers()` from API (`src/index.ts`) or `src/worker.ts`.

## Autonomous loops

```
Meta webhook → webhook worker → upsert Comment/DM
  → enqueueProcessComment / enqueueProcessDirectMessage
    → agent worker → Luna → Policy → Graph | Telegram
```

```
POST /api/ai/pipeline/run { autoPublish: true }
  OR content-plan-slot job
  → scenario → gen → storage → Post READY
  → enqueueCreateAndPublish (HTTPS public URLs only)
```

```
strategy-run job
  → Luna analytics → update AiProfile.contentStrategy only
```

## Files

- `types.ts` — queue/job names + payloads
- `queues.ts` — Queue instances + enqueue helpers
- `workers/*` — one worker per domain
- `connection.ts` — Redis connection options
