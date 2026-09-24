# server-ai — Progress

> Branch: `fix/instagram-api-db-sync` · 2026-09-24

## AI stack

| Role | Model |
|------|--------|
| Brain | **GPT-6 Luna** |
| Image | `IMAGE_GENERATOR_*` |
| Video | `VIDEO_GENERATOR_*` |

## PROGRESS MAP

| # | Block | % |
|---|-------|---|
| Instagram Graph + OAuth + dev mode | ✅ | 100 |
| Media sync / publish / webhooks / queues | ✅ | 100 |
| Comments reconcile + Insights | ✅ | 100 |
| Policy Engine | ✅ | 100 |
| Telegram control plane | ✅ | 85 |
| Character references API | ✅ | 80 |
| Luna scenarios + analytics | ✅ | 75 |
| **Agent → Luna decisions** | ✅ | **85** |
| **Content pipeline scenario→gen→Post** | ✅ | **60** |
| Image/Video real providers | stub | 40 |
| Object Storage | ❌ | 0 |
| Auto agent from webhook | ❌ | 0 |
| Publish from pipeline (auto) | ❌ | 20 |

**Infra ~82% · Product ~62%**

## New endpoints

```
POST /api/ai/pipeline/run
{ "profileId": "...", "postType": "PHOTO", "topicHint": "morning coffee" }

→ Luna scenario → generator → Post READY + MediaAssets
```

Agent comment/DM now call Luna (fallback if no key).

## Next

1. Object Storage (public URLs for Meta)
2. Real image/video adapters
3. pipeline → enqueueCreateAndPublish
4. Webhook → auto processComment
