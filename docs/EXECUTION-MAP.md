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
- [x] Image → Storage → public HTTPS E2E implementation
- [x] Automated unit tests
- [ ] Image → Storage → public HTTPS E2E production run
- [x] Kling → FFmpeg → Storage E2E implementation
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

- [x] E2E test foundation
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

1. Unit-test coverage was expanded for the HTTP video generator and FFmpeg audio/video preservation.
2. CI runs `npm test` and `npm run build` on `main`, `fix/**`, and pull requests.
3. CI is green: 16 automated tests pass and the TypeScript build passes. The FFmpeg test verifies video + audio preservation.
4. Instagram runtime token resolution currently prefers an active DB connection and falls back to `INSTAGRAM_MARKER`.
5. When `INSTAGRAM_MARKER` is removed, the existing DB-backed OAuth connection becomes the runtime source without another code migration.
6. Next task: run the real Instagram read verification with `npm run verify:instagram` once an OAuth-created DB connection is available. Then verify publishing, comments, DM and webhooks manually.

## Verification commands

```bash
npm test
npm run build
npm run e2e:media
npm run smoke
```

Production E2E commands require the corresponding production environment variables and must not be replaced by mocked values.
