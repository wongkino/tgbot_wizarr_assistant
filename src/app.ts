import { setDateTimeZone } from "./format.ts";
import { handleUpdate } from "./handler.ts";
import type { AppConfig, SessionStore, TelegramApi, Update } from "./types.ts";
import { createWizarrClient } from "./wizarr.ts";

export interface App {
  handle(update: Update): Promise<void>;
}

export function createApp(
  config: AppConfig,
  sessions: SessionStore,
  telegram: TelegramApi,
  fetchImpl?: typeof fetch,
): App {
  setDateTimeZone(config.timeZone);
  const wizarr = createWizarrClient({
    apiBase: config.wizarrApiBase,
    apiKey: config.wizarrApiKey,
    publicBase: config.wizarrPublicUrl,
    fetchImpl,
  });
  return {
    handle(update) {
      return handleUpdate(update, { config, wizarr, telegram, sessions });
    },
  };
}
