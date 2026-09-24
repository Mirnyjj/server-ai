# BullMQ — 8 queues

| Queue | Jobs |
|-------|------|
| token-refresh | refresh tokens |
| webhook | Meta events → DB + **enqueue agent** |
| publish | create container + publish |
| container-status | poll FINISHED |
| media-sync | Graph → DB |
| insights | PostMetric |
| comment-reconcile | Graph comments → DB |
| **agent** | process-comment, process-direct-message |

## Autonomous loop

```
Meta webhook → webhook worker → upsert Comment/DM
  → enqueueProcessComment / enqueueProcessDirectMessage
    → agent worker → Luna → Policy → Graph API | Telegram
```

```
POST /api/ai/pipeline/run { autoPublish: true }
  → scenario → gen → storage → Post READY
  → enqueueCreateAndPublish (if HTTPS urls)
```
