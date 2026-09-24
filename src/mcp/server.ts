#!/usr/bin/env node
/**
 * MCP Server — exposes Instagram AI agent operations as tools.
 * Transport: stdio (Claude Desktop, Cursor, etc.)
 *
 * Run: npm run mcp
 * Config example in src/mcp/CLAUDE.md
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as tools from "./tools";

const TOOL_DEFS = [
  {
    name: "system_status",
    description:
      "System status: Instagram mode, Luna, Telegram, storage, pending counts",
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
      properties: {
        limit: { type: "number", description: "Max items per type (default 10)" },
      },
    },
  },
  {
    name: "sync_media",
    description: "Enqueue Instagram media sync for a profile",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: { type: "string" },
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
        profileId: { type: "string" },
        postType: {
          type: "string",
          enum: ["PHOTO", "REEL", "STORY", "CAROUSEL", "VIDEO"],
        },
        topicHint: { type: "string" },
        autoPublish: { type: "boolean" },
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
        profileId: { type: "string" },
        postType: { type: "string" },
        topicHint: { type: "string" },
        autoPublish: { type: "boolean" },
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
        profileId: { type: "string" },
        async: { type: "boolean" },
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
        postId: { type: "string" },
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
        commentId: { type: "string" },
        async: { type: "boolean" },
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
        messageId: { type: "string" },
        async: { type: "boolean" },
      },
      required: ["messageId"],
    },
  },
  {
    name: "list_references",
    description: "Character reference pack for a profile (consistency)",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: { type: "string" },
      },
      required: ["profileId"],
    },
  },
  {
    name: "add_reference",
    description:
      "Add character reference photo + description (FACE, FULL_BODY, STYLE, …)",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: { type: "string" },
        url: { type: "string" },
        type: {
          type: "string",
          description: "FACE | FULL_BODY | STYLE | OUTFIT | LOCATION | LIGHTING | REFERENCE",
        },
        description: { type: "string" },
        priority: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["profileId", "url", "type", "description"],
    },
  },
];

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

const server = new Server(
  {
    name: "ig-agent",
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
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "system_status":
        return textResult(await tools.toolSystemStatus());

      case "list_profiles":
        return textResult(await tools.toolListProfiles());

      case "pending_reviews":
        return textResult(
          await tools.toolPendingReviews(
            typeof args.limit === "number" ? args.limit : 10,
          ),
        );

      case "sync_media": {
        if (typeof args.profileId !== "string") {
          throw new Error("profileId is required");
        }
        return textResult(await tools.toolSyncMedia(args.profileId));
      }

      case "run_pipeline": {
        if (typeof args.profileId !== "string") {
          throw new Error("profileId is required");
        }
        return textResult(
          await tools.toolRunPipeline({
            profileId: args.profileId,
            postType: args.postType as ContentScenario["postType"] | undefined,
            topicHint:
              typeof args.topicHint === "string" ? args.topicHint : undefined,
            autoPublish: Boolean(args.autoPublish),
          }),
        );
      }

      case "run_plan_slot": {
        if (typeof args.profileId !== "string") {
          throw new Error("profileId is required");
        }
        return textResult(
          await tools.toolRunPlanSlot({
            profileId: args.profileId,
            postType: args.postType as ContentScenario["postType"] | undefined,
            topicHint:
              typeof args.topicHint === "string" ? args.topicHint : undefined,
            autoPublish:
              args.autoPublish === undefined
                ? undefined
                : Boolean(args.autoPublish),
            async: Boolean(args.async),
          }),
        );
      }

      case "run_strategy": {
        if (typeof args.profileId !== "string") {
          throw new Error("profileId is required");
        }
        return textResult(
          await tools.toolRunStrategy({
            profileId: args.profileId,
            async: Boolean(args.async),
          }),
        );
      }

      case "publish_post": {
        if (typeof args.postId !== "string") {
          throw new Error("postId is required");
        }
        return textResult(await tools.toolPublishPost(args.postId));
      }

      case "process_comment": {
        if (typeof args.commentId !== "string") {
          throw new Error("commentId is required");
        }
        return textResult(
          await tools.toolProcessComment({
            commentId: args.commentId,
            async: Boolean(args.async),
          }),
        );
      }

      case "process_dm": {
        if (typeof args.messageId !== "string") {
          throw new Error("messageId is required");
        }
        return textResult(
          await tools.toolProcessDm({
            messageId: args.messageId,
            async: Boolean(args.async),
          }),
        );
      }

      case "list_references": {
        if (typeof args.profileId !== "string") {
          throw new Error("profileId is required");
        }
        return textResult(await tools.toolListReferences(args.profileId));
      }

      case "add_reference": {
        if (
          typeof args.profileId !== "string" ||
          typeof args.url !== "string" ||
          typeof args.type !== "string" ||
          typeof args.description !== "string"
        ) {
          throw new Error("profileId, url, type, description required");
        }
        return textResult(
          await tools.toolAddReference({
            profileId: args.profileId,
            url: args.url,
            type: args.type,
            description: args.description,
            priority:
              typeof args.priority === "number" ? args.priority : undefined,
            tags: Array.isArray(args.tags)
              ? (args.tags as string[])
              : undefined,
          }),
        );
      }

      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return errorResult(error);
  }
});

// Import type for postType only
import type { ContentScenario } from "../modules/ai/content/scenario.types";

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is MCP protocol
  console.error("[mcp] ig-agent server connected (stdio)");
}

main().catch((err) => {
  console.error("[mcp] fatal", err);
  process.exit(1);
});
