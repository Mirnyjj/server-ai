import { env, isTelegramEnabled } from "../../config/env";
import { handleTelegramUpdate, type TelegramUpdate } from "./telegram.handlers";

const TELEGRAM_API_URL = "https://api.telegram.org";

type TelegramGetUpdatesResponse = {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
};

let running = false;
let offset = 0;

export async function startTelegramPolling(): Promise<void> {
  if (!isTelegramEnabled()) {
    console.log("[telegram] polling disabled: bot token is not configured");
    return;
  }

  if (env.NODE_ENV === "production") {
    console.log("[telegram] polling disabled in production");
    return;
  }

  if (running) {
    return;
  }

  running = true;

  console.log("[telegram] polling started");

  while (running) {
    try {
      const updates = await getUpdates();

      for (const update of updates) {
        offset = update.update_id + 1;

        try {
          await handleTelegramUpdate(update);
        } catch (error) {
          console.error(
            `[telegram] failed to handle update ${update.update_id}:`,
            error,
          );
        }
      }
    } catch (error) {
      console.error("[telegram] polling error:", error);
      await sleep(3000);
    }
  }

  console.log("[telegram] polling stopped");
}

export function stopTelegramPolling(): void {
  running = false;
}

async function getUpdates(): Promise<TelegramUpdate[]> {
  const token = env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const url = new URL(`/bot${token}/getUpdates`, TELEGRAM_API_URL);

  url.searchParams.set("offset", String(offset));
  url.searchParams.set("timeout", "30");
  url.searchParams.set(
    "allowed_updates",
    JSON.stringify(["message", "callback_query"]),
  );

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Telegram getUpdates failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as TelegramGetUpdatesResponse;

  if (!data.ok) {
    throw new Error(data.description ?? "Telegram getUpdates failed");
  }

  return data.result ?? [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
