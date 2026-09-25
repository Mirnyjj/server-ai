# Release checklist

## Automated checks

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run smoke`
- [ ] `npm run verify:instagram`
- [ ] `npm run verify:telegram`
- [ ] `npm run queue:status`
- [ ] `GET /health` returns 200
- [ ] `GET /health/ready` returns 200

## Instagram

- [ ] Production read verification passed
- [ ] OAuth real-account flow verified
- [ ] Account/media synchronization verified
- [ ] Photo publish verified
- [ ] Reel publish verified
- [ ] Comment moderation verified
- [ ] DM moderation verified
- [ ] Webhook delivery verified
- [ ] Insights verified

## Telegram

- [ ] Bot API identity verified
- [ ] Webhook URL verified
- [ ] No Telegram webhook errors
- [ ] Production allowlist configured
- [ ] Incoming webhook accepted with the configured secret
- [ ] Unauthorized webhook request rejected
- [ ] Content approval verified
- [ ] Reject verified
- [ ] Regenerate verified
- [ ] Comment moderation notification verified
- [ ] DM moderation notification verified

## Queue / workers

- [ ] All expected queues are visible in `queue:status`
- [ ] No unexplained failed jobs
- [ ] No stuck active jobs
- [ ] Delayed jobs are expected
- [ ] Workers start successfully
- [ ] Redis readiness is healthy

## Observability

- [ ] Application logs are available
- [ ] Startup logs show worker count
- [ ] Instagram/Telegram integration errors are visible
- [ ] Queue failures are visible
- [ ] Database readiness is monitored
- [ ] Redis readiness is monitored

## Landing / infrastructure

- [ ] HTTPS certificate valid
- [ ] HTTP redirects to HTTPS
- [ ] Landing returns 200
- [ ] `/health` returns 200 through Nginx
- [ ] `/health/ready` returns 200 through Nginx
- [ ] `/mcp` remains protected
- [ ] Telegram webhook endpoint rejects invalid secret
- [ ] Smoke test passes against production

## Deployment / rollback

- [ ] Docker image built successfully
- [ ] Database migrations applied
- [ ] Containers healthy
- [ ] Previous image/tag identified for rollback
- [ ] Rollback command verified/documented
