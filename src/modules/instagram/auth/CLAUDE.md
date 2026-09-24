# Auth Module

## Режимы

### Local dev mode (`isInstagramDevMode()`)

Включается, если `INSTAGRAM_REDIRECT_URI` не задан или не начинается с `https://` (и не production).

| Endpoint | Поведение |
|----------|-----------|
| `GET /api/instagram/auth/status` | `{ devMode: true, hasMarker, message }` |
| `POST /api/instagram/auth/dev/bootstrap` | Upsert Account+Connection из `INSTAGRAM_MARKER` |
| `GET /api/instagram/auth/login` | **503** `oauth_disabled` |
| `GET /api/instagram/auth/callback` | **503** `oauth_disabled` |

Все Graph API вызовы идут через `INSTAGRAM_MARKER` (или Connection, созданный bootstrap).

### OAuth mode

Нужны: HTTPS `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`.

1. `GET /login?profileId=` → state в Redis → redirect Meta
2. `GET /callback?code=&state=` → exchange → long-lived → encrypt → DB

## Файлы

| Файл | Роль |
|------|------|
| `auth.routes.ts` | status, dev/bootstrap, login, callback |
| `auth.service.ts` | OAuth URL + authorize (throws if OAuth disabled) |
| `dev-bootstrap.service.ts` | MARKER → getProfile → upsert account+connection |
| `token.resolver.ts` | DB token → MARKER fallback |
| `token.service.ts` | Meta token HTTP |
| `state.service.ts` | Redis OAuth state |
| `refresh.service.ts` | Refresh long-lived token |
| `account.repository.ts` / `connection.repository.ts` | Prisma upsert |

## Почему так (ТЗ + dev)

OAuth и webhooks **невозможны** без публичного HTTPS.
Локальная разработка не должна блокироваться: marker + bootstrap + sync API покрывают media/comments/content без Meta callbacks.
