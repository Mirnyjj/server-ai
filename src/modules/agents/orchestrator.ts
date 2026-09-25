import { getBrainLlm } from "../ai/llm/provider.js";
import {
  AGENT_ROLE_DESCRIPTIONS,
} from "./agent.registry.js";
import { runSpecializedAgent } from "./agent.runner.js";
import type { AgentRole } from "./agent.types.js";

const ROLES: AgentRole[] = [
  "platform",
  "content",
  "analytics",
  "community",
];

export async function runAgentOrchestrator(input: {
  profileId: string;
  request: string;
  onPostGenerated?: (postId: string) => Promise<void>;
}): Promise<string> {
  const roleList = ROLES
    .map((role) => `- ${role}: ${AGENT_ROLE_DESCRIPTIONS[role]}`)
    .join("\n");

  const routing = await getBrainLlm().completeJson<{
    role?: AgentRole;
    reason?: string;
  }>({
    temperature: 0,
    maxTokens: 300,
    messages: [
      {
        role: "system",
        content: [
          "Ты — маршрутизатор AI-платформы.",
          "Определи одного специализированного агента, который должен обработать запрос владельца.",
          'Верни JSON: {"role":"platform|content|analytics|community","reason":"..."}.',
          "Выбирай только одну роль.",
          "platform — техническое администрирование и состояние платформы.",
          "content — создание и управление контентом.",
          "analytics — метрики, стратегия и анализ.",
          "community — комментарии и Direct.",
          "",
          "Роли:",
          roleList,
        ].join("\n"),
      },
      {
        role: "user",
        content: input.request,
      },
    ],
  });

  const role = routing.data.role;
  if (!role || !ROLES.includes(role)) {
    return "Не удалось определить специализированного агента для этого запроса.";
  }

  const result = await runSpecializedAgent({
    role,
    profileId: input.profileId,
    request: input.request,
    onPostGenerated: input.onPostGenerated,
  });

  return result.reply;
}
