# Profile Module

## Что сделано

Чтение Instagram-профиля и синхронизация `InstagramAccount` в PostgreSQL.

### Endpoints

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/instagram/profile` | Текущий профиль (token via resolver) |
| POST | `/api/instagram/accounts/sync` | Body `{ profileId }` → upsert account |

### Файлы

- `profile.routes.ts` — routes + token resolver
- `profile.service.ts` — `getProfile()` → client
- Использует `client/instagram.account.service.syncInstagramAccount`

## Как работает

1. `resolveAccessToken` / `resolveAccessTokenByProfileId`
2. `client.getProfile()` → fields: user_id, username, name, account_type, picture, counts
3. Upsert `InstagramAccount` по `instagramUserId`, обновляет `lastSyncedAt`

## Связь с ТЗ

§7 Instagram Account — модель и sync реализованы.
Account types BUSINESS/CREATOR приходят как string из API.
