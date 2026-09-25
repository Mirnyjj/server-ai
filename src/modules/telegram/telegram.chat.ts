import { prisma } from "../../../prisma/prisma.js";
import { getBrainLlm } from "../ai/llm/provider.js";
import { extractAndStoreMemories } from "../ai/memory/memory.extractor.js";
import { listAgentMemories, getMemoryText } from "../ai/memory/memory.service.js";
import { searchKnowledge } from "../ai/knowledge/knowledge.service.js";
import { formatWebSearchContext, searchWeb } from "../ai/search/search.service.js";

const activeProfiles = new Map<number, string>();

export async function setTelegramActiveProfile(
  chatId: number,
  profileId: string,
): Promise<void> {
  activeProfiles.set(chatId, profileId);

  await prisma.agentAction.create({
    data: {
      profileId,
      action: "telegram.profile.select",
      input: {
        chatId,
        profileId,
      },
      output: {
        profileId,
      },
      status: "SUCCESS",
    },
  });
}

export async function getTelegramActiveProfileId(
  chatId: number,
): Promise<string | null> {
  const cached = activeProfiles.get(chatId);

  if (cached) {
    return cached;
  }

  const actions = await prisma.agentAction.findMany({
    where: {
      action: "telegram.profile.select",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  for (const action of actions) {
    const input = asRecord(action.input);

    if (input?.chatId === chatId && typeof input.profileId === "string") {
      activeProfiles.set(chatId, input.profileId);
      return input.profileId;
    }
  }

  return null;
}

export async function askTelegramAi(input: {
  chatId: number;
  profileId: string;
  message: string;
}): Promise<string> {
  const profile = await prisma.aiProfile.findUnique({
    where: {
      id: input.profileId,
    },
  });

  if (!profile) {
    throw new Error("AI-профиль не найден");
  }

  const actions = await prisma.agentAction.findMany({
    where: {
      profileId: input.profileId,
      action: "telegram.chat",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 40,
  });

  const history = actions
    .slice()
    .reverse()
    .flatMap((action) => {
      const actionInput = asRecord(action.input);
      const actionOutput = asRecord(action.output);

      if (actionInput?.chatId !== input.chatId) {
        return [];
      }

      const messages: Array<{
        role: "user" | "assistant";
        content: string;
      }> = [];

      if (typeof actionInput?.message === "string") {
        messages.push({
          role: "user",
          content: actionInput.message,
        });
      }

      if (typeof actionOutput?.message === "string") {
        messages.push({
          role: "assistant",
          content: actionOutput.message,
        });
      }

      return messages;
    });

  const memories = await listAgentMemories(input.profileId, { take: 30 });
  const knowledge = await searchKnowledge(input.profileId, input.message, 6);

  let webResults: Awaited<ReturnType<typeof searchWeb>> = [];
  if (shouldSearchWeb(input.message)) {
    try {
      webResults = await searchWeb(input.message, {
        limit: 5,
        country: "RU",
        searchLang: "ru",
      });
    } catch (error) {
      console.error(
        "Web search failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const memoryContext =
    memories.length > 0
      ? memories
          .map(
            (memory) =>
              `- [${memory.type}] ${getMemoryText(memory.content)}`,
          )
          .join("\\n")
      : "Постоянная память пока пуста.";

  const knowledgeContext =
    knowledge.length > 0
      ? knowledge
          .map(
            (item) =>
              `- [${item.title}] ${item.content}${item.source ? ` (Источник: ${item.source})` : ""}`,
          )
          .join("\\n")
      : "Подходящих материалов базы знаний не найдено.";

  const webContext =
    webResults.length > 0
      ? formatWebSearchContext(webResults)
      : "Веб-поиск для этого сообщения не выполнялся.";

  const systemPrompt = [
    "Ты — AI-персонаж, которым пользователь управляет через приватный Telegram control plane.",
    "Отвечай как выбранный AI-профиль, учитывая его persona и writingStyle.",
    "Telegram-диалог является внутренним разговором с владельцем профиля, а не перепиской с подписчиком Instagram.",
    "Не утверждай, что выполнил действие в Instagram, если для него нет отдельной команды или инструмента.",
    "Если пользователь просит проанализировать контент, стратегию, идеи, аудиторию или публикации — отвечай предметно и используй доступный контекст профиля.",
    "Не раскрывай внутренние технические детали, если пользователь прямо не просит объяснить архитектуру.",
    "",
    "Пользовательский системный промпт профиля:",
    profile.systemPrompt?.trim() || "Не задан.",
    "",
    "Имя профиля: " + profile.name,
    "Persona: " + JSON.stringify(profile.persona),
    "Writing style: " + JSON.stringify(profile.writingStyle),
    "Content strategy: " + JSON.stringify(profile.contentStrategy),
    "",
    "Долговременная память профиля:",
    memoryContext,
    "",
    "База знаний. Используй её как справочный контекст и не выдумывай сведения, которых в ней нет:",
    knowledgeContext,
    "",
    "Актуальный веб-поиск. Если он присутствует, используй его для текущих сведений и явно отделяй найденные факты от предположений:",
    webContext,
  ].join("\n");

  try {
    const response = await getBrainLlm().completeText({
      temperature: 0.7,
      maxTokens: 1200,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...history,
        {
          role: "user",
          content: input.message,
        },
      ],
    });

    const answer = response.trim() || "Не удалось получить ответ от AI.";

    await prisma.agentAction.create({
      data: {
        profileId: input.profileId,
        action: "telegram.chat",
        input: {
          chatId: input.chatId,
          message: input.message,
        },
        output: {
          message: answer,
        },
        status: "SUCCESS",
      },
    });

    try {
      await extractAndStoreMemories({
        profileId: input.profileId,
        userMessage: input.message,
        assistantMessage: answer,
      });
    } catch (memoryError) {
      console.error(
        "Failed to extract Telegram memories:",
        memoryError instanceof Error ? memoryError.message : memoryError,
      );
    }

    return answer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Ошибка AI";

    await prisma.agentAction.create({
      data: {
        profileId: input.profileId,
        action: "telegram.chat",
        input: {
          chatId: input.chatId,
          message: input.message,
        },
        status: "FAILED",
        error: errorMessage,
      },
    });

    throw error;
  }
}

function shouldSearchWeb(message: string): boolean {
  const normalized = message.toLocaleLowerCase();

  return [
    "найди в интернете",
    "поищи в интернете",
    "поиск в интернете",
    "поищи в сети",
    "найди актуаль",
    "что сейчас",
    "на сегодня",
    "сегодня",
    "последние новости",
    "свежие новости",
    "актуальные новости",
    "тренды",
    "курс ",
    "цена сейчас",
    "сколько стоит сейчас",
    "последние обновления",
    "что изменилось",
  ].some((phrase) => normalized.includes(phrase));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
