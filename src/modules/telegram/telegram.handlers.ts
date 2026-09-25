import { prisma } from "../../../prisma/prisma.js";
import {
  env,
  getTelegramAllowedChatIds,
  isInstagramDevMode,
  isOAuthEnabled,
  isTelegramEnabled,
} from "../../config/env.js";
import { resolveAccessTokenByProfileId } from "../instagram/auth/token.resolver.js";
import { createInstagramClient } from "../instagram/client/instagram.client.js";
import { createInstagramCommentsService } from "../instagram/comments/comments.service.js";
import { transcribeAudio } from "../ai/transcription/transcription.service.js";
import { searchWeb } from "../ai/search/search.service.js";
import {
  addAgentMemory,
  deleteAgentMemory,
  getMemoryText,
  listAgentMemories,
  searchAgentMemories,
  type MemoryType,
} from "../ai/memory/memory.service.js";
import {
  addKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  searchKnowledge,
  type KnowledgeSourceType,
} from "../ai/knowledge/knowledge.service.js";
import {
  answerCallbackQuery,
  downloadTelegramFile,
  editMessageText,
  getTelegramFile,
  sendTelegramMessage,
} from "./telegram.client.js";
import {
  askTelegramAi,
  getTelegramActiveProfileId,
  setTelegramActiveProfile,
} from "./telegram.chat.js";
import { AiProfile } from "../../generated/prisma/client.js";

export type TelegramPhotoSize = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    caption?: string;
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      username?: string;
    };
    photo?: TelegramPhotoSize[];
    video?: {
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      duration: number;
      file_size?: number;
      file_name?: string;
      mime_type?: string;
    };
    document?: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    voice?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    audio?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      performer?: string;
      title?: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: {
      id: number;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
      text?: string;
    };
  };
};

function isAuthorized(chatId: number): boolean {
  const allowed = getTelegramAllowedChatIds();

  if (allowed.length === 0) {
    // В режиме разработки разрешаем доступ, если список чатов не задан.
    return env.NODE_ENV !== "production";
  }

  return allowed.includes(chatId);
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
): Promise<void> {
  if (!isTelegramEnabled()) return;

  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  const msg = update.message;

  if (!msg) return;

  const chatId = msg.chat.id;

  if (!isAuthorized(chatId)) {
    await sendTelegramMessage(chatId, "⛔ Доступ запрещён.");
    return;
  }

  const text = (msg.text ?? msg.caption ?? "").trim();

  if (!text && hasTelegramMedia(msg)) {
    await handleTelegramMedia(chatId, msg);
    return;
  }

  if (!text) return;

  const [cmd, ...args] = text.split(/\s+/);
  const command = cmd.toLowerCase().split("@")[0];

  switch (command) {
    case "/start":
    case "/help":
      await sendTelegramMessage(chatId, HELP_TEXT);
      break;

    case "/status":
      await cmdStatus(chatId);
      break;

    case "/menu":
      await sendMainMenu(chatId);
      break;

    case "/search":
      await cmdSearch(chatId, text.slice(cmd.length).trim());
      break;

    case "/pending":
      await cmdPending(chatId);
      break;

    case "/profiles":
      await cmdProfiles(chatId);
      break;

    case "/sync":
      await cmdSync(chatId, args[0]);
      break;

    case "/connect":
      await cmdConnect(chatId, args[0]);
      break;
    case "/use":
      await cmdUse(chatId, args[0]);
      break;

    case "/ask":
      await cmdAsk(chatId, text.slice(cmd.length).trim());
      break;

    case "/prompt":
      await cmdPrompt(chatId, text.slice(cmd.length).trim());
      break;

    case "/memory":
      await cmdMemory(chatId, text.slice(cmd.length).trim());
      break;

    case "/knowledge":
    case "/kb":
      await cmdKnowledge(chatId, text.slice(cmd.length).trim());
      break;

    default:
      if (command.startsWith("/")) {
        await sendTelegramMessage(
          chatId,
          "Неизвестная команда. Используйте /help для просмотра списка команд.",
        );
        break;
      }

      await handlePlainText(chatId, text);
  }
}

