import type { AppConfig } from "./types.ts";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

type EnvLike = Record<string, string | undefined>;

export function splitWizarrUrl(input: string): { apiBase: string; publicBase: string } {
  const url = parseHttpUrl(input, "WIZARR_URL");
  const path = url.pathname.replace(/\/+$/, "");
  const apiPath = path.endsWith("/api") ? path : `${path}/api`;
  const publicPath = path.endsWith("/api") ? path.slice(0, -4) : path;
  return {
    apiBase: `${url.origin}${apiPath}`,
    publicBase: `${url.origin}${publicPath}`,
  };
}

/**
 * 自行拆網址，不使用全域 URL。Telegram Serverless 的 V8 沙盒不一定提供 URL，
 * 缺少時 new URL() 會丟例外，設定正確也會被當成網址無效。
 */
function parseHttpUrl(input: string, label: string): { origin: string; pathname: string } {
  const value = cleanUrl(input);
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (scheme && scheme[1].toLowerCase() !== "http" && scheme[1].toLowerCase() !== "https") {
    throw new ConfigError(`${label} 必須是 http 或 https`);
  }
  const match = /^(https?):\/\/(?:[^/?#@]+@)?(\[[0-9a-fA-F:.]+\]|[^/?#:@]+)(?::([0-9]*))?([^?#]*)$/i.exec(value);
  if (!match || /\s/.test(value)) {
    throw new ConfigError(`${label} 必須是完整的 http 或 https 網址`);
  }
  const protocol = match[1].toLowerCase();
  const host = match[2].startsWith("[") ? match[2] : match[2].toLowerCase();
  const port = match[3] ?? "";
  if (port !== "" && (!/^\d+$/.test(port) || Number(port) > 65535)) {
    throw new ConfigError(`${label} 必須是完整的 http 或 https 網址`);
  }
  const pathname = match[4] || "/";
  const origin = `${protocol}://${host}${port === "" ? "" : `:${port}`}`;
  return { origin, pathname };
}

function cleanUrl(input: string): string {
  let value = input.trim().replace(/^\uFEFF/, "");
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  const prefixed = /^WIZARR_(?:PUBLIC_)?URL=/i.exec(value);
  if (prefixed) value = value.slice(prefixed[0].length).trim();
  return value;
}

export interface ServerlessConfigInput {
  adminIds?: string;
  wizarrUrl?: string;
  wizarrApiKey?: string;
  wizarrPublicUrl?: string;
  timeZone?: string;
}

/** Telegram Serverless 已代為呼叫 Bot API，不需要 bot token 或 webhook 密鑰。 */
export function loadServerlessConfig(input: ServerlessConfigInput): AppConfig {
  return loadConfig({
    TELEGRAM_BOT_TOKEN: "serverless",
    TELEGRAM_ADMIN_IDS: input.adminIds,
    WIZARR_URL: input.wizarrUrl,
    WIZARR_API_KEY: input.wizarrApiKey,
    TIMEZONE: input.timeZone,
    WIZARR_PUBLIC_URL: input.wizarrPublicUrl,
    MODE: "polling",
  });
}

export function loadConfig(env: EnvLike): AppConfig {
  const token = required(env, "TELEGRAM_BOT_TOKEN");
  const wizarrUrl = required(env, "WIZARR_URL");
  const apiKey = required(env, "WIZARR_API_KEY");
  const { apiBase, publicBase } = splitWizarrUrl(wizarrUrl);
  const rawPublic = env.WIZARR_PUBLIC_URL?.trim() ?? "";
  const publicOverride = rawPublic ? cleanUrl(rawPublic) : "";
  if (publicOverride) parseHttpUrl(publicOverride, "WIZARR_PUBLIC_URL");

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

  const timeZone = env.TIMEZONE?.trim() || "Asia/Hong_Kong";
  if (!isValidTimeZone(timeZone)) {
    throw new ConfigError("TIMEZONE 必須是有效的 IANA 時區名稱，例如 Asia/Taipei");
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
    timeZone,
  };
}

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
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
