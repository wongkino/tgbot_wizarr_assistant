import type { Screen, SessionStore } from "./types.ts";

const SCREEN_TYPES = new Set<Screen["type"]>([
  "main",
  "users",
  "invites",
  "libraries",
  "servers",
  "user_list",
  "invite_list",
  "library_list",
  "server_list",
  "pick_user",
  "extend_days",
  "invite_server",
  "quick_invite_server",
  "invite_expiry",
  "invite_duration",
  "invite_library_mode",
  "invite_library_pick",
  "invite_permissions",
  "delete_invite_pick",
  "confirm",
]);

export function isScreen(value: unknown): value is Screen {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" && SCREEN_TYPES.has(type as Screen["type"]);
}

export class MemorySessionStore implements SessionStore {
  private readonly rows = new Map<string, { value: Screen; expires: number }>();

  async get(key: string): Promise<Screen | null> {
    const row = this.rows.get(key);
    if (!row) return null;
    if (row.expires <= Date.now()) {
      this.rows.delete(key);
      return null;
    }
    return row.value;
  }

  async set(key: string, value: Screen, ttlSeconds: number): Promise<void> {
    this.rows.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.rows.delete(key);
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
    await this.kv.put(`session:${key}`, JSON.stringify(value), {
      expirationTtl: Math.max(60, Math.floor(ttlSeconds)),
    });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(`session:${key}`);
  }
}
