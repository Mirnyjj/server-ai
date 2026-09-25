import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { env } from "../config/env.js";
import { createMcpServer } from "./server.js";

const sessions = new Map<string, StreamableHTTPServerTransport>();

function isAuthorized(authorization: string | undefined): boolean {
  if (!env.MCP_SERVER_TOKEN) {
    return false;
  }

  return authorization === `Bearer ${env.MCP_SERVER_TOKEN}`;
}

export async function registerMcpRoutes(app: FastifyInstance): Promise<void> {
  app.route({
    method: ["GET", "POST", "DELETE"],
    url: "/mcp",

    handler: async (request, reply) => {
      if (!env.MCP_SERVER_TOKEN) {
        return reply.code(503).send({
          error: "mcp_disabled",
          message: "MCP_SERVER_TOKEN is not configured",
        });
      }

      if (!isAuthorized(request.headers.authorization)) {
        return reply.code(401).send({
          error: "unauthorized",
        });
      }

      const sessionHeader = request.headers["mcp-session-id"];

      const sessionId =
        typeof sessionHeader === "string" ? sessionHeader : undefined;

      if (sessionId) {
        const transport = sessions.get(sessionId);

        if (!transport) {
          return reply.code(404).send({
            error: "mcp_session_not_found",
          });
        }

        await transport.handleRequest(request.raw, reply.raw, request.body);

        return reply;
      }

      if (request.method !== "POST") {
        return reply.code(400).send({
          error: "mcp_session_required",
        });
      }

      if (!isInitializeRequest(request.body)) {
        return reply.code(400).send({
          error: "mcp_initialize_required",
        });
      }

      let transport: StreamableHTTPServerTransport | undefined;

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),

        onsessioninitialized: (id: string) => {
          if (transport) {
            sessions.set(id, transport);
          }
        },
      });

      transport.onclose = () => {
        const id = transport?.sessionId;

        if (id) {
          sessions.delete(id);
        }
      };

      const server = createMcpServer();

      await server.connect(transport);

      await transport.handleRequest(request.raw, reply.raw, request.body);

      return reply;
    },
  });
}
