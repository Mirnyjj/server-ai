import { getBrainLlm } from "../ai/llm/provider.js";
import {
  executeAgentTool,
  type AgentToolName,
} from "../../mcp/tools.js";
import {
  AGENT_ROLE_DESCRIPTIONS,
  AGENT_TOOL_DESCRIPTIONS,
  AGENT_TOOLSETS,
  isToolAllowed,
} from "./agent.registry.js";
import type { AgentRole, AgentRunResult } from "./agent.types.js";

export async function runSpecializedAgent(input: {
  role: AgentRole;
  profileId: string;
  request: string;
  onPostGenerated?: (postId: string) => Promise<void>;
}): Promise<AgentRunResult> {
  const allowedTools = AGENT_TOOLSETS[input.role];
  const toolList = allowedTools
    .map((name) => `- ${name}: ${AGENT_TOOL_DESCRIPTIONS[name]}`)
    .join("\n");

  const plan = await getBrainLlm().completeJson<{
    calls?: Array<{
      tool: AgentToolName;
      arguments?: Record<string, unknown>;
    }>;
    reply?: string;
  }>({
    temperature: 0,
    maxTokens: 1200,
    messages: [
      {
        role: "system",
        content: [
          `Ты — специализированный AI-агент роли: ${input.role}.`,
          AGENT_ROLE_DESCRIPTIONS[input.role],
          "Работай только в рамках своей ответственности.",
          "Используй только разрешённые инструменты.",
          'Верни только JSON формата {"calls":[{"tool":"...","arguments":{}}],"reply":"..."}.',
          "Не придумывай ID, результаты, функции или инструменты.",
          "Если обязательного параметра нет, не вызывай инструмент и объясни, что нужно указать.",
          "Для действий с profileId используй текущий профиль, если пользователь не указал другой.",
          "Никогда не ставь autoPublish=true без прямой просьбы пользователя.",
          "Можно выполнить максимум 5 связанных вызовов.",
          "",
          "Разрешённые инструменты:",
          toolList,
        ].join("\n"),
      },
      {
        role: "user",
        content: input.request,
      },
    ],
  });

  const calls = Array.isArray(plan.data.calls)
    ? plan.data.calls.slice(0, 5)
    : [];

  if (calls.length === 0) {
    return {
      role: input.role,
      reply: plan.data.reply?.trim() || "Не удалось определить действие.",
      calls: [],
    };
  }

  const results: AgentRunResult["calls"] = [];

  for (const call of calls) {
    if (!isToolAllowed(input.role, call.tool)) {
      results.push({
        tool: call.tool,
        ok: false,
        error: `Инструмент ${call.tool} запрещён для роли ${input.role}`,
      });
      continue;
    }

    const args: Record<string, unknown> = {
      ...(call.arguments ?? {}),
    };

    if (
      !("profileId" in args) &&
      (
        call.tool === "sync_media" ||
        call.tool === "run_pipeline" ||
        call.tool === "run_plan_slot" ||
        call.tool === "run_strategy" ||
        call.tool === "list_references" ||
        call.tool === "add_reference"
      )
    ) {
      args.profileId = input.profileId;
    }

    if (call.tool === "run_pipeline" && !("autoPublish" in args)) {
      args.autoPublish = false;
    }

    try {
      const result = await executeAgentTool(call.tool, args);
      results.push({ tool: call.tool, ok: true, result });

      if (
        input.onPostGenerated &&
        call.tool === "run_pipeline" &&
        typeof result === "object" &&
        result !== null &&
        "postId" in result &&
        typeof result.postId === "string"
      ) {
        await input.onPostGenerated(result.postId);
      }
    } catch (error) {
      results.push({
        tool: call.tool,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = await getBrainLlm().completeText({
    temperature: 0.2,
    maxTokens: 1200,
    messages: [
      {
        role: "system",
        content: [
          `Ты формируешь отчёт специализированного агента роли ${input.role}.`,
          "Сообщи, какие действия выполнены, а какие завершились ошибкой.",
          "Не утверждай успех, если ok=false.",
          "Не выдумывай результаты.",
          "Если запрос выходит за ответственность агента, явно скажи это.",
          "Отвечай на русском.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          request: input.request,
          plannerReply: plan.data.reply ?? "",
          results,
        }),
      },
    ],
  });

  return {
    role: input.role,
    reply: summary.trim() || plan.data.reply?.trim() || "Готово.",
    calls: results,
  };
}
