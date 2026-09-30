import type { QuickInviteSettings, QuickLibraryMatcher, SessionStore } from "./types.ts";

const SETTINGS_KEY = "settings:quick-invite";
const SETTINGS_TTL_SECONDS = 365 * 24 * 60 * 60;
const EXPIRY_DAYS = new Set([1, 7, 30]);

export function defaultQuickSettings(): QuickInviteSettings {
  return {
    expiresInDays: 7,
    duration: "unlimited",
    unlimited: true,
    allowDownloads: false,
    allowLiveTv: false,
    allowMobileUploads: false,
    libraries: null,
  };
}

export async function loadQuickSettings(store: SessionStore): Promise<QuickInviteSettings> {
  const raw = await store.getText(SETTINGS_KEY);
  if (!raw) return defaultQuickSettings();
  try {
    return parseQuickSettings(JSON.parse(raw)) ?? defaultQuickSettings();
  } catch {
    return defaultQuickSettings();
  }
}

export async function saveQuickSettings(store: SessionStore, settings: QuickInviteSettings): Promise<void> {
  await store.setText(SETTINGS_KEY, JSON.stringify(settings), SETTINGS_TTL_SECONDS);
}

export function parseQuickSettings(value: unknown): QuickInviteSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const expiresInDays = record.expiresInDays;
  if (!(expiresInDays === null || (typeof expiresInDays === "number" && EXPIRY_DAYS.has(expiresInDays)))) return null;
  if (typeof record.duration !== "string" || !record.duration) return null;
  if (typeof record.unlimited !== "boolean") return null;
  if (typeof record.allowDownloads !== "boolean") return null;
  if (typeof record.allowLiveTv !== "boolean") return null;
  if (typeof record.allowMobileUploads !== "boolean") return null;
  const libraries = parseMatchers(record.libraries);
  if (libraries === undefined) return null;
  return {
    expiresInDays: expiresInDays as QuickInviteSettings["expiresInDays"],
    duration: record.duration,
    unlimited: record.unlimited,
    allowDownloads: record.allowDownloads,
    allowLiveTv: record.allowLiveTv,
    allowMobileUploads: record.allowMobileUploads,
    libraries,
  };
}

function parseMatchers(value: unknown): QuickLibraryMatcher[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value)) return undefined;
  const matchers: QuickLibraryMatcher[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || !record.name) return undefined;
    if (record.externalId !== null && typeof record.externalId !== "string") return undefined;
    matchers.push({ name: record.name, externalId: record.externalId });
  }
  return matchers;
}

export function sameQuickSettings(a: QuickInviteSettings, b: QuickInviteSettings): boolean {
  return (
    a.expiresInDays === b.expiresInDays &&
    a.duration === b.duration &&
    a.unlimited === b.unlimited &&
    a.allowDownloads === b.allowDownloads &&
    a.allowLiveTv === b.allowLiveTv &&
    a.allowMobileUploads === b.allowMobileUploads &&
    sameMatchers(a.libraries, b.libraries)
  );
}

function sameMatchers(a: QuickLibraryMatcher[] | null, b: QuickLibraryMatcher[] | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  const keys = (list: QuickLibraryMatcher[]) => list.map((item) => `${item.name} ${item.externalId ?? ""}`).sort();
  const left = keys(a);
  const right = keys(b);
  return left.every((key, index) => key === right[index]);
}
