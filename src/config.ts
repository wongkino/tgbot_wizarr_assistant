import type { AppConfig } from "./types.ts";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

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

/** Telegram Serverless 已代為呼叫 Bot API，這裡只驗證 Wizarr 與允許的帳號。 */
export function loadServerlessConfig(input: ServerlessConfigInput): AppConfig {
  const wizarrUrl = required(input.wizarrUrl, "WIZARR_URL");
  const apiKey = required(input.wizarrApiKey, "WIZARR_API_KEY");
  const { apiBase, publicBase } = splitWizarrUrl(wizarrUrl);
  const rawPublic = input.wizarrPublicUrl?.trim() ?? "";
  const publicOverride = rawPublic ? cleanUrl(rawPublic) : "";
  if (publicOverride) parseHttpUrl(publicOverride, "WIZARR_PUBLIC_URL");

  const timeZone = input.timeZone?.trim() || "Asia/Hong_Kong";
  if (!isValidTimeZone(timeZone)) {
    throw new ConfigError("TIMEZONE 必須是有效的 IANA 時區名稱，例如 Asia/Taipei");
  }

  return {
    adminIds: parseAdminIds(input.adminIds),
    wizarrApiBase: apiBase,
    wizarrApiKey: apiKey,
    wizarrPublicUrl: (publicOverride || publicBase).replace(/\/+$/, ""),
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

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ConfigError(`缺少環境變數：${name}`);
  }
  return trimmed;
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
