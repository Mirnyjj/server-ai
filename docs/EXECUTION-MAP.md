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
- [ ] Kling → FFmpeg → Storage E2E
- [ ] Production E2E

## P1 — Production verification

- [ ] Instagram production verification
  - [ ] OAuth
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
- [ ] Remove runtime INSTAGRAM_MARKER fallback; DB connection becomes the single source of truth

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

1. Unit-test coverage was expanded for the HTTP video generator.
2. CI now runs `npm test` and `npm run build` on `main`, `fix/**`, and pull requests.
3. Next task: implement and run Kling → FFmpeg → Storage E2E.
4. After that: run image → Storage → public HTTPS against the real Timeweb/S3 environment.
5. Then move to production Instagram / Telegram verification.

## Verification commands

```bash
npm test
npm run build
npm run e2e:media
npm run smoke
```

Production E2E commands require the corresponding production environment variables and must not be replaced by mocked values.
