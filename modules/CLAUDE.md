# Application Modules

`modules/` — основной слой бизнес-модулей приложения.

## Домены

- `agent` — AI-агенты для комментариев и сообщений.
- `ai` — LLM, память, knowledge base, стратегия, контент-пайплайн и генерация медиа.
- `instagram` — OAuth, Graph API, media, comments, messages, content, insights и webhooks.
- `telegram` — Telegram control plane и ручная модерация.

## Правило зависимости

HTTP routes и Telegram handlers являются transport layer. Бизнес-операции должны находиться в services/agents/pipeline и переиспользоваться из разных transport layers.

MCP и Telegram используют общий executor инструментов, чтобы одна операция не имела две независимые реализации.

При изменении доменной логики сначала искать существующий service/tool, а не писать второй путь выполнения.