const HELP_TEXT = [
  `<b>AI Instagram — управление</b>`,
  ``,
  `/menu — главное меню управления`,
  `/status — состояние системы и подключений`,
  `/search <запрос> — поиск в интернете`,
  `/profiles — список AI-профилей и Instagram-аккаунтов`,
  `/pending — комментарии и сообщения, требующие решения`,
  `/sync &lt;profileId&gt; — синхронизация публикаций`,
  `/connect &lt;profileId&gt; — подключение Instagram`,
  `/help — список доступных команд`,
  ``,
  `/use &lt;profileId&gt; — выбрать AI-профиль для чата`,
  `/ask &lt;текст&gt; — задать вопрос AI`,
  `/prompt — показать системный промпт`,
  `/prompt set &lt;текст&gt; — заменить системный промпт`,
  `/prompt append &lt;текст&gt; — добавить инструкцию`,
  `/prompt reset — сбросить системный промпт`,
  `/memory — показать долговременную память`,
  `/memory add &lt;тип&gt; &lt;текст&gt; — сохранить память`,
  `/memory search &lt;текст&gt; — найти память`,
  `/memory forget &lt;id&gt; — удалить память`,
  `/knowledge — список документов базы знаний`,
  `/knowledge add &lt;название&gt; | &lt;текст&gt; — добавить документ`,
  `/knowledge search &lt;текст&gt; — найти знания`,
  `/knowledge forget &lt;id&gt; — удалить документ`,
  `Обычный текст после /use отправляется выбранному AI-профилю.`,
  ``,
  `Важные комментарии и сообщения поступают отдельными уведомлениями с кнопками для действий.`,
].join("\n");

const KNOWLEDGE_SOURCE_TYPES: KnowledgeSourceType[] = [
  "MANUAL",
  "FILE",
  "URL",
  "INSTAGRAM",
  "TELEGRAM",
  "OTHER",
];

async function cmdKnowledge(chatId: number, input: string): Promise<void> {
  const profileId = await getTelegramActiveProfileId(chatId);

  if (!profileId) {
    await sendTelegramMessage(
      chatId,
      "Сначала выберите AI-профиль: /use &lt;profileId&gt;",
    );
    return;
  }

  const trimmed = input.trim();

  if (!trimmed) {
    const documents = await listKnowledgeDocuments(profileId, 20);

    if (documents.length === 0) {
      await sendTelegramMessage(chatId, "База знаний пока пуста.");
      return;
    }

    await sendTelegramMessage(
      chatId,
      [
        "<b>База знаний</b>",
        "",
        ...documents.map(
          (document) =>
            `• <b>${escape(document.title)}</b> [${document.sourceType}]\n  <code>${document.id}</code>${document.source ? `\n  Источник: ${escape(document.source)}` : ""}`,
        ),
      ].join("\n"),
    );
    return;
  }

  const [subcommand, ...rest] = trimmed.split(/\\s+/);
  const value = rest.join(" ").trim();

  if (subcommand.toLowerCase() === "add") {
    const separator = value.indexOf("|");

    if (separator === -1) {
      await sendTelegramMessage(
        chatId,
        "Использование: /knowledge add &lt;название&gt; | &lt;текст&gt;",
      );
      return;
    }

    const title = value.slice(0, separator).trim();
    const content = value.slice(separator + 1).trim();

    if (!title || !content) {
      await sendTelegramMessage(
        chatId,
        "Название и текст документа обязательны.",
      );
      return;
    }

    const document = await addKnowledgeDocument({
      profileId,
      title,
      content,
      sourceType: "TELEGRAM",
    });

    await sendTelegramMessage(
      chatId,
      `✅ Документ добавлен.\nID: <code>${document.id}</code>\nФрагментов: <b>${document.chunks}</b>`,
    );
    return;
  }

  if (subcommand.toLowerCase() === "search") {
    if (!value) {
      await sendTelegramMessage(
        chatId,
        "Использование: /knowledge search &lt;текст&gt;",
      );
      return;
    }

    const results = await searchKnowledge(profileId, value, 6);

    if (results.length === 0) {
      await sendTelegramMessage(chatId, "Ничего не найдено в базе знаний.");
      return;
    }

    await sendTelegramMessage(
      chatId,
      [
        "<b>Результаты поиска</b>",
        "",
        ...results.map(
          (result) =>
            `• <b>${escape(result.title)}</b>\n${escape(result.content.slice(0, 700))}\n<code>${result.id}</code>`,
        ),
      ].join("\n\n").slice(0, 3900),
    );
    return;
  }

  if (subcommand.toLowerCase() === "forget") {
    if (!value) {
      await sendTelegramMessage(
        chatId,
        "Использование: /knowledge forget &lt;id&gt;",
      );
      return;
    }

    try {
      await deleteKnowledgeDocument(profileId, value);
      await sendTelegramMessage(chatId, "✅ Документ удалён.");
    } catch (error) {
      await sendTelegramMessage(
        chatId,
        "❌ " + escape(error instanceof Error ? error.message : "Ошибка удаления"),
      );
    }
    return;
  }

  await sendTelegramMessage(
    chatId,
    [
      "<b>База знаний</b>",
      "",
      "<code>/knowledge</code> — список",
      "<code>/knowledge add Название | Текст</code> — добавить",
      "<code>/knowledge search запрос</code> — поиск",
      "<code>/knowledge forget &lt;id&gt;</code> — удалить",
      "",
      "Источники: " + KNOWLEDGE_SOURCE_TYPES.join(", "),
    ].join("\n"),
  );
}

