# Execution map

Обновляем карту после каждого завершённого изменения. Статус означает состояние реализации в репозитории, а не факт успешного production-прогона.

## P0 — Production Readiness

- [x] Docker / Redis / env
- [x] Telegram webhook security
- [x] Instagram webhook signature
- [x] MCP auth
- [x] BullMQ generation
- [x] Publish approval / idempotency
- [x] Agent audit trail
- [x] Fal Video Generator
- [x] Responses API Image Generator
- [x] Reference images
- [x] Image aspect ratios
- [x] Reel audio preservation
- [x] Intermediate asset cleanup
- [x] Media download timeouts
- [x] Automated unit tests
- [ ] Production verification of image → storage → public HTTPS
- [ ] Production verification of Kling → FFmpeg → storage
- [ ] Production E2E

## P1 — Production verification

- [ ] Instagram production verification
  - [x] DB-backed token resolution
  - [x] INSTAGRAM_MARKER runtime fallback retained temporarily
  - [x] Read-only verification script
  - [ ] OAuth real-account flow
  - [ ] profile
  - [ ] media sync
  - [ ] photo publish
  - [ ] Reel publish
  - [ ] comments
  - [ ] DM
  - [ ] webhooks
  - [ ] insights
- [ ] Telegram production verification
  - [ ] webhook
  - [ ] approval
  - [ ] reject / regenerate
  - [ ] comment moderation
  - [ ] DM moderation
- [ ] Queue monitoring
- [ ] Observability

## P2 — Release

- [ ] Release checklist
- [ ] CI deployment verification
- [ ] Rollback procedure

## Landing

- [x] Adaptive landing
- [x] Animated atlas
- [x] Desktop / mobile
- [ ] Nginx / HTTPS verification
- [ ] Smoke test against production

## Current execution

1. E2E test scripts have been removed from the project by request.
2. The media pipeline itself remains implemented; its production verification is now tracked as a manual/production task rather than an automated E2E test.
3. Unit tests remain enabled through `npm test`.
4. Instagram runtime token resolution currently prefers an active DB connection and falls back to `INSTAGRAM_MARKER`.
5. When `INSTAGRAM_MARKER` is removed, the existing DB-backed OAuth connection becomes the runtime source without another token-resolution migration.
6. Next task: continue P1 production verification, starting with Instagram read-only verification while `INSTAGRAM_MARKER` remains active.

## Verification commands

```bash
npm test
npm run build
npm run smoke
npm run verify:instagram
```

Production verification commands require the corresponding production environment variables and must not be replaced by mocked values.
