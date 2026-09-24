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
