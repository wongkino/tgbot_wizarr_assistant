import { handleUpdate } from "./handler.ts";
import { createTelegramClient } from "./telegram.ts";
import type { AppConfig, SessionStore, TelegramApi, Update } from "./types.ts";
import { createWizarrClient } from "./wizarr.ts";

export interface App {
  config: AppConfig;
  telegram: TelegramApi;
  handle(update: Update): Promise<void>;
}

export function createApp(config: AppConfig, sessions: SessionStore, fetchImpl?: typeof fetch): App {
  const wizarr = createWizarrClient({
    apiBase: config.wizarrApiBase,
    apiKey: config.wizarrApiKey,
    publicBase: config.wizarrPublicUrl,
    fetchImpl,
  });
  const telegram = createTelegramClient(config.telegramToken, fetchImpl);
  return {
    config,
    telegram,
    handle(update) {
      return handleUpdate(update, { config, wizarr, telegram, sessions });
    },
  };
}
