# Media Module

## Что сделано

Получение media из Graph API и **полная синхронизация в БД**:
`Post` + `MediaAsset` + `PostMedia` (включая carousel children).

### Endpoints

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/instagram/media?instagramUserId=&after=&limit=` | List media (pagination) |
| GET | `/api/instagram/media/:mediaId` | Single media |
| POST | `/api/instagram/media/sync` | Sync blocking `{ profileId }` |
| POST | `/api/instagram/media/sync/async` | Enqueue BullMQ job → 202 |

### Файлы

- `media.routes.ts`
- `media.service.ts` — `listMedia`, `getMedia`, `syncAccount`, `syncPosts`

## Как работает syncPosts

```
1. syncAccount(profileId) → upsert InstagramAccount
2. listMedia с pagination (limit 50, after cursor)
3. Для каждого media:
   - upsert Post (instagramMediaId unique)
   - type mapping: IMAGE→PHOTO, REELS→REEL, CAROUSEL_ALBUM→CAROUSEL
   - status = PUBLISHED
   - carousel: children → несколько MediaAsset + PostMedia
   - single: один MediaAsset + PostMedia
4. Обновить account.lastSyncedAt
5. При ошибке → account.lastError / lastErrorAt
```

Idempotent: повторный sync обновляет существующие записи, не дублирует.

## Очередь

`enqueueMediaSync({ profileId })` → worker `media-sync` вызывает тот же `syncPosts`.
