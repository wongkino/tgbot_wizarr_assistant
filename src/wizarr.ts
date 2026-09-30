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

    let response: Response;
    try {
      response = await fetchImpl(`${apiBase}${path}`, {
        method: init?.method ?? "GET",
        headers,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new WizarrError(reason, 0, true);
    }

    const text = await response.text();
    const data = text ? parseJson(text) : null;
    if (!response.ok) {
      throw new WizarrError(extractError(data) ?? `HTTP ${response.status}`, response.status);
    }
    return data;
  }

  return {
    async getStatus() {
      return parseStatus(await request("/status"));
    },
    async listUsers(query) {
      const search = new URLSearchParams();
      if (query?.username) search.set("username", query.username);
      const suffix = search.size ? `?${search.toString()}` : "";
      const users = asArray(asRecord(await request(`/users${suffix}`))?.users).map(parseUser);
      return users.sort((a, b) => a.username.localeCompare(b.username, "zh-Hant"));
    },
    async deleteUser(id) {
      return messageOf(await request(`/users/${id}`, { method: "DELETE" }));
    },
    async enableUser(id) {
      return messageOf(await request(`/users/${id}/enable`, { method: "POST" }));
    },
    async disableUser(id) {
      return messageOf(await request(`/users/${id}/disable`, { method: "POST" }));
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
      return messageOf(await request(`/invitations/${id}`, { method: "DELETE" }));
    },
    async listLibraries() {
      const libraries = asArray(asRecord(await request("/libraries"))?.libraries).map(parseLibrary);
      return libraries.sort((a, b) =>
        `${a.serverName}:${a.name}`.localeCompare(`${b.serverName}:${b.name}`, "zh-Hant"),
      );
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
    url: absoluteUrl(publicBase, rawUrl || (code ? `/j/${code}` : "")),
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
    url: absoluteUrl(publicBase, rawUrl),
    expiresAt: stringOf(record.expires_at),
  };
}

function messageOf(data: unknown): string | null {
  return extractError(data) ?? stringOf(asRecord(data)?.message);
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
