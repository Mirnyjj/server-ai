# BullMQ Queue Infrastructure

BullMQ через Redis выполняет asynchronous/background jobs.

Workers находятся в `src/infrastructure/queue/workers`.

Правила:
1. Долгие операции не выполнять внутри HTTP/Telegram request.
2. Job должна быть retry-safe и idempotent.
3. Секреты не передавать в payload.
4. Состояние, необходимое после restart, хранить в БД.
5. При изменении payload синхронно обновлять producer, worker и TypeScript types.
6. Publish jobs обязаны проверять актуальный Post status и Instagram connection.

Generation jobs могут занимать минуты; transport layer должен поставить job в очередь и сообщить пользователю о состоянии, а не блокировать request.

Content generation uses the dedicated `content-generation` BullMQ queue. Async generation returns a job ID, Post remains `GENERATING` while the worker runs, and BullMQ retries failed jobs with the shared exponential backoff policy.
