# Config

## env.ts

Zod-валидация env при старте. При ошибке — `process.exit(1)`.

### Режимы работы Instagram-интеграции

| Условие | Режим | OAuth | Webhooks | Токен |
|---------|-------|-------|----------|-------|
| `NODE_ENV=production` + HTTPS redirect | production | ✅ required | ✅ | DB encrypted |
| HTTPS `INSTAGRAM_REDIRECT_URI` + APP_ID/SECRET | oauth | ✅ | если VERIFY_TOKEN | DB |
| **нет redirect или не HTTPS** (и не production) | **local dev** | ❌ | ❌ | **INSTAGRAM_MARKER** |

### Helpers

```ts
isInstagramDevMode()  // true → local, без OAuth/webhooks
isOAuthEnabled()      // HTTPS redirect + APP_ID + APP_SECRET
isWebhooksEnabled()   // !devMode && VERIFY_TOKEN set
```

### Local dev `.env` (минимум)

```env
NODE_ENV=development
INSTAGRAM_TOKEN_ENCRYPTION_KEY=at-least-32-characters-long-key!!
INSTAGRAM_API_VERSION=v22.0
INSTAGRAM_MARKER=IGQWR...          # long-lived token from Meta
DATABASE_URL=postgresql://...
REDIS_URL=redis://127.0.0.1:6379
# INSTAGRAM_REDIRECT_URI=         # НЕ задавать или http://localhost → dev mode
# APP_ID / APP_SECRET не обязательны в dev mode
```

### Production `.env`

```env
NODE_ENV=production
INSTAGRAM_REDIRECT_URI=https://api.example.com/api/instagram/auth/callback
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=...
INSTAGRAM_TOKEN_ENCRYPTION_KEY=...
# INSTAGRAM_MARKER не использовать
```

### Dev bootstrap

```
POST /api/instagram/auth/dev/bootstrap
{ "profileId": "cuid-of-ai-profile" }

→ создаёт InstagramAccount + Connection из MARKER
→ дальше token.resolver читает из DB
```
