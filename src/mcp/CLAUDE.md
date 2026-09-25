# MCP

MCP предоставляет операции Instagram AI agent через Model Context Protocol.

## Transports
- stdio: `npm run mcp`, entrypoint `src/mcp/server.ts`.
- Streamable HTTP: `src/mcp/mcp.routes.ts`, endpoint `/mcp`, Bearer `MCP_SERVER_TOKEN`.

## Architecture
```
MCP transport → mcp/tools.ts → existing services / agents / queues
```
MCP не должен содержать отдельную реализацию бизнес-логики.

Основные tools: system status, profiles, pending reviews, sync media, content pipeline, plan slot, strategy, publish, comment/DM processing, references и web search.

При добавлении нового tool сначала проверить, существует ли соответствующий domain service. Tool должен быть тонким adapter.