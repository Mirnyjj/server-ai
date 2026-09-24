# Comments Module

## Что сделано

CRUD-операции с комментариями через Graph API.
Входящие комментарии из webhook сохраняются в `Comment` (через webhook worker).

### Endpoints

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/instagram/media/:mediaId/comments?after=&limit=` | List |
| GET | `/api/instagram/comments/:commentId/replies` | Replies |
| POST | `/api/instagram/comments/:commentId/reply` | Body `{ message }` |
| DELETE | `/api/instagram/comments/:commentId` | Delete |

### Файлы

- `comments.routes.ts`
- `comments.service.ts` → client methods

## Как работает входящий комментарий (ТЗ §18)

```
Meta Webhook
  → POST /api/instagram/webhook
  → persist InstagramWebhookEvent (idempotent)
  → enqueueWebhookEvent
  → webhook worker
  → upsert Comment (если Post с instagramMediaId найден)
```

## Не сделано (ТЗ §18–21)

- Periodic reconciliation (polling comments как recovery)
- Comment Agent (Claude → structured JSON action/reply)
- Policy Engine перед reply
- Auto-reply pipeline
