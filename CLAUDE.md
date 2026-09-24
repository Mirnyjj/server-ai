# server-ai — Progress

> Branch: `fix/instagram-api-db-sync`

## AI stack

| Role | Model |
|------|--------|
| Brain | GPT-6 Luna |
| Image | IMAGE_GENERATOR_* |
| Video | VIDEO_GENERATOR_* |
| Storage | S3 / R2 / MinIO / local |

## PROGRESS MAP

| Block | % |
|-------|---|
| Instagram Graph + OAuth + queues | 100 |
| Policy + Agent (Luna) + Telegram | 85–100 |
| References + scenarios + pipeline | 60–80 |
| **Object Storage** | **80** |
| Real image/video providers | 40 stub |
| Auto publish from pipeline | 30 |
| Webhook → auto agent | 0 |

**Infra ~85% · Product ~65%**

## Object Storage

```env
STORAGE_PROVIDER=r2   # local | s3 | r2 | minio
STORAGE_BUCKET=
STORAGE_ENDPOINT=https://<ACCOUNT>.r2.cloudflarestorage.com
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=https://cdn.example.com
```

Local: `STORAGE_PROVIDER=local` + `GET /media/*`  
Pipeline re-hosts generator output → public URL on our storage.

`GET /api/storage/status` · `POST /api/storage/ingest`

## Next

1. Real image/video adapters
2. pipeline → enqueueCreateAndPublish when publishReady
3. Webhook → processComment auto
