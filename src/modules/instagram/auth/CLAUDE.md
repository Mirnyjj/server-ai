# Auth Module

## Что сделано

Полный OAuth Instagram Login flow + хранение encrypted tokens + refresh.

### Файлы

| Файл | Роль |
|------|------|
| `auth.routes.ts` | `GET /api/instagram/auth/login`, `GET /api/instagram/auth/callback` |
| `auth.service.ts` | Authorization URL, code exchange, long-lived token, upsert account+connection |
| `token.service.ts` | HTTP calls: code→token, short→long-lived, refresh |
| `token.resolver.ts` | Resolve access token: DB connection → INSTAGRAM_MARKER |
| `state.service.ts` | OAuth state в Redis (TTL, one-time consume) |
| `refresh.service.ts` | Decrypt → refresh API → encrypt → update DB |
| `account.repository.ts` | Upsert `InstagramAccount` |
| `connection.repository.ts` | Upsert / find / update token `InstagramConnection` |
| `auth.types.ts` | Token response types |

## Как работает

### Connect flow

1. Client: `GET /api/instagram/auth/login?profileId=...`
2. Создаётся state в Redis (`instagram:oauth:state:{state}` → profileId)
3. Redirect на `https://www.instagram.com/oauth/authorize?...`
4. Meta callback → `GET /api/instagram/auth/callback?code=&state=`
5. State consume (atomic GET+DEL)
6. Exchange code → short-lived → long-lived token
7. `getProfile()` → upsert Account + Connection (token AES-256-GCM encrypted)

### Token resolution (runtime)

```
resolveAccessToken({ instagramUserId })
  1. Find InstagramAccount + ACTIVE Connection
  2. decryptSecret(accessTokenEncrypted)
  3. else INSTAGRAM_MARKER (dev)
  4. else throw
```

### Token refresh

- Manual: `refreshInstagramConnection(accountId)`
- Automatic: BullMQ job `refresh-all-expiring` every 6h (tokens expiring within 48h)

### Scopes (CORE MVP из ТЗ)

```
instagram_business_basic
instagram_business_content_publish
instagram_business_manage_comments
instagram_business_manage_insights
instagram_business_manage_messages
```

## Зависимости

- Redis (state)
- Prisma (`InstagramAccount`, `InstagramConnection`)
- `lib/crypto/secret.service` (encrypt/decrypt)