const MEMORY_TYPES: MemoryType[] = [
  "PERSONA",
  "AUDIENCE",
  "CONTENT",
  "COMMENT",
  "DM",
  "PERFORMANCE",
  "STRATEGY",
  "PREFERENCE",
];

function parseMemoryType(value?: string): MemoryType | null {
  const normalized = value?.trim().toUpperCase();

  return MEMORY_TYPES.includes(normalized as MemoryType)
    ? (normalized as MemoryType)
    : null;
}

async function cmdMemory(chatId: number, input: string): Promise<void> {
  const profileId = await getTelegramActiveProfileId(chatId);

  if (!profileId) {
    await sendTelegramMessage(
      chatId,
      "Сначала выберите AI-профиль: /use &lt;profileId&gt;",
    );
    return;
  }

  const trimmed = input.trim();

  if (!trimmed) {
    const memories = await listAgentMemories(profileId, { take: 20 });

    if (memories.length === 0) {
      await sendTelegramMessage(chatId, "Долговременная память пока пуста.");
      return;
    }

    const lines = memories.map(
      (memory) =>
        `• [${memory.type}] ${escape(getMemoryText(memory.content))}\n  <code>${memory.id}</code>`,
    );

    await sendTelegramMessage(
      chatId,
      `<b>Долговременная память</b>\n\n${lines.join("\n\n")}`,
    );
    return;
  }

  const [subcommand, ...rest] = trimmed.split(/\\s+/);
  const value = rest.join(" ").trim();

  if (subcommand.toLowerCase() === "add") {
    const [typeValue, ...textParts] = value.split(/\\s+/);
    const type = parseMemoryType(typeValue);
    const memoryText = textParts.join(" ").trim();

    if (!type || !memoryText) {
      await sendTelegramMessage(
        chatId,
        "Использование: /memory add &lt;тип&gt; &lt;текст&gt;\nТипы: " +
          MEMORY_TYPES.join(", "),
      );
      return;
    }

    const memory = await addAgentMemory({
      profileId,
      type,
      text: memoryText,
      importance: 0.9,
    });

    await sendTelegramMessage(
      chatId,
      `✅ Память сохранена.\nТип: <b>${type}</b>\nID: <code>${memory.id}</code>`,
    );
    return;
  }

  if (subcommand.toLowerCase() === "search") {
    if (!value) {
      await sendTelegramMessage(chatId, "Использование: /memory search &lt;текст&gt;");
      return;
    }

    const memories = await searchAgentMemories(profileId, value, 10);

    if (memories.length === 0) {
      await sendTelegramMessage(chatId, "Ничего не найдено.");
      return;
    }

    await sendTelegramMessage(
      chatId,
      [
        "<b>Результаты поиска</b>",
        "",
        ...memories.map(
          (memory) =>
            `• [${memory.type}] ${escape(getMemoryText(memory.content))}\n  <code>${memory.id}</code>`,
        ),
      ].join("\n"),
    );
    return;
  }

  if (subcommand.toLowerCase() === "forget") {
    if (!value) {
      await sendTelegramMessage(chatId, "Использование: /memory forget &lt;id&gt;");
      return;
    }

    try {
      await deleteAgentMemory(profileId, value);
      await sendTelegramMessage(chatId, "✅ Память удалена.");
    } catch (error) {
      await sendTelegramMessage(
        chatId,
        "❌ " + escape(error instanceof Error ? error.message : "Ошибка удаления"),
      );
    }
    return;
  }

  await sendTelegramMessage(
    chatId,
    [
      "<b>Память</b>",
      "",
      "<code>/memory</code> — список",
      "<code>/memory add PREFERENCE ...</code> — добавить",
      "<code>/memory search ...</code> — поиск",
      "<code>/memory forget &lt;id&gt;</code> — удалить",
      "",
      "Типы: " + MEMORY_TYPES.join(", "),
    ].join("\n"),
  );
}

