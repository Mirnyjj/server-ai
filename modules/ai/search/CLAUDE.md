# Web Search

Web search предоставляет AI доступ к внешнему поиску через SearXNG.

- `search.service.ts` — основной search adapter.
- `index.ts` — public export.

SearXNG вызывается по `SEARXNG_BASE_URL`. Формат ответа JSON.

Основные параметры: query, limit, language, timeRange.

Telegram AI использует planner: сначала LLM решает, нужен ли web search и какой query выполнить, затем service получает результаты и добавляет их в LLM context.

Это не native tool calling: orchestration выполняется приложением.

Не передавать секреты в поисковый query. Результаты поиска являются внешним контекстом и не должны автоматически считаться достоверными фактами.
