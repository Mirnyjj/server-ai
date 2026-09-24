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
import {
  answerCallbackQuery,
  editMessageText,
  sendTelegramMessage,
} from "./telegram.client.js";
import {
  askTelegramAi,
  getTelegramActiveProfileId,
  setTelegramActiveProfile,
} from "./telegram.chat.js";
import { AiProfile } from "../../generated/prisma/client.js";

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      username?: string;
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

  if (!msg?.text) return;

  const chatId = msg.chat.id;

  if (!isAuthorized(chatId)) {
    await sendTelegramMessage(chatId, "⛔ Доступ запрещён.");
    return;
  }

  const text = msg.text.trim();
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
  `/status — состояние системы и подключений`,
  `/profiles — список AI-профилей и Instagram-аккаунтов`,
  `/pending — комментарии и сообщения, требующие решения`,
  `/sync &lt;profileId&gt; — синхронизация публикаций`,
  `/connect &lt;profileId&gt; — подключение Instagram`,
  `/help — список доступных команд`,
  ``,
  `/use &lt;profileId&gt; — выбрать AI-профиль для чата`,
  `/ask &lt;текст&gt; — задать вопрос AI`,
  `Обычный текст после /use отправляется выбранному AI-профилю.`,
  ``,
  `Важные комментарии и сообщения поступают отдельными уведомлениями с кнопками для действий.`,
].join("\n");

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

  const lines = profiles.map((profile: AiProfile) => {
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
    if (action === "c_send" && id) {
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
