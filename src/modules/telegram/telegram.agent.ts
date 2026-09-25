import { getBrainLlm } from "../ai/llm/provider.js";
import { executeAgentTool, type AgentToolName } from "../../mcp/tools.js";

type PlannedCall = {
  tool: AgentToolName;
  arguments?: Record<string, unknown>;
};

const TOOL_DESCRIPTIONS = [
  "system_status: состояние системы",
  "list_profiles: список AI-профилей и Instagram",
  "pending_reviews: комментарии и Direct, ожидающие решения",
  "sync_media: синхронизация Instagram публикаций, args profileId",
  "run_pipeline: создать контент, args profileId, postType?, topicHint?, autoPublish?",
  "run_plan_slot: выполнить слот контент-плана, args profileId, postType?, topicHint?, autoPublish?, async?",
  "run_strategy: запустить анализ стратегии, args profileId, async?",
  "publish_post: опубликовать готовый пост, args postId",
  "process_comment: обработать комментарий AI-агентом, args commentId, async?",
  "process_dm: обработать Direct AI-агентом, args messageId, async?",
  "list_references: список референсов персонажа, args profileId",
  "add_reference: добавить референс, args profileId, url, type, description, priority?, tags?",
].join("\n");

export async function runTelegramAgent(input: {
  profileId: string;
  request: string;
}): Promise<string> {
  const plan = await getBrainLlm().completeJson<{
    calls?: PlannedCall[];
    reply?: string;
  }>({
    temperature: 0,
    maxTokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "Ты планировщик Telegram control plane для AI Instagram агента. Составь план действий только из разрешённых инструментов. Не придумывай IDs. Если для действия не хватает обязательного ID или параметра, не вызывай инструмент и объясни, какой параметр нужен. Для действий публикации, запуска pipeline с autoPublish=true и других необратимых операций используй autoPublish=true только если пользователь явно попросил опубликовать. Верни JSON: {"calls":[{"tool":"...","arguments":{}}],"reply":"..."}. Можно выполнить несколько независимых безопасных вызовов последовательно. Текущий profileId пользователя: " +
          input.profileId +
          "\n\nДоступные инструменты:\n" +
          TOOL_DESCRIPTIONS,
      },
      {
        role: "user",
        content: input.request,
      },
    ],
  });

  const calls = Array.isArray(plan.data.calls) ? plan.data.calls : [];

  if (calls.length === 0) {
    return plan.data.reply?.trim() || "Не удалось определить действие.";
  }

  const results: string[] = [];

  for (const call of calls.slice(0, 5)) {
    if (!call.tool) continue;

    const args = {
      ...(call.arguments ?? {}),
    };

    if (
      ["sync_media", "run_pipeline", "run_plan_slot", "run_strategy", "list_references"].includes(
        call.tool,
      ) &&
      typeof args.profileId !== "string"
    ) {
      args.profileId = input.profileId;
    }

    try {
      const result = await executeAgentTool(call.tool, args);
      results.push(
        `Инструмент ${call.tool}:\n${JSON.stringify(result, null, 2)}`,
      );
    } catch (error) {
      results.push(
        `Инструмент ${call.tool} завершился ошибкой: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const final = await getBrainLlm().completeText({
    temperature: 0.3,
    maxTokens: 1000,
    messages: [
      {
        role: "system",
        content:
          "Ты управляющий AI Instagram агентом через Telegram. Кратко сообщи пользователю, что было сделано по результатам вызовов инструментов. Не утверждай успешное выполнение, если инструмент вернул ошибку. Не выдумывай данные.",
      },
      {
        role: "user",
        content:
          "Запрос пользователя:\n" +
          input.request +
          "\n\nРезультаты инструментов:\n" +
          results.join("\n\n"),
      },
    ],
  });

  return final.trim() || results.join("\n\n");
}
