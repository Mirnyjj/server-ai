import { getBrainLlm } from "../llm/provider.js";
import type { MemoryType } from "./memory.service.js";
import { addAgentMemory } from "./memory.service.js";

type ExtractedMemory = {
  type: MemoryType;
  text: string;
  importance: number;
};

export async function extractAndStoreMemories(input: {
  profileId: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  const result = await getBrainLlm().completeJson<{
    memories?: ExtractedMemory[];
  }>({
    temperature: 0.1,
    maxTokens: 700,
    messages: [
      {
        role: "system",
        content: [
          "Извлеки из разговора только устойчивые сведения, которые полезно помнить о владельце AI-профиля.",
          "Не сохраняй обычные вопросы, одноразовые задачи, приветствия, технические детали текущего диалога и предположения.",
          "Сохраняй предпочтения владельца, правила поведения, сведения о целевой аудитории, контенте, стратегии и другие долговременные факты.",
          "Каждая память должна быть коротким самостоятельным утверждением на русском языке.",
          "Если сохранять нечего, верни {"memories":[]}.",
          "importance: число от 0 до 1.",
          "Допустимые type: PERSONA, AUDIENCE, CONTENT, COMMENT, DM, PERFORMANCE, STRATEGY, PREFERENCE.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          userMessage: input.userMessage,
          assistantMessage: input.assistantMessage,
        }),
      },
    ],
  });

  for (const memory of result.data.memories ?? []) {
    const text = memory.text?.trim();

    if (!text) continue;

    await addAgentMemory({
      profileId: input.profileId,
      type: memory.type,
      text,
      importance: memory.importance,
    });
  }
}
