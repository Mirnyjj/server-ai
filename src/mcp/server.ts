#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { ContentScenario } from "../modules/ai/content/scenario.types.js";
import * as tools from "./tools.js";

export const TOOL_DEFS = [
  {
    name: "system_status",
    description: "System status: Instagram mode, Luna, Telegram, storage, pending counts",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_profiles",
    description: "List AI profiles with linked Instagram accounts",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "pending_reviews",
    description: "Comments and DMs flagged requiresHuman",
    inputSchema: {
      type: "object" as const,
      properties: { limit: { type: "number", description: "Max items per type (default 10)" } },
    },
  },
  {
    name: "sync_media",
    description: "Enqueue Instagram media sync for a profile",
    inputSchema: {
      type: "object" as const,
      properties: { profileId: { type: "string" } },
      required: ["profileId"],
    },
  },
  {
    name: "run_pipeline",
    description: "Run content pipeline. Optional autoPublish.",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: { type: "string" },
        postType: { type: "string", enum: ["PHOTO", "REEL", "STORY", "CAROUSEL", "VIDEO"] },
        topicHint: { type: "string" },
        autoPublish: { type: "boolean" },
        async: { type: "boolean" },
      },
      required: ["profileId"],
    },
  },
  {
    name: "run_plan_slot",
    description: "Run one scheduled content plan slot",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: { type: "string" },
        postType: { type: "string", enum: ["PHOTO", "REEL", "STORY", "CAROUSEL", "VIDEO"] },
        topicHint: { type: "string" },
        autoPublish: { type: "boolean" },
        async: { type: "boolean" },
      },
      required: ["profileId"],
    },
  },
  {
    name: "run_strategy",
    description: "Analyze metrics and update content strategy",
    inputSchema: {
      type: "object" as const,
      properties: { profileId: { type: "string" }, async: { type: "boolean" } },
      required: ["profileId"],
    },
  },
  {
    name: "publish_post",
    description: "Enqueue Instagram publish for a READY post",
    inputSchema: {
      type: "object" as const,
      properties: { postId: { type: "string" } },
      required: ["postId"],
    },
  },
  {
    name: "process_comment",
    description: "Run Luna comment agent",
    inputSchema: {
      type: "object" as const,
      properties: { commentId: { type: "string" }, async: { type: "boolean" } },
      required: ["commentId"],
    },
  },
  {
    name: "process_dm",
    description: "Run Luna DM agent",
    inputSchema: {
      type: "object" as const,
      properties: { messageId: { type: "string" }, async: { type: "boolean" } },
      required: ["messageId"],
    },
  },
  {
    name: "list_references",
    description: "Character reference pack for a profile",
    inputSchema: {
      type: "object" as const,
      properties: { profileId: { type: "string" } },
      required: ["profileId"],
    },
  },
  {
    name: "add_reference",
    description: "Add character reference photo + description",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: { type: "string" },
        url: { type: "string" },
        type: { type: "string" },
        description: { type: "string" },
        priority: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["profileId", "url", "type", "description"],
    },
  },
  {
    name: "web_search",
    description: "Search the internet through the self-hosted SearXNG service",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        limit: { type: "number", description: "Maximum results, up to 20" },
        language: { type: "string", description: "Search language, e.g. ru or en" },
        timeRange: { type: "string", enum: ["day", "month", "year"] },
      },
      required: ["query"],
    },
  },
] as const;

type ToolArgs = Record<string, unknown>;

const POST_TYPES: readonly ContentScenario["postType"][] = [
  "PHOTO",
  "REEL",
  "STORY",
  "CAROUSEL",
  "VIDEO",
];

function isPostType(value: unknown): value is ContentScenario["postType"] {
  return typeof value === "string" && POST_TYPES.includes(value as ContentScenario["postType"]);
}

function requireString(args: ToolArgs, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalBoolean(args: ToolArgs, name: string): boolean | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${name} must be a boolean`);
  return value;
}

function optionalNumber(args: ToolArgs, name: string): number | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

function optionalString(args: ToolArgs, name: string): string | undefined {
  const value = args[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function optionalPostType(args: ToolArgs): ContentScenario["postType"] | undefined {
  const value = args.postType;
  if (value === undefined) return undefined;
  if (!isPostType(value)) {
    throw new Error("postType must be one of: PHOTO, REEL, STORY, CAROUSEL, VIDEO");
  }
  return value;
}

function optionalTags(args: ToolArgs): string[] | undefined {
  const value = args.tags;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("tags must be an array of strings");
  }
  return value;
}

function optionalTimeRange(args: ToolArgs): "day" | "month" | "year" | undefined {
  const value = args.timeRange;
  if (value === undefined) return undefined;
  if (value !== "day" && value !== "month" && value !== "year") {
    throw new Error("timeRange must be one of: day, month, year");
  }
  return value;
}

function textResult(data: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export function createMcpServer(): Server {
  const server = new Server(
    { name: "ig-agent-api", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args: ToolArgs = request.params.arguments ?? {};

    try {
      switch (name) {
        case "system_status":
          return textResult(await tools.executeAgentTool("system_status", args));
        case "list_profiles":
          return textResult(await tools.executeAgentTool("list_profiles", args));
        case "pending_reviews": {
          const limit = optionalNumber(args, "limit") ?? 10;
          if (limit < 1) throw new Error("limit must be greater than 0");
          return textResult(await tools.executeAgentTool("pending_reviews", { limit }));
        }
        case "sync_media":
        case "run_pipeline":
        case "run_plan_slot":
        case "run_strategy":
        case "publish_post":
        case "process_comment":
        case "process_dm":
        case "list_references":
        case "add_reference":
        case "web_search":
          return textResult(await tools.executeAgentTool(name, {
            ...args,
            ...(name === "run_pipeline" || name === "run_plan_slot"
              ? {
                  postType: optionalPostType(args),
                  topicHint: optionalString(args, "topicHint"),
                  autoPublish: optionalBoolean(args, "autoPublish"),
                  ...(name === "run_plan_slot" ? { async: optionalBoolean(args, "async") } : {}),
                }
              : {}),
            ...(name === "run_strategy" || name === "process_comment" || name === "process_dm"
              ? { async: optionalBoolean(args, "async") }
              : {}),
            ...(name === "add_reference"
              ? {
                  priority: optionalNumber(args, "priority"),
                  tags: optionalTags(args),
                }
              : {}),
            ...(name === "web_search"
              ? {
                  limit: optionalNumber(args, "limit"),
                  language: optionalString(args, "language"),
                  timeRange: optionalTimeRange(args),
                }
              : {}),
          } as ToolArgs));
        default:
          return errorResult(new Error(`Unknown tool: ${name}`));
      }
    } catch (error) {
      return errorResult(error);
    }
  });

  return server;
}

async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] ig-agent-api server connected (stdio)");
}

main().catch((error) => {
  console.error("[mcp] fatal", error);
  process.exit(1);
});
