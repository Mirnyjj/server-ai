# Comments Module

## Что сделано

### Graph API

| Method | Path |
|--------|------|
| GET | `/api/instagram/media/:mediaId/comments` |
| GET | `/api/instagram/comments/:commentId/replies` |
| POST | `/api/instagram/comments/:commentId/reply` `{ message }` |
| DELETE | `/api/instagram/comments/:commentId` |

### Reconciliation (TZ §18 — recovery fallback)

Webhook даёт near-real-time. Reconciliation — periodic/manual recovery, когда:
- webhooks недоступны (local dev без HTTPS)
- событие потеряно
- post появился в БД после webhook (comment deferred)

| Method | Path |
|--------|------|
| POST | `/api/instagram/comments/reconcile/post` `{ postId \| instagramMediaId }` |
| POST | `/api/instagram/comments/reconcile/profile` `{ profileId, limit? }` |
| POST | `/api/instagram/comments/reconcile/profile/async` → BullMQ |

### Как работает reconcile

```
1. Найти Post (status=PUBLISHED, есть instagramMediaId)
2. listComments(mediaId) с pagination (limit 50, maxPages)
3. upsert Comment по instagramId (idempotent)
4. Вернуть { fetched, created, updated }
```

Profile reconcile: последние N published постов (default 20).

### Входящие через webhook

```
Meta → webhook → enqueue → worker → upsert Comment
(если Post ещё нет — comment deferred, появится после media sync + reconcile)
```

## Файлы

- `comments.routes.ts`
- `comments.service.ts` — list/reply/delete + re-export reconcile
- `comments.reconciliation.ts` — Graph → DB upsert logic

## Не сделано

- Comment Agent (Claude → action/reply JSON)
- Policy Engine перед reply
- Auto-reply pipeline
