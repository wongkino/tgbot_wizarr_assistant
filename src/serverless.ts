import { createApp } from "./app.ts";
import { ConfigError, loadServerlessConfig, type ServerlessConfigInput } from "./config.ts";
import { KvSessionStore, type KvLike } from "./session.ts";
import { splitText } from "./telegram.ts";
import type { TelegramApi, TelegramMessage } from "./types.ts";

export interface ServerlessBotApi {
  sendMessage(params: Record<string, unknown>): Promise<unknown>;
  sendPhoto(params: Record<string, unknown>): Promise<unknown>;
}

export interface ServerlessInputFile {
  new (bytes: Uint8Array, filename: string, options?: { type?: string }): unknown;
}

export interface ServerlessRuntime {
  config: ServerlessConfigInput;
  kv: KvLike;
  fetchImpl: typeof fetch;
  api: ServerlessBotApi;
  InputFile: ServerlessInputFile;
}

export function createSdkTelegram(api: ServerlessBotApi, InputFile: ServerlessInputFile): TelegramApi {
  return {
    async sendMessage(chatId, text, markup) {
      const chunks = splitText(text);
      for (let index = 0; index < chunks.length; index += 1) {
        const last = index === chunks.length - 1;
        await api.sendMessage({
          chat_id: chatId,
          text: chunks[index],
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          ...(last && markup ? { reply_markup: markup } : {}),
        });
      }
    },
    async sendPhoto(chatId, image, caption) {
      await api.sendPhoto({
        chat_id: chatId,
        photo: new InputFile(image, "invite-qr.png", { type: "image/png" }),
        ...(caption ? { caption, parse_mode: "HTML" } : {}),
      });
    },
  };
}

export async function handleServerlessMessage(message: TelegramMessage, runtime: ServerlessRuntime): Promise<void> {
  let config: ReturnType<typeof loadServerlessConfig>;
  try {
    config = loadServerlessConfig(runtime.config);
  } catch (error) {
    const detail = error instanceof ConfigError ? error.message : "設定無效";
    console.error("[bot]", detail);
    await runtime.api.sendMessage({ chat_id: message.chat.id, text: detail });
    return;
  }

  const app = createApp(
    config,
    new KvSessionStore(runtime.kv),
    createSdkTelegram(runtime.api, runtime.InputFile),
    runtime.fetchImpl,
  );
  await app.handle({ update_id: 0, message });
}
