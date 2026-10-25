import { absoluteUrl } from "./format.ts";
import type {
  CreateInvitationInput,
  ExtendResult,
  InvitationInfo,
  LibraryInfo,
  PasswordResetInfo,
  ServerInfo,
  StatusInfo,
  UserInfo,
  WizarrApi,
} from "./types.ts";

export class WizarrError extends Error {
  readonly status: number;
  /** true 表示 fetch 層級的連線失敗（無 HTTP 回應），message 為原始原因。 */
  readonly connection: boolean;

  constructor(message: string, status: number, connection = false) {
    super(message);
    this.name = "WizarrError";
    this.status = status;
    this.connection = connection;
  }
}

export interface WizarrClientOptions {
  apiBase: string;
  apiKey: string;
  publicBase: string;
  fetchImpl?: typeof fetch;
}

export function createWizarrClient(options: WizarrClientOptions): WizarrApi {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = options.apiBase.replace(/\/+$/, "");

  async function request(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-API-Key": options.apiKey,
    };
    if (init?.body !== undefined) headers["Content-Type"] = "application/json";

    const call: { method: string; headers: Record<string, string>; body?: string } = {
      method: init?.method ?? "GET",
      headers,
    };
    // 沒有 body 時不要放這個欄位。Telegram Serverless 的 fetch 看到 body: undefined 會直接失敗。
    if (init?.body !== undefined) call.body = JSON.stringify(init.body);

    let response: Response;
    try {
      response = await fetchImpl(`${apiBase}${path}`, call);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const where = endpointOrigin(apiBase);
      const hint = isPrivateHost(where) ? "。Telegram 連不到區網位址，請把 WIZARR_URL 改成公開的 https 網址" : "";
      throw new WizarrError(`${reason}（${where}）${hint}`, 0, true);
    }

    let text: string;
    try {
      text = await readBody(response);
    } catch (error) {
      if (error instanceof WizarrError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new WizarrError(reason, response.status || 0, true);
    }
    const data = text ? parseJson(text) : null;
    if (!isOk(response)) {
      throw new WizarrError(extractError(data) ?? `HTTP ${response.status}`, response.status);
    }
    return data;
  }

  /** 呼叫後只取訊息的操作（啟用、停用、刪除等）。 */
  async function messageRequest(path: string, method: string): Promise<string | null> {
    return messageOf(await request(path, { method }));
  }

  return {
    async getStatus() {
      return parseStatus(await request("/status"));
    },
    async listUsers(query) {
      const suffix = query?.username ? `?username=${encodeURIComponent(query.username)}` : "";
      const users = asArray(asRecord(await request(`/users${suffix}`))?.users).map(parseUser);
      return users.sort((a, b) => compareText(a.username, b.username));
    },
    async deleteUser(id) {
      return messageRequest(`/users/${id}`, "DELETE");
    },
    async enableUser(id) {
      return messageRequest(`/users/${id}/enable`, "POST");
    },
    async disableUser(id) {
      return messageRequest(`/users/${id}/disable`, "POST");
    },
    async extendUser(id, days) {
      return parseExtend(await request(`/users/${id}/extend`, { method: "POST", body: { days } }));
    },
    async resetPassword(id) {
      return parseReset(await request(`/users/${id}/reset-password`, { method: "POST" }), options.publicBase);
    },
    async listInvitations() {
      const invites = asArray(asRecord(await request("/invitations"))?.invitations).map((item) =>
        parseInvitation(item, options.publicBase),
      );
      return invites.sort((a, b) => b.id - a.id);
    },
    async createInvitation(input) {
      const created = await request("/invitations", {
        method: "POST",
        body: invitationBody(input),
      });
      const record = asRecord(created);
      const invitation = record?.invitation ?? created;
      return parseInvitation(invitation, options.publicBase);
    },
    async deleteInvitation(id) {
      return messageRequest(`/invitations/${id}`, "DELETE");
    },
    async listLibraries() {
      const libraries = asArray(asRecord(await request("/libraries"))?.libraries).map(parseLibrary);
      return libraries.sort((a, b) => compareText(`${a.serverName}:${a.name}`, `${b.serverName}:${b.name}`));
    },
    async listServers() {
      const servers = asArray(asRecord(await request("/servers"))?.servers).map(parseServer);
      return servers.sort((a, b) => a.id - b.id);
    },
  };
}

export function invitationBody(input: CreateInvitationInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    server_ids: input.serverIds,
    duration: input.unlimited ? "unlimited" : input.duration,
    unlimited: input.unlimited,
    allow_downloads: input.allowDownloads,
    allow_live_tv: input.allowLiveTv,
    allow_mobile_uploads: input.allowMobileUploads,
  };
  if (input.expiresInDays) body.expires_in_days = input.expiresInDays;
  if (input.libraryIds.length) body.library_ids = input.libraryIds;
  return body;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 300) };
  }
}

export function extractError(data: unknown): string | null {
  const record = asRecord(data);
  if (!record) return null;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  const nested = asRecord(record.message);
  if (typeof nested?.error === "string") return nested.error;
  return null;
}

