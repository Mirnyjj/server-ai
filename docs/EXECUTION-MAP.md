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

## P1 — Production verification

- [ ] Instagram production verification
  - [x] DB-backed token resolution
  - [x] INSTAGRAM_MARKER runtime fallback retained temporarily
  - [x] Read-only verification script
  - [x] Marker-only read verification support
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

1. Automated E2E tests and scripts have been removed by request.
2. Unit tests remain enabled through `npm test`.
3. Instagram runtime token resolution prefers an active DB connection and falls back to `INSTAGRAM_MARKER`.
4. The Instagram production read verifier now works in marker-only mode; it can discover the Instagram user ID from `getProfile()` and does not require an OAuth DB connection while the marker is active.
5. The verifier remains read-only. Publish, comment reply, DM and webhook checks are not automated because they create real external side effects.
6. Next task: run the marker-based Instagram read verification in production, then continue with controlled manual write checks.

## Verification commands

```bash
npm test
npm run build
npm run smoke
npm run verify:instagram
```

For marker-only verification:

```npm
INSTAGRAM_MARKER=<production-access-token> npm run verify:instagram
```

On the production container, use the existing environment rather than putting the token directly into shell history.

Production verification commands require the corresponding production environment variables and must not be replaced by mocked values.
