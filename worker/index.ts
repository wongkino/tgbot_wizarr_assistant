import { createApp } from "../src/app.ts";
import { ConfigError, loadConfig } from "../src/config.ts";
import { routeRequest } from "../src/http.ts";
import { KvSessionStore, type KvLike, MemorySessionStore } from "../src/session.ts";

export interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_IDS?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  WIZARR_URL?: string;
  WIZARR_API_KEY?: string;
  WIZARR_PUBLIC_URL?: string;
  TIMEZONE?: string;
  SESSIONS?: KvLike;
}

const memorySessions = new MemorySessionStore();
let warnedAboutMemory = false;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let config: ReturnType<typeof loadConfig>;
    try {
      config = loadConfig({
        TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_ADMIN_IDS: env.TELEGRAM_ADMIN_IDS,
        TELEGRAM_WEBHOOK_SECRET: env.TELEGRAM_WEBHOOK_SECRET,
        WIZARR_URL: env.WIZARR_URL,
        WIZARR_API_KEY: env.WIZARR_API_KEY,
        WIZARR_PUBLIC_URL: env.WIZARR_PUBLIC_URL,
        TIMEZONE: env.TIMEZONE,
        MODE: "webhook",
      });
    } catch (error) {
      const message = error instanceof ConfigError ? error.message : "設定無效";
      return new Response(message, { status: 500 });
    }

    const sessions = env.SESSIONS ? new KvSessionStore(env.SESSIONS) : memorySessions;
    if (!env.SESSIONS && !warnedAboutMemory) {
      warnedAboutMemory = true;
      console.warn("[bot] 未綁定 KV SESSIONS，多步驟對話可能在 Worker 重啟後遺失");
    }
    return routeRequest(request, createApp(config, sessions));
  },
};
