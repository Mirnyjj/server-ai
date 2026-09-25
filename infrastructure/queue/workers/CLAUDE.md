# Queue Workers

Эта папка содержит BullMQ workers. Worker получает job из Redis, выполняет длительную или фоновую операцию и отвечает за retry/failure logging.

## Архитектура

- `index.ts` регистрирует workers.
- Каждый `*.worker.ts` отвечает за один тип очереди.
- Очереди и типы job находятся уровнем выше в `../queues.ts` и `../types.ts`.
- Redis connection находится в `../connection.ts`.
- Бизнес-логику worker должен брать из модулей приложения, а не дублировать её.

## Workers

- `agent.worker.ts` — выполнение агентских задач.
- `comment-reconcile.worker.ts` — синхронизация/сверка комментариев Instagram.
- `container-status.worker.ts` — контроль статусов Instagram media containers.
- `content-plan.worker.ts` — фоновые задачи контент-плана.
- `insights.worker.ts` — сбор и обработка Instagram Insights.
- `media-sync.worker.ts` — синхронизация медиа Instagram с БД.
- `publish.worker.ts` — публикация готового Post в Instagram.
- `token-refresh.worker.ts` — обновление Instagram access tokens.
- `webhook.worker.ts` — обработка входящих webhook events.

## Правила

1. Не выполнять долгие операции непосредственно в HTTP/Telegram handler.
2. Job должна быть повторяемой: retry не должен создавать дубликаты публикаций или записей.
3. Ошибки должны попадать в лог и не теряться.
4. Состояние операции хранить в БД, если оно нужно после рестарта процесса.
5. Не хранить секреты в job payload.
6. Для публикации всегда проверять актуальный статус Post и Instagram connection.
7. При изменении queue payload синхронно обновлять типы, producer и worker.

## Связь с Telegram

Telegram может поставить задачу в очередь, но не должен ждать завершения тяжёлой генерации. После завершения worker может вызвать уведомление владельца через Telegram notification layer.
