# MCP Server (Model Context Protocol)

Exposes the Instagram AI agent as tools for Claude Desktop, Cursor, and other MCP clients.

## Run

```bash
npm install
npm run mcp
# or: npx tsx src/mcp/server.ts
```

Requires same env as API (`DATABASE_URL`, `REDIS_URL`, tokens, etc.).

## Claude Desktop / Cursor config

```json
{
  "mcpServers": {
    "ig-agent": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "/absolute/path/to/server-ai",
      "env": {
        "DATABASE_URL": "...",
        "REDIS_URL": "...",
        "INSTAGRAM_TOKEN_ENCRYPTION_KEY": "...",
        "INSTAGRAM_API_VERSION": "v21.0",
        "INSTAGRAM_MARKER": "..."
      }
    }
  }
}
```

After `npm run build`:

```json
{
  "command": "node",
  "args": ["dist/mcp/server.js"],
  "cwd": "/absolute/path/to/server-ai"
}
```

## Tools

| Tool | Description |
|------|-------------|
| `system_status` | Modes + pending counts |
| `list_profiles` | AI profiles + IG accounts |
| `pending_reviews` | requiresHuman comments/DMs |
| `sync_media` | Enqueue media sync |
| `run_pipeline` | Scenario → gen → storage → optional publish |
| `run_plan_slot` | Content plan slot |
| `run_strategy` | Update contentStrategy from metrics |
| `publish_post` | Publish READY post |
| `process_comment` | Luna comment agent |
| `process_dm` | Luna DM agent |
| `list_references` | Character reference pack |
| `add_reference` | Register face/body/style ref |

## Architecture

```
MCP client (stdio JSON-RPC)
  → src/mcp/server.ts
    → src/mcp/tools.ts
      → same services as REST API / BullMQ
```

No separate business logic — thin adapter.
