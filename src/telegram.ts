import type { ReplyMarkup, TelegramApi, Update } from "./types.ts";

const MESSAGE_LIMIT = 3900;

export function createTelegramClient(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  async function call(method: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      const reason = error instanceof Error ? error.message : "連線失敗";
      throw new Error(`Telegram ${method} 失敗：${reason}`);
    }

    const data = (await response.json()) as { ok?: boolean; description?: string; result?: unknown };
    if (!response.ok || data.ok === false) {
      throw new Error(data.description || `Telegram ${method} HTTP ${response.status}`);
    }
    return data.result;
  }

  return {
    async sendMessage(chatId, text, markup) {
      const chunks = splitText(text);
      for (let index = 0; index < chunks.length; index += 1) {
        const last = index === chunks.length - 1;
        await call("sendMessage", {
          chat_id: chatId,
          text: chunks[index],
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          ...(last && markup ? { reply_markup: markup } : {}),
        });
      }
    },
    async getUpdates(offset, signal) {
      const result = await call(
        "getUpdates",
        {
          offset,
          timeout: 25,
          allowed_updates: ["message"],
        },
        signal,
      );
      return Array.isArray(result) ? (result as Update[]) : [];
    },
    async deleteWebhook() {
      await call("deleteWebhook", { drop_pending_updates: false });
    },
  };
}

export function splitText(text: string): string[] {
  if (text.length <= MESSAGE_LIMIT) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > MESSAGE_LIMIT) {
    const slice = rest.slice(0, MESSAGE_LIMIT);
    const breakAt = slice.lastIndexOf("\n");
    const cut = breakAt > 200 ? breakAt : MESSAGE_LIMIT;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}