async function cmdUse(chatId: number, profileId?: string): Promise<void> {
  if (!profileId) {
    await sendTelegramMessage(chatId, "Использование: /use &lt;profileId&gt;");
    return;
  }

  const profile = await prisma.aiProfile.findUnique({
    where: {
      id: profileId,
    },
  });

  if (!profile) {
    await sendTelegramMessage(chatId, "❌ AI-профиль не найден.");
    return;
  }

  await setTelegramActiveProfile(chatId, profile.id);

  await sendTelegramMessage(
    chatId,
    [
      "<b>AI-профиль выбран</b>",
      "",
      "Профиль: <b>" + escape(profile.name) + "</b>",
      "ID: <code>" + profile.id + "</code>",
      "",
      "Теперь можно писать обычным текстом.",
    ].join("\n"),
  );
}

async function cmdAsk(chatId: number, message: string): Promise<void> {
  if (!message) {
    await sendTelegramMessage(chatId, "Использование: /ask &lt;текст&gt;");
    return;
  }

  await handlePlainText(chatId, message);
}

async function cmdPrompt(chatId: number, input: string): Promise<void> {
  const profileId = await getTelegramActiveProfileId(chatId);

  if (!profileId) {
    await sendTelegramMessage(
      chatId,
      "Сначала выберите AI-профиль: /use &lt;profileId&gt;",
    );
    return;
  }

  const profile = await prisma.aiProfile.findUnique({
    where: {
      id: profileId,
    },
  });

  if (!profile) {
    await sendTelegramMessage(chatId, "❌ AI-профиль не найден.");
    return;
  }

  const match = input.trim().match(/^(\\S+)(?:\\s+([\\s\\S]*))?$/);
  const subcommand = match?.[1] ?? "";
  const value = match?.[2]?.trim() ?? "";

  if (!input.trim()) {
    await sendTelegramMessage(
      chatId,
      [
        "<b>Системный промпт</b>",
        "",
        profile.systemPrompt?.trim()
          ? escapeTelegramHtml(profile.systemPrompt)
          : "<i>Не задан</i>",
        "",
        "Изменение:",
        "<code>/prompt set Новый системный промпт</code>",
        "<code>/prompt append Дополнительная инструкция</code>",
        "<code>/prompt reset</code>",
      ].join("\n").slice(0, 3900),
    );
    return;
  }

  if (subcommand.toLowerCase() === "reset") {
    await prisma.aiProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        systemPrompt: null,
      },
    });

    await sendTelegramMessage(chatId, "✅ Пользовательский системный промпт сброшен.");
    return;
  }

  if (subcommand.toLowerCase() === "set") {
    if (!value) {
      await sendTelegramMessage(
        chatId,
        "Использование: /prompt set &lt;системный промпт&gt;",
      );
      return;
    }

    await prisma.aiProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        systemPrompt: value,
      },
    });

    await sendTelegramMessage(
      chatId,
      "✅ Системный промпт профиля обновлён.",
    );
    return;
  }

  if (subcommand.toLowerCase() === "append") {
    if (!value) {
      await sendTelegramMessage(
        chatId,
        "Использование: /prompt append &lt;дополнительная инструкция&gt;",
      );
      return;
    }

    const current = profile.systemPrompt?.trim() ?? "";
    const next = current ? `${current}\\n\\n${value}` : value;

    await prisma.aiProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        systemPrompt: next,
      },
    });

    await sendTelegramMessage(
      chatId,
      "✅ Инструкция добавлена в системный промпт.",
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    [
      "Неизвестная операция.",
      "",
      "<code>/prompt</code> — показать текущий промпт",
      "<code>/prompt set ...</code> — заменить",
      "<code>/prompt append ...</code> — добавить",
      "<code>/prompt reset</code> — сбросить",
    ].join("\n"),
  );
}

type TelegramMediaKind = "photo" | "video" | "document" | "voice" | "audio";

function hasTelegramMedia(
  message: NonNullable<TelegramUpdate["message"]>,
): boolean {
  return Boolean(
    message.photo?.length ||
    message.video ||
    message.document ||
    message.voice ||
    message.audio,
  );
}

