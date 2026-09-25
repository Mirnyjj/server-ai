import { getBrainLlm } from "../ai/llm/provider.js";
import {
  executeAgentTool,
  type AgentToolName,
} from "../../mcp/tools.js";

const TOOL_DESCRIPTIONS: Record<AgentToolName, string> = {
  system_status: "получить состояние системы и счётчики",
  list_profiles: "получить список AI-профилей и подключённых Instagram",
  pending_reviews: "получить комментарии и Direct, требующие решения",
  sync_media: "запустить синхронизацию Instagram публикаций",
  run_pipeline: "создать контент через основной AI pipeline",
  run_plan_slot: "выполнить один слот контент-плана",
  run_strategy: "запустить анализ стратегии и метрик",
  publish_post: "поставить готовую публикацию в очередь Instagram",
  process_comment: "обработать комментарий агентом",
  process_dm: "обработать Direct-сообщение агентом",
  list_references: "получить reference pack персонажа",
  add_reference: "добавить reference персонажа",
  web_search: "найти актуальную информацию в интернете через SearXNG",
};

type PlannedCall = {
  tool: AgentToolName;
  arguments?: Record<string, unknown>;
};

type AgentPlan = {
  calls: PlannedCall[];
  reply?: string;
};

export async function runTelegramAgent(input: {
  profileId: string;
  request: string;
  onPostGenerated?: (postId: string) => Promise<void>;
}): Promise<string> {
  const toolList = Object.entries(TOOL_DESCRIPTIONS)
    .map(([name, description]) => `- ${name}: ${description}`)
    .join("\n");

  const plan = await getBrainLlm().completeJson<AgentPlan>({
    temperature: 0,
    maxTokens: 1200,
    messages: [
      {
        role: "system",
        content: [
          "Ты — диспетчер приватного Telegram control plane AI Instagram агента.",
          "Разбирай запрос владельца и при необходимости вызывай доступные инструменты.",
          "Верни только JSON формата {"calls":[{"tool":"...","arguments":{}}],"reply":"..."}.",
          "Используй только перечисленные инструменты. Не придумывай ID.",
          "Если для действия не хватает обязательного параметра, не вызывай инструмент: объясни, что нужно указать.",
          "Для действий с profileId используй текущий профиль, если пользователь явно не указал другой.",
          "Никогда не ставь autoPublish=true, если пользователь прямо не попросил опубликовать или автоматически опубликовать результат.",
          "web_search используй для актуальных данных, новостей, цен, документации и внешней информации.",
          "Можно выполнить несколько связанных инструментов последовательно, максимум 5.",
          "",
          "Доступные инструменты:",
          toolList,
        ].join("\n"),
      },
      {
        role: "user",
        content: input.request,
      },
    ],
  });

  const calls = Array.isArray(plan.data.calls) ? plan.data.calls.slice(0, 5) : [];

  if (calls.length === 0) {
    return plan.data.reply?.trim() || "Не удалось определить действие.";
  }

  const results: Array<{
    tool: AgentToolName;
    ok: boolean;
    result?: unknown;
    error?: string;
  }> = [];

  for (const call of calls) {
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

    if (
      call.tool === "run_pipeline" &&
      !("autoPublish" in args)
    ) {
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
          "Ты формируешь короткий отчёт владельцу Telegram control plane.",
          "Сообщи, какие действия выполнены, а какие завершились ошибкой.",
          "Не утверждай успех, если ok=false.",
          "Не выдумывай результаты.",
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

  return summary.trim() || JSON.stringify(results, null, 2);
}
