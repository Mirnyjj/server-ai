# Specialized Agents

Модуль содержит специализированных LLM-агентов и их детерминированную маршрутизацию.

## Roles

- `platform` — административная и техническая часть платформы.
- `content` — контент, сценарии, генерация и подготовка публикаций.
- `analytics` — аналитика, стратегия и интерпретация метрик.
- `community` — комментарии, Direct и эскалация обращений.

## Architecture

```
Telegram / future transports
        ↓
Agent Orchestrator
        ↓
Specialized Agent
        ↓
allowed AgentTools
        ↓
existing services / queues
```

Orchestrator выбирает только одну роль для каждого запроса. Специализированный агент получает только свой allowlist инструментов.

Ограничения инструментов являются детерминированными и не зависят от решения LLM. Если модель пытается вызвать запрещённый tool, вызов отклоняется.

## Tool ownership

| Role | Responsibility |
|---|---|
| platform | system status, profiles, sync, references |
| content | pipeline, content-plan slot, references, web search |
| analytics | system status, profiles, strategy, web search |
| community | pending reviews, comment/DM processing, web search |

Не переносить бизнес-логику из существующих services в agents. Agents — orchestration/reasoning layer.

## Safety

Автопубликация по умолчанию запрещена. `run_pipeline` получает `autoPublish=false`, если пользователь явно не запросил публикацию.

Для нового инструмента сначала определить владельца-роли и добавить его в allowlist. После этого обновить этот документ.
