# Infrastructure

## Что сделано

### prisma.ts

Реэкспорт канонического Prisma client из `prisma/prisma.ts`
(adapter-pg + DIRECT_URL).

Модули импортируют либо `prisma/prisma`, либо `infrastructure/prisma`.

### redis.ts

- `createRedisConnection()` / `getRedisConnection()` / `closeRedisConnection()`
- `maxRetriesPerRequest: null` — требование BullMQ
- Используется также OAuth state (`auth/state.service`)

### queue/

См. `queue/CLAUDE.md`.

## Docker

```bash
docker compose up -d redis   # port 6379, AOF persistence
```

PostgreSQL — внешний (DATABASE_URL / DIRECT_URL в env).