function getTelegramMedia(message: NonNullable<TelegramUpdate["message"]>): {
  kind: TelegramMediaKind;
  fileId: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
} {
  if (message.photo?.length) {
    const photo = message.photo.at(-1);

    if (!photo) {
      throw new Error("Photo is empty");
    }

    return {
      kind: "photo",
      fileId: photo.file_id,
      mimeType: "image/jpeg",
      caption: message.caption,
      fileName: `${message.message_id}.jpg`,
    };
  }

  if (message.video) {
    return {
      kind: "video",
      fileId: message.video.file_id,
      mimeType: message.video.mime_type ?? "video/mp4",
      caption: message.caption,
      fileName: message.video.file_name,
    };
  }

  if (message.document) {
    return {
      kind: "document",
      fileId: message.document.file_id,
      mimeType: message.document.mime_type,
      caption: message.caption,
      fileName: message.document.file_name,
    };
  }

  if (message.voice) {
    return {
      kind: "voice",
      fileId: message.voice.file_id,
      mimeType: message.voice.mime_type ?? "audio/ogg",
      caption: message.caption,
      fileName: `${message.message_id}.ogg`,
    };
  }

  if (message.audio) {
    return {
      kind: "audio",
      fileId: message.audio.file_id,
      mimeType: message.audio.mime_type,
      caption: message.caption,
      fileName: message.audio.file_name,
    };
  }

  throw new Error("Unsupported Telegram media");
}

