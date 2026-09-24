#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { ContentScenario } from "../modules/ai/content/scenario.types";
import * as tools from "./tools";

export const TOOL_DEFS = [
  {
    name: "system_status",
    description:
      "System status: Instagram mode, Luna, Telegram, storage, pending counts",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_profiles",
    description: "List AI profiles with linked Instagram accounts",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "pending_reviews",
    description: "Comments and DMs flagged requiresHuman",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max items per type (default 10)",
        },
      },
    },
  },
  {
    name: "sync_media",
    description: "Enqueue Instagram media sync for a profile",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: {
          type: "string",
        },
      },
      required: ["profileId"],
    },
  },
  {
    name: "run_pipeline",
    description:
      "Run content pipeline: Luna scenario → image/video gen → Object Storage → Post READY. Optional autoPublish.",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: {
          type: "string",
        },
        postType: {
          type: "string",
          enum: ["PHOTO", "REEL", "STORY", "CAROUSEL", "VIDEO"],
        },
        topicHint: {
          type: "string",
        },
        autoPublish: {
          type: "boolean",
        },
      },
      required: ["profileId"],
    },
  },
  {
    name: "run_plan_slot",
    description:
      "Run one scheduled content plan slot (uses contentStrategy topics/formats)",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: {
          type: "string",
        },
        postType: {
          type: "string",
          enum: ["PHOTO", "REEL", "STORY", "CAROUSEL", "VIDEO"],
        },
        topicHint: {
          type: "string",
        },
        autoPublish: {
          type: "boolean",
        },
        async: {
          type: "boolean",
          description: "If true, enqueue job instead of running sync",
        },
      },
      required: ["profileId"],
    },
  },
  {
    name: "run_strategy",
    description:
      "Strategy agent: analyze metrics and update contentStrategy (not policies)",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: {
          type: "string",
        },
        async: {
          type: "boolean",
        },
      },
      required: ["profileId"],
    },
  },
  {
    name: "publish_post",
    description: "Enqueue Instagram publish for a READY post",
    inputSchema: {
      type: "object" as const,
      properties: {
        postId: {
          type: "string",
        },
      },
      required: ["postId"],
    },
  },
  {
    name: "process_comment",
    description: "Run Luna comment agent (reply / ignore / escalate)",
    inputSchema: {
      type: "object" as const,
      properties: {
        commentId: {
          type: "string",
        },
        async: {
          type: "boolean",
        },
      },
      required: ["commentId"],
    },
  },
  {
    name: "process_dm",
    description: "Run Luna DM agent",
    inputSchema: {
      type: "object" as const,
      properties: {
        messageId: {
          type: "string",
        },
        async: {
          type: "boolean",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "list_references",
    description: "Character reference pack for a profile",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: {
          type: "string",
        },
      },
      required: ["profileId"],
    },
  },
  {
    name: "add_reference",
    description: "Add character reference photo + description",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: {
          type: "string",
        },
        url: {
          type: "string",
        },
        type: {
          type: "string",
        },
        description: {
          type: "string",
        },
        priority: {
          type: "number",
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: ["profileId", "url", "type", "description"],
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
  return (
    typeof value === "string" &&
    POST_TYPES.includes(value as ContentScenario["postType"])
  );
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

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${name} must be a boolean`);
  }

  return value;
}

function optionalNumber(args: ToolArgs, name: string): number | undefined {
  const value = args[name];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}

function optionalString(args: ToolArgs, name: string): string | undefined {
  const value = args[name];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }

  return value;
}

function optionalPostType(
  args: ToolArgs,
): ContentScenario["postType"] | undefined {
  const value = args.postType;

  if (value === undefined) {
    return undefined;
  }

  if (!isPostType(value)) {
    throw new Error(
      "postType must be one of: PHOTO, REEL, STORY, CAROUSEL, VIDEO",
    );
  }

  return value;
}

function optionalTags(args: ToolArgs): string[] | undefined {
  const value = args.tags;

  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error("tags must be an array of strings");
  }

  return value;
}

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${message}`,
      },
    ],
    isError: true,
  };
}

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: "ig-agent-api",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args: ToolArgs = request.params.arguments ?? {};

    try {
      switch (name) {
        case "system_status":
          return textResult(await tools.toolSystemStatus());

        case "list_profiles":
          return textResult(await tools.toolListProfiles());

        case "pending_reviews": {
          const limit = optionalNumber(args, "limit") ?? 10;

          if (limit < 1) {
            throw new Error("limit must be greater than 0");
          }

          return textResult(await tools.toolPendingReviews(Math.floor(limit)));
        }

        case "sync_media":
          return textResult(
            await tools.toolSyncMedia(requireString(args, "profileId")),
          );

        case "run_pipeline":
          return textResult(
            await tools.toolRunPipeline({
              profileId: requireString(args, "profileId"),
              postType: optionalPostType(args),
              topicHint: optionalString(args, "topicHint"),
              autoPublish: optionalBoolean(args, "autoPublish"),
            }),
          );

        case "run_plan_slot":
          return textResult(
            await tools.toolRunPlanSlot({
              profileId: requireString(args, "profileId"),
              postType: optionalPostType(args),
              topicHint: optionalString(args, "topicHint"),
              autoPublish: optionalBoolean(args, "autoPublish"),
              async: optionalBoolean(args, "async"),
            }),
          );

        case "run_strategy":
          return textResult(
            await tools.toolRunStrategy({
              profileId: requireString(args, "profileId"),
              async: optionalBoolean(args, "async"),
            }),
          );

        case "publish_post":
          return textResult(
            await tools.toolPublishPost(requireString(args, "postId")),
          );

        case "process_comment":
          return textResult(
            await tools.toolProcessComment({
              commentId: requireString(args, "commentId"),
              async: optionalBoolean(args, "async"),
            }),
          );

        case "process_dm":
          return textResult(
            await tools.toolProcessDm({
              messageId: requireString(args, "messageId"),
              async: optionalBoolean(args, "async"),
            }),
          );

        case "list_references":
          return textResult(
            await tools.toolListReferences(requireString(args, "profileId")),
          );

        case "add_reference":
          return textResult(
            await tools.toolAddReference({
              profileId: requireString(args, "profileId"),
              url: requireString(args, "url"),
              type: requireString(args, "type"),
              description: requireString(args, "description"),
              priority: optionalNumber(args, "priority"),
              tags: optionalTags(args),
            }),
          );

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
