# Config

## env.ts

Zod-валидация всех env variables при старте. При ошибке — `process.exit(1)`.

### Обязательные

```
INSTAGRAM_TOKEN_ENCRYPTION_KEY  # ≥32 chars
INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET
INSTAGRAM_REDIRECT_URI          # valid URL
DATABASE_URL
REDIS_URL
INSTAGRAM_API_VERSION           # e.g. v22.0
```

### Опциональные

```
NODE_ENV                        # development|test|production
API_HOST / API_PORT             # default 0.0.0.0:8000
OAUTH_STATE_TTL_SECONDS         # default 600
DIRECT_URL                      # Prisma adapter
INSTAGRAM_MARKER                # dev-only access token
INSTAGRAM_WEBHOOK_VERIFY_TOKEN  # required for webhook GET
INSTAGRAM_WEBHOOK_APP_SECRET    # fallback = APP_SECRET
```
