# Content Plan

Content plan отвечает за планирование публикаций.

- `content-plan.service.ts` — бизнес-логика content plan.
- `plan.routes.ts` — HTTP endpoints.

Планирование должно оставаться отделённым от непосредственной генерации media. План определяет что/когда/в каком формате создавать; pipeline выполняет генерацию.

Очереди могут запускать plan jobs через `infrastructure/queue`.

При добавлении новых полей плана синхронно обновлять Prisma contract, service, routes и queue payload, если они затронуты.
