import type { Screen, SessionStore } from "./types.ts";

export const SCREEN_PARENT = {
  main: "main",
  users: "users",
  user_list: "users",
  pick_user: "users",
  extend_days: "users",
  invites: "invites",
  invite_list: "invites",
  invite_server: "invites",
  invite_expiry: "invites",
  invite_duration: "invites",
  invite_library_mode: "invites",
  invite_library_pick: "invites",
  invite_permissions: "invites",
  delete_invite_pick: "invites",
  library_list: "main",
  server_list: "main",
  settings: "main",
  settings_quick: "settings",
  settings_expiry: "settings_quick",
  settings_duration: "settings_quick",
  settings_permissions: "settings_quick",
  settings_library_server: "settings_quick",
  settings_library_pick: "settings_quick",
  settings_lang: "settings",
  confirm: "main",
} as const satisfies Record<Screen["type"], "main" | "users" | "invites" | "settings" | "settings_quick">;

const SCREEN_TYPES = new Set<Screen["type"]>(Object.keys(SCREEN_PARENT) as Screen["type"][]);
const INVITE_FILTERS = new Set(["all", "pending", "used", "expired"]);
const USER_ACTIONS = new Set(["enable", "disable", "extend", "delete", "reset"]);
const EXPIRY_DAYS = new Set([1, 7, 30]);

export function isScreen(value: unknown): value is Screen {
  const record = asRecord(value);
  if (!record || typeof record.type !== "string" || !SCREEN_TYPES.has(record.type as Screen["type"])) return false;
  switch (record.type) {
    case "main":
    case "users":
    case "invites":
    case "settings":
    case "settings_quick":
    case "settings_expiry":
    case "settings_duration":
    case "settings_lang":
      return true;
    case "invite_server":
    case "settings_library_server":
      return Array.isArray(record.selectedIds) && (record.selectedIds as unknown[]).every(isNumber);
    case "user_list":
    case "library_list":
    case "server_list":
    case "delete_invite_pick":
      return isNumber(record.page);
    case "invite_list":
      return isNumber(record.page) && typeof record.filter === "string" && INVITE_FILTERS.has(record.filter);
    case "pick_user":
      return isNumber(record.page) && typeof record.action === "string" && USER_ACTIONS.has(record.action);
    case "extend_days":
      return isNumber(record.userId) && typeof record.username === "string";
    case "invite_expiry":
    case "invite_duration":
    case "invite_library_mode":
    case "invite_permissions":
      return isDraft(record.draft);
    case "invite_library_pick":
      return isNumber(record.page) && isDraft(record.draft);
    case "settings_permissions":
      return isPermissionFlags(record.permissions);
    case "settings_library_pick":
      return (
        Array.isArray(record.serverIds) &&
        Array.isArray(record.serverNames) &&
        (record.serverNames as unknown[]).every((name) => typeof name === "string") &&
        Array.isArray(record.selectedIds) &&
        isNumber(record.page)
      );
    case "confirm":
      return isPending(record.pending);
    default:
      return false;
  }
}

class MemoryStore<T> {
  private readonly rows = new Map<string, { value: T; expires: number }>();

  get(key: string): T | null {
    const row = this.rows.get(key);
    if (!row) return null;
    if (row.expires <= Date.now()) {
      this.rows.delete(key);
      return null;
    }
    return row.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    this.rows.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }

  delete(key: string): void {
    this.rows.delete(key);
  }
}

export class MemorySessionStore implements SessionStore {
  private readonly screens = new MemoryStore<Screen>();
  private readonly text = new MemoryStore<string>();

  async get(key: string): Promise<Screen | null> {
    return this.screens.get(key);
  }

  async set(key: string, value: Screen, ttlSeconds: number): Promise<void> {
    this.screens.set(key, value, ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    this.screens.delete(key);
  }

  async getText(key: string): Promise<string | null> {
    return this.text.get(key);
  }

  async setText(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.text.set(key, value, ttlSeconds);
  }
}

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class KvSessionStore implements SessionStore {
  private readonly kv: KvLike;

  constructor(kv: KvLike) {
    this.kv = kv;
  }

  async get(key: string): Promise<Screen | null> {
    const raw = await this.kv.get(`session:${key}`);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isScreen(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: Screen, ttlSeconds: number): Promise<void> {
    await this.kv.put(`session:${key}`, JSON.stringify(value), { expirationTtl: ttl(ttlSeconds) });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(`session:${key}`);
  }

  async getText(key: string): Promise<string | null> {
    return this.kv.get(`data:${key}`);
  }

  async setText(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.kv.put(`data:${key}`, value, { expirationTtl: ttl(ttlSeconds) });
  }
}

function ttl(seconds: number): number {
  return Math.max(60, Math.floor(seconds));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function isNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function isDraft(value: unknown): boolean {
  const draft = asRecord(value);
  return Boolean(
    draft &&
      Array.isArray(draft.serverIds) &&
      Array.isArray(draft.serverNames) &&
      Array.isArray(draft.libraryIds) &&
      Array.isArray(draft.libraryNames) &&
      isPermissionFlags(draft),
  );
}

function isPermissionFlags(value: unknown): boolean {
  const flags = asRecord(value);
  return Boolean(
    flags &&
      typeof flags.allowDownloads === "boolean" &&
      typeof flags.allowLiveTv === "boolean" &&
      typeof flags.allowMobileUploads === "boolean",
  );
}

function isPending(value: unknown): boolean {
  const pending = asRecord(value);
  if (!pending || typeof pending.kind !== "string") return false;
  if (pending.kind === "disable_user" || pending.kind === "delete_user") {
    return isNumber(pending.userId) && typeof pending.username === "string";
  }
  if (pending.kind === "delete_invite") {
    return isNumber(pending.invitationId) && typeof pending.code === "string";
  }
  if (pending.kind === "create_invite") {
    const input = asRecord(pending.input);
    return (
      Boolean(input) &&
      Array.isArray(input?.serverIds) &&
      (input?.expiresInDays === null || EXPIRY_DAYS.has(input?.expiresInDays as number)) &&
      typeof input?.duration === "string" &&
      typeof input?.unlimited === "boolean" &&
      Array.isArray(input?.libraryIds) &&
      typeof input?.allowDownloads === "boolean" &&
      typeof input?.allowLiveTv === "boolean" &&
      typeof input?.allowMobileUploads === "boolean"
    );
  }
  return false;
}
