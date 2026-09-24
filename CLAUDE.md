# server-ai — Progress

> Branch: `fix/instagram-api-db-sync`

## Stack

Brain: **GPT-6 Luna** · Image/Video: stub|http · Storage: S3/R2/local · **MCP: stdio tools**

## PROGRESS MAP

| Block | % |
|-------|---|
| Instagram + OAuth + queues (9) | 100 |
| Policy + Telegram + Luna agent | 90 |
| Webhook → agent · pipeline publish | 75–90 |
| Object Storage | 80 |
| HTTP generators · plan · strategy | 70 |
| **MCP server** | **80** |

**Infra ~92% · Product ~78%**

## MCP

```bash
npm run mcp
```

Tools: system_status, list_profiles, pending_reviews, sync_media, run_pipeline, run_plan_slot, run_strategy, publish_post, process_comment, process_dm, list_references, add_reference

See `src/mcp/CLAUDE.md`