function parseStatus(data: unknown): StatusInfo {
  const record = asRecord(data);
  return {
    users: numberOf(record?.users),
    invites: numberOf(record?.invites),
    pending: numberOf(record?.pending),
    expired: numberOf(record?.expired),
  };
}

function parseUser(data: unknown): UserInfo {
  const record = asRecord(data) ?? {};
  return {
    id: numberOf(record.id),
    username: stringOf(record.username) ?? "",
    email: stringOf(record.email),
    server: stringOf(record.server) ?? "",
    serverType: stringOf(record.server_type) ?? "unknown",
    expires: stringOf(record.expires),
  };
}

function parseInvitation(data: unknown, publicBase: string): InvitationInfo {
  const record = asRecord(data) ?? {};
  const code = stringOf(record.code) ?? "";
  const rawUrl = stringOf(record.url);
  return {
    id: numberOf(record.id),
    code,
    url: toPublicUrl(publicBase, rawUrl || (code ? `/j/${code}` : "")),
    status: stringOf(record.status) ?? "pending",
    created: stringOf(record.created),
    expires: stringOf(record.expires),
    usedAt: stringOf(record.used_at),
    usedBy: stringOf(record.used_by),
    duration: stringOf(record.duration) ?? "unlimited",
    unlimited: typeof record.unlimited === "boolean" ? record.unlimited : stringOf(record.duration) === "unlimited",
    libraryIds: numberList(record.specific_libraries),
    serverNames: asArray(record.server_names).map((name) => stringOf(name) ?? "").filter(Boolean),
  };
}

function parseLibrary(data: unknown): LibraryInfo {
  const record = asRecord(data) ?? {};
  return {
    id: numberOf(record.id),
    name: stringOf(record.name) ?? "",
    externalId: stringOf(record.external_id),
    serverId: record.server_id == null ? null : numberOf(record.server_id),
    serverName: stringOf(record.server_name) ?? "",
    enabled: record.enabled !== false,
  };
}

function parseServer(data: unknown): ServerInfo {
  const record = asRecord(data) ?? {};
  return {
    id: numberOf(record.id),
    name: stringOf(record.name) ?? "",
    serverType: stringOf(record.server_type) ?? "unknown",
    serverUrl: stringOf(record.server_url),
    externalUrl: stringOf(record.external_url),
    verified: record.verified === true,
    allowDownloads: record.allow_downloads === true,
    allowLiveTv: record.allow_live_tv === true,
    allowMobileUploads: record.allow_mobile_uploads === true,
  };
}

function parseExtend(data: unknown): ExtendResult {
  const record = asRecord(data) ?? {};
  return {
    message: stringOf(record.message),
    newExpiry: stringOf(record.new_expiry),
  };
}

function parseReset(data: unknown, publicBase: string): PasswordResetInfo {
  const record = asRecord(data) ?? {};
  const rawUrl = stringOf(record.url) ?? "";
  return {
    message: stringOf(record.message),
    url: toPublicUrl(publicBase, rawUrl),
    expiresAt: stringOf(record.expires_at),
  };
}

function messageOf(data: unknown): string | null {
  return extractError(data) ?? stringOf(asRecord(data)?.message);
}

async function readBody(response: {
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
  status?: number;
}): Promise<string> {
  if (typeof response.text === "function") return response.text();
  if (typeof response.json === "function") {
    const data = await response.json();
    return typeof data === "string" ? data : JSON.stringify(data ?? "");
  }
  throw new WizarrError("無法讀取 Wizarr 回應", response.status ?? 0);
}

function isOk(response: { ok?: boolean; status?: number }): boolean {
  if (typeof response.ok === "boolean") return response.ok;
  const status = response.status ?? 0;
  return status >= 200 && status < 300;
}

function endpointOrigin(apiBase: string): string {
  return /^(https?:\/\/[^/?#]+)/i.exec(apiBase)?.[1] ?? apiBase;
}

/**
 * 絕對網址若落在區網，改寫到公開根網址，避免邀請與重設密碼連結、QR code 指向客人打不開的位址。
 * 已是公開絕對網址則保留（Wizarr 可能回傳與 WIZARR_PUBLIC_URL 不同的正式網址）。
 */
function toPublicUrl(publicBase: string, raw: string): string {
  if (!/^https?:\/\//i.test(raw)) return absoluteUrl(publicBase, raw);
  const match = /^(https?:\/\/[^/?#]+)([^#]*)/i.exec(raw);
  if (!match || !isPrivateHost(match[1])) return raw;
  return absoluteUrl(publicBase, match[2] || "/");
}

function isPrivateHost(origin: string): boolean {
  const host = origin
    .replace(/^https?:\/\//i, "")
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "host.docker.internal"
  ) {
    return true;
  }
  // fc00::/7（ULA）與 fe80::/10（link-local）。
  if (/^f[cd][0-9a-f:]*$/.test(host) || /^fe[89ab][0-9a-f:]*$/.test(host)) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  return a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

function compareText(a: string, b: string): number {
  try {
    return a.localeCompare(b, "zh-Hant");
  } catch {
    return a < b ? -1 : a > b ? 1 : 0;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
}

function numberList(value: unknown): number[] {
  return asArray(value).map(numberOf).filter((id) => id > 0);
}
