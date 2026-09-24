# Infrastructure

- `prisma.ts` — re-export Prisma client
- `redis.ts` — ioredis for BullMQ + OAuth state
- `queue/` — 7 BullMQ queues (см. `queue/CLAUDE.md`)

```bash
docker compose up -d redis
```
