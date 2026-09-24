# MCP Server (Model Context Protocol)

Exposes Instagram AI agent operations as MCP tools.

## Transports

### 1. stdio (Claude Desktop / Cursor local)

```bash
npm run mcp
# tsx src/mcp/server.ts
```

```json
{
  "mcpServers": {
    "ig-agent": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "/absolute/path/to/server-ai",
      "env": { "DATABASE_URL": "...", "REDIS_URL": "...", "...": "..." }
    }
  }
}
```

### 2. Streamable HTTP (API process)

Registered in `src/app.ts` → `registerMcpRoutes`.

| | |
|--|--|
| URL | `/mcp` |
| Methods | `GET`, `POST`, `DELETE` |
| Auth | `Authorization: Bearer ${MCP_SERVER_TOKEN}` |
| Session | header `mcp-session-id` after initialize |

```env
MCP_SERVER_TOKEN=<at least 32 characters>
```

Without token → `503 mcp_disabled`.  
Wrong/missing Bearer → `401`.

Implementation: `mcp.routes.ts` + `StreamableHTTPServerTransport` + `createMcpServer()` from `server.ts`.

## Tools

| Tool | Description |
|------|-------------|
| `system_status` | Modes + pending counts |
| `list_profiles` | AI profiles + IG |
| `pending_reviews` | requiresHuman |
| `sync_media` | Enqueue media sync |
| `run_pipeline` | Scenario → gen → storage → optional publish |
| `run_plan_slot` | Content plan slot |
| `run_strategy` | Update contentStrategy |
| `publish_post` | Publish READY post |
| `process_comment` | Luna comment agent |
| `process_dm` | Luna DM agent |
| `list_references` | Character pack |
| `add_reference` | Register ref photo + description |

## Architecture

```
MCP client
  → stdio server.ts  OR  HTTP /mcp
    → tools.ts
      → same services as REST / BullMQ
```

No separate business logic.

## Files

- `server.ts` — MCP server factory + stdio entry
- `tools.ts` — tool handlers
- `mcp.routes.ts` — HTTP transport on Fastify
