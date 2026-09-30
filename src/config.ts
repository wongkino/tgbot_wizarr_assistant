import type { AppConfig } from "./types.ts";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

type EnvLike = Record<string, string | undefined>;

export function splitWizarrUrl(input: string): { apiBase: string; publicBase: string } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ConfigError("WIZARR_URL 必須是完整的 http 或 https 網址");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError("WIZARR_URL 必須是 http 或 https");
  }

  const path = url.pathname.replace(/\/+$/, "");
  const apiPath = path.endsWith("/api") ? path : `${path}/api`;
  const publicPath = path.endsWith("/api") ? path.slice(0, -4) : path;
  return {
    apiBase: `${url.origin}${apiPath}`,
    publicBase: `${url.origin}${publicPath}`,
  };
}

export function loadConfig(env: EnvLike): AppConfig {
  const token = required(env, "TELEGRAM_BOT_TOKEN");
  const wizarrUrl = required(env, "WIZARR_URL");
  const apiKey = required(env, "WIZARR_API_KEY");
  const { apiBase, publicBase } = splitWizarrUrl(wizarrUrl);
  const publicOverride = env.WIZARR_PUBLIC_URL?.trim();
  if (publicOverride) {
    let parsed: URL;
    try {
      parsed = new URL(publicOverride);
    } catch {
      throw new ConfigError("WIZARR_PUBLIC_URL 必須是完整的 http 或 https 網址");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ConfigError("WIZARR_PUBLIC_URL 必須是 http 或 https");
    }
  }

  const mode = (env.MODE?.trim() || "polling").toLowerCase();
  if (mode !== "polling" && mode !== "webhook") {
    throw new ConfigError("MODE 只能是 polling 或 webhook");
  }
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (mode === "webhook" && !webhookSecret) {
    throw new ConfigError("MODE=webhook 時必須設定 TELEGRAM_WEBHOOK_SECRET");
  }

  const port = Number(env.PORT?.trim() || "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError("PORT 必須是 1 到 65535 的整數");
  }

  return {
    telegramToken: token,
    webhookSecret,
    adminIds: parseAdminIds(env.TELEGRAM_ADMIN_IDS),
    wizarrApiBase: apiBase,
    wizarrApiKey: apiKey,
    wizarrPublicUrl: (publicOverride || publicBase).replace(/\/+$/, ""),
    mode,
    port,
  };
}

function required(env: EnvLike, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new ConfigError(`缺少環境變數：${name}`);
  }
  return value;
}

export function parseAdminIds(raw: string | undefined): Set<number> {
  const ids = new Set<number>();
  if (!raw) return ids;
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (!/^\d+$/.test(trimmed)) {
      throw new ConfigError(`TELEGRAM_ADMIN_IDS 含有無效 ID：${trimmed}`);
    }
    ids.add(Number(trimmed));
  }
  return ids;
}
