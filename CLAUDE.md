# server-ai — Progress

> Branch: `fix/instagram-api-db-sync`

## AI stack

Brain: **GPT-6 Luna** · Image/Video: separate providers · Storage: S3/R2/local

## PROGRESS MAP

| Block | % |
|-------|---|
| Instagram Graph + OAuth + queues | 100 |
| Policy + Telegram | 90 |
| Luna agent decisions | 85 |
| References + scenarios | 80 |
| Object Storage | 80 |
| Content pipeline | 70 |
| **Webhook → auto agent** | **90** |
| **Pipeline → auto publish** | **75** |
| Real image/video models | 40 stub |

**Infra ~88% · Product ~70%**

## Autonomous flows now

1. **Inbound engagement**  
   Webhook → DB → agent queue → Luna → Policy → reply | Telegram escalate

2. **Outbound content**  
   `POST /api/ai/pipeline/run { profileId, autoPublish: true }`  
   → Luna scenario → gen → storage → publish queue

## Queues: 8

… + `agent` (process-comment, process-dm)

## Next

1. Real IMAGE_GENERATOR / VIDEO_GENERATOR adapters
2. Scheduled content plan (cron)
3. Strategy agent loop from insights
