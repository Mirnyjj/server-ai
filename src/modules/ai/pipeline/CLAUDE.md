# Content Pipeline

```
POST /api/ai/pipeline/run
{ profileId, postType?, topicHint?, scenario? }

1. PolicyEngine.can(publishContent)
2. Luna → ContentScenario (or use provided scenario)
3. Reference pack (character consistency)
4. ImageGenerator | VideoGenerator
5. MediaAsset + PostMedia + Post(status=READY)
```

Publish to Instagram — отдельный шаг (`/api/instagram/content/*` или enqueueCreateAndPublish) с публичным URL.

Stub generators → `placeholder.local` URLs → `publishReady: false`.


Publishing policy: generated posts remain READY until an explicit human approval changes the post to APPROVED. The publish queue accepts APPROVED posts only; agent and MCP autoPublish requests are rejected deterministically.


`POST /api/ai/pipeline/run` supports `async: true`, which enqueues generation in BullMQ and returns `202 + jobId`. MCP `run_pipeline` also accepts `async: true`.