async function handleTelegramMedia(
  chatId: number,
  message: NonNullable<TelegramUpdate["message"]>,
): Promise<void> {
  const media = getTelegramMedia(message);
  const maxBytes = 20 * 1024 * 1024;

  try {
    const file = await getTelegramFile(media.fileId);

    if (!file.file_path) {
      throw new Error("Telegram did not return file_path");
    }

    const data = await downloadTelegramFile(file.file_path);

    if (data.byteLength > maxBytes) {
      await sendTelegramMessage(
        chatId,
        "❌ Файл больше 20 МБ. Текущий Telegram Bot API не позволяет боту скачать такой файл.",
      );
      return;
    }

    if (media.kind === "voice" || media.kind === "audio") {
      const profileId = await getTelegramActiveProfileId(chatId);

      if (!profileId) {
        await sendTelegramMessage(
          chatId,
          "Сначала выберите AI-профиль: /use &lt;profileId&gt;",
        );
        return;
      }

      await sendTelegramMessage(chatId, "🎙 Расшифровываю голосовое...");

      const transcription = await transcribeAudio({
        data,
        filename: media.fileName ?? `${message.message_id}.ogg`,
        mimeType: media.mimeType ?? "audio/ogg",
      });

      const transcript = transcription.text.trim();

      if (!transcript) {
        await sendTelegramMessage(chatId, "❌ Не удалось распознать речь.");
        return;
      }

      const userMessage = media.caption
        ? `Подпись к голосовому: ${media.caption.trim()}\n\nТекст голосового:\n${transcript}`
        : transcript;

      await sendTelegramMessage(
        chatId,
        `<b>Распознано:</b>\n${escapeTelegramHtml(transcript.slice(0, 3500))}`,
      );

      const answer = await askTelegramAi({
        chatId,
        profileId,
        message: userMessage,
      });

      await sendTelegramMessage(chatId, escapeTelegramHtml(answer));
      return;
    }

    await sendTelegramMessage(
      chatId,
      [
        "✅ Получено.",
        `Тип: <b>${media.kind}</b>`,
        `Размер: <b>${formatBytes(data.byteLength)}</b>`,
        media.fileName ? `Имя: <code>${escape(media.fileName)}</code>` : "",
        media.caption ? `Подпись: ${escape(media.caption.slice(0, 500))}` : "",
        "",
        "Файл скачан. Анализ этого типа медиа будет подключён следующим этапом.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "неизвестная ошибка";

    await sendTelegramMessage(
      chatId,
      "❌ Не удалось обработать сообщение: " + escape(message),
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function handlePlainText(chatId: number, message: string): Promise<void> {
  const profileId = await getTelegramActiveProfileId(chatId);

  if (!profileId) {
    await sendTelegramMessage(
      chatId,
      "Сначала выберите AI-профиль: /use &lt;profileId&gt;",
    );
    return;
  }

  try {
    const answer = await askTelegramAi({
      chatId,
      profileId,
      message,
    });

    await sendTelegramMessage(chatId, escapeTelegramHtml(answer));
  } catch (error) {
    await sendTelegramMessage(
      chatId,
      "❌ Ошибка AI: " +
        escape(error instanceof Error ? error.message : "неизвестная ошибка"),
    );
  }
}

function escapeTelegramHtml(s: string): string {
  return escape(s).slice(0, 3900);
}

function escapeAttribute(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendMainMenu(chatId: number): Promise<void> {
  const profileId = await getTelegramActiveProfileId(chatId);
  const profile = profileId
    ? await prisma.aiProfile.findUnique({
        where: { id: profileId },
        select: { name: true },
      })
    : null;

  await sendTelegramMessage(
    chatId,
    [
      "<b>AI Instagram Agent</b>",
      "",
      `Профиль: <b>${escape(profile?.name ?? "не выбран")}</b>`,
      "",
      "Выберите раздел:",
    ].join("\n"),
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📱 Instagram", callback_data: "menu:instagram" },
            { text: "✍️ Контент", callback_data: "menu:content" },
          ],
          [
            { text: "💬 Комментарии", callback_data: "menu:comments" },
            { text: "✉️ Direct", callback_data: "menu:dm" },
          ],
          [
            { text: "🧠 Память", callback_data: "menu:memory" },
            { text: "📚 Knowledge", callback_data: "menu:knowledge" },
          ],
          [
            { text: "🔎 Web Search", callback_data: "menu:search" },
            { text: "📊 Статус", callback_data: "menu:status" },
          ],
          [
            { text: "⚙️ Настройки", callback_data: "menu:settings" },
            { text: "🤖 Профили", callback_data: "menu:profiles" },
          ],
        ],
      },
    },
  );
}

async function cmdSearch(chatId: number, query: string): Promise<void> {
  if (!query.trim()) {
    await sendTelegramMessage(
      chatId,
      [
        "<b>Web Search</b>",
        "",
        "Использование:",
        "<code>/search актуальные тренды Instagram Reels</code>",
      ].join("\n"),
    );
    return;
  }

  try {
    await sendTelegramMessage(chatId, "🔎 Ищу в интернете...");

    const results = await searchWeb(query, {
      limit: 6,
      country: "RU",
      searchLang: "ru",
    });

    if (results.length === 0) {
      await sendTelegramMessage(chatId, "Ничего не найдено.");
      return;
    }

    const text = [
      "<b>Результаты Web Search</b>",
      "",
      ...results.map(
        (result, index) =>
          `<b>${index + 1}. ${escape(result.title)}</b>\n${escape(result.description.slice(0, 500))}\n<a href="${escapeAttribute(result.url)}">Открыть источник</a>`,
      ),
    ].join("\n\n");

    await sendTelegramMessage(chatId, text.slice(0, 3900), {
      disable_web_page_preview: true,
    });
  } catch (error) {
    await sendTelegramMessage(
      chatId,
      "❌ Web Search: " +
        escape(error instanceof Error ? error.message : "неизвестная ошибка"),
    );
  }
}

async function cmdStatus(chatId: number): Promise<void> {
  const accounts = await prisma.instagramAccount.count({
    where: {
      status: "ACTIVE",
    },
  });

  const pendingComments = await prisma.comment.count({
    where: {
      requiresHuman: true,
      replied: false,
    },
  });

  const pendingDms = await prisma.directMessage.count({
    where: {
      requiresHuman: true,
      replied: false,
      direction: "INBOUND",
    },
  });

  const text = [
    `<b>Состояние системы</b>`,
    ``,
    `Режим разработки: <code>${
      isInstagramDevMode() ? "включён" : "выключен"
    }</code>`,
    `OAuth: <code>${isOAuthEnabled() ? "включён" : "выключен"}</code>`,
    `Telegram: <code>подключён</code>`,
    `Активных Instagram-аккаунтов: <b>${accounts}</b>`,
    `Комментариев требуют решения: <b>${pendingComments}</b>`,
    `Сообщений требуют решения: <b>${pendingDms}</b>`,
  ].join("\n");

  await sendTelegramMessage(chatId, text);
}

async function cmdPending(chatId: number): Promise<void> {
  const comments = await prisma.comment.findMany({
    where: {
      requiresHuman: true,
      replied: false,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  const dms = await prisma.directMessage.findMany({
    where: {
      requiresHuman: true,
      replied: false,
      direction: "INBOUND",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
    include: {
      thread: true,
    },
  });

  if (comments.length === 0 && dms.length === 0) {
    await sendTelegramMessage(
      chatId,
      "✅ Нет сообщений и комментариев, требующих решения.",
    );
    return;
  }

  const lines: string[] = [`<b>Требуют решения</b>`, ``];

  for (const comment of comments) {
    lines.push(
      `💬 <b>Комментарий</b> @${escape(comment.username ?? "?")} [${escape(
        comment.category ?? "?",
      )}]`,
    );
    lines.push(`<i>${escape(comment.text.slice(0, 120))}</i>`);
    lines.push(`<code>${comment.id}</code>`);
    lines.push(``);
  }

  for (const message of dms) {
    lines.push(
      `✉️ <b>Сообщение</b> @${escape(
        message.thread.username ?? "?",
      )} [${escape(message.category ?? "?")}]`,
    );
    lines.push(`<i>${escape(message.text.slice(0, 120))}</i>`);
    lines.push(`<code>${message.id}</code>`);
    lines.push(``);
  }

  await sendTelegramMessage(chatId, lines.join("\n"));
}

async function cmdProfiles(chatId: number): Promise<void> {
  const profiles = await prisma.aiProfile.findMany({
    take: 20,
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      instagramAccounts: {
        where: {
          status: "ACTIVE",
        },
        take: 1,
      },
    },
  });

  if (profiles.length === 0) {
    await sendTelegramMessage(chatId, "Пока нет созданных AI-профилей.");
    return;
  }

  const lines = profiles.map((profile) => {
    const instagram = profile.instagramAccounts[0];

    return [
      `• <b>${escape(profile.name)}</b>`,
      `  ID: <code>${profile.id}</code>`,
      `  Instagram: @${escape(instagram?.username ?? "не подключён")}`,
      `  Автономный режим: ${profile.autonomousMode ? "включён" : "выключен"}`,
    ].join("\n");
  });

  await sendTelegramMessage(
    chatId,
    `<b>AI-профили</b>\n\n${lines.join("\n\n")}`,
  );
}

async function cmdSync(chatId: number, profileId?: string): Promise<void> {
  if (!profileId) {
    await sendTelegramMessage(chatId, "Использование: /sync &lt;profileId&gt;");
    return;
  }

  try {
    const { enqueueMediaSync } =
      await import("../../infrastructure/queue/index.js");

    const job = await enqueueMediaSync({
      profileId,
    });

    await sendTelegramMessage(
      chatId,
      [
        `✅ Синхронизация публикаций поставлена в очередь.`,
        `Задача: <code>${job.id}</code>`,
      ].join("\n"),
    );
  } catch (error) {
    await sendTelegramMessage(
      chatId,
      `❌ Не удалось запустить синхронизацию: ${
        error instanceof Error ? error.message : "неизвестная ошибка"
      }`,
    );
  }
}

async function cmdConnect(chatId: number, profileId?: string): Promise<void> {
  if (!profileId) {
    await sendTelegramMessage(
      chatId,
      "Использование: /connect &lt;profileId&gt;",
    );
    return;
  }

  if (isOAuthEnabled()) {
    const base =
      env.INSTAGRAM_REDIRECT_URI?.replace(
        /\/api\/instagram\/auth\/callback.*/,
        "",
      ) ?? "";

    await sendTelegramMessage(
      chatId,
      [
        `<b>Подключение Instagram</b>`,
        ``,
        `Откройте ссылку для авторизации:`,
        `<code>${base}/api/instagram/auth/login?profileId=${profileId}</code>`,
      ].join("\n"),
    );

    return;
  }

  await sendTelegramMessage(
    chatId,
    [
      `<b>Локальный режим разработки</b>`,
      ``,
      `OAuth отключён.`,
      `Для подключения используйте API:`,
      `<code>POST /api/instagram/auth/dev/bootstrap</code>`,
      ``,
      `Профиль: <code>${escape(profileId)}</code>`,
    ].join("\n"),
  );
}

async function handleCallback(
  cq: NonNullable<TelegramUpdate["callback_query"]>,
): Promise<void> {
  const chatId = cq.message?.chat.id;

  if (!chatId || !isAuthorized(chatId)) {
    await answerCallbackQuery(cq.id, "Доступ запрещён");
    return;
  }

  const data = cq.data ?? "";
  const [action, id] = data.split(":");

  try {
    if (action === "menu") {
      await handleMenuCallback(chatId, cq.id, id);
    } else if (action === "c_send" && id) {
      await humanSendComment(id);

      await answerCallbackQuery(cq.id, "Ответ отправлен");

      if (cq.message) {
        await editMessageText(
          chatId,
          cq.message.message_id,
          `${cq.message.text ?? ""}\n\n✅ <b>Ответ отправлен</b>`,
        );
      }
    } else if (action === "c_ignore" && id) {
      await prisma.comment.update({
        where: {
          id,
        },
        data: {
          requiresHuman: false,
        },
      });

      await answerCallbackQuery(cq.id, "Комментарий пропущен");

      if (cq.message) {
        await editMessageText(
          chatId,
          cq.message.message_id,
          `${cq.message.text ?? ""}\n\n⏭ <b>Пропущено</b>`,
        );
      }
    } else if (action === "m_send" && id) {
      await humanSendDm(id);

      await answerCallbackQuery(cq.id, "Сообщение отправлено");

      if (cq.message) {
        await editMessageText(
          chatId,
          cq.message.message_id,
          `${cq.message.text ?? ""}\n\n✅ <b>Сообщение отправлено</b>`,
        );
      }
    } else if (action === "m_ignore" && id) {
      await prisma.directMessage.update({
        where: {
          id,
        },
        data: {
          requiresHuman: false,
        },
      });

      await answerCallbackQuery(cq.id, "Сообщение пропущено");

      if (cq.message) {
        await editMessageText(
          chatId,
          cq.message.message_id,
          `${cq.message.text ?? ""}\n\n⏭ <b>Пропущено</b>`,
        );
      }
    } else {
      await answerCallbackQuery(cq.id, "Неизвестное действие");
    }
  } catch (error) {
    await answerCallbackQuery(
      cq.id,
      error instanceof Error ? error.message.slice(0, 180) : "Произошла ошибка",
    );
  }
}

async function handleMenuCallback(
  chatId: number,
  callbackQueryId: string,
  section?: string,
): Promise<void> {
  if (!section) {
    await answerCallbackQuery(callbackQueryId, "Раздел не указан");
    return;
  }

  if (section === "status") {
    await answerCallbackQuery(callbackQueryId);
    await cmdStatus(chatId);
    return;
  }

  if (section === "profiles") {
    await answerCallbackQuery(callbackQueryId);
    await cmdProfiles(chatId);
    return;
  }

  if (section === "memory") {
    await answerCallbackQuery(callbackQueryId);
    await cmdMemory(chatId, "");
    return;
  }

  if (section === "knowledge") {
    await answerCallbackQuery(callbackQueryId);
    await cmdKnowledge(chatId, "");
    return;
  }

  if (section === "search") {
    await answerCallbackQuery(callbackQueryId);
    await sendTelegramMessage(
      chatId,
      [
        "<b>Web Search</b>",
        "",
        "Используйте:",
        "<code>/search ваш запрос</code>",
        "",
        "Пример:",
        "<code>/search последние тренды Instagram Reels</code>",
      ].join("\n"),
    );
    return;
  }

  if (section === "instagram" || section === "content" || section === "comments" || section === "dm" || section === "settings") {
    await answerCallbackQuery(callbackQueryId);
    const labels: Record<string, string> = {
      instagram: "📱 Instagram",
      content: "✍️ Контент",
      comments: "💬 Комментарии",
      dm: "✉️ Direct",
      settings: "⚙️ Настройки",
    };

    await sendTelegramMessage(
      chatId,
      [
        `<b>${labels[section]}</b>`,
        "",
        "Раздел подключён к Telegram control plane.",
        "Детальные операции будут добавляться сюда без необходимости использовать HTTP API.",
      ].join("\n"),
    );
    return;
  }

  await answerCallbackQuery(callbackQueryId, "Неизвестный раздел");
}

async function humanSendComment(commentId: string): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: {
      id: commentId,
    },
    include: {
      post: true,
    },
  });

  if (!comment) {
    throw new Error("Комментарий не найден");
  }

  if (!comment.suggestedReply) {
    throw new Error("Для комментария нет подготовленного ответа");
  }

  const accessToken = await resolveAccessTokenByProfileId(
    comment.post.profileId,
  );

  const service = createInstagramCommentsService(accessToken);

  await service.replyToComment(comment.instagramId, comment.suggestedReply);

  await prisma.comment.update({
    where: {
      id: commentId,
    },
    data: {
      replied: true,
      replyText: comment.suggestedReply,
      requiresHuman: false,
    },
  });
}

async function humanSendDm(messageId: string): Promise<void> {
  const message = await prisma.directMessage.findUnique({
    where: {
      id: messageId,
    },
    include: {
      thread: {
        include: {
          account: true,
        },
      },
    },
  });

  if (!message) {
    throw new Error("Сообщение не найдено");
  }

  if (!message.suggestedReply) {
    throw new Error("Для сообщения нет подготовленного ответа");
  }

  const profileId = message.thread.account.profileId;

  const accessToken = await resolveAccessTokenByProfileId(profileId);

  const client = createInstagramClient({
    accessToken,
    apiVersion: env.INSTAGRAM_API_VERSION,
  });

  await client.sendMessage(
    message.thread.account.instagramUserId,
    message.thread.instagramThreadId,
    message.suggestedReply,
  );

  await prisma.directMessage.update({
    where: {
      id: messageId,
    },
    data: {
      replied: true,
      requiresHuman: false,
    },
  });
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
