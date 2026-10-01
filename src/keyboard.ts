import type { Catalog } from "./i18n/catalog.ts";
import type { InviteFilter, PermissionFlags, ReplyMarkup, UserAction } from "./types.ts";

export const PAGE = {
  users: 8,
  invites: 5,
  libraries: 8,
  servers: 8,
} as const;

export function inviteFilterOf(cat: Catalog, text: string): InviteFilter | undefined {
  const b = cat.buttons;
  const filters: Record<string, InviteFilter> = {
    [b.listInvites]: "all",
    [b.pendingInvites]: "pending",
    [b.usedInvites]: "used",
    [b.expiredInvites]: "expired",
  };
  if (!Object.hasOwn(filters, text)) return undefined;
  return filters[text];
}

export function userActionOf(cat: Catalog, text: string): UserAction | undefined {
  const b = cat.buttons;
  const actions: Record<string, UserAction> = {
    [b.enableUser]: "enable",
    [b.disableUser]: "disable",
    [b.extendUser]: "extend",
    [b.deleteUser]: "delete",
    [b.resetPassword]: "reset",
  };
  if (!Object.hasOwn(actions, text)) return undefined;
  return actions[text];
}

export function navRow(cat: Catalog, page: number, pages: number): string[] {
  const nav: string[] = [];
  if (page > 0) nav.push(cat.buttons.prev);
  if (page < pages - 1) nav.push(cat.buttons.next);
  return nav;
}

export function markup(rows: string[][], placeholder?: string): ReplyMarkup {
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    is_persistent: true,
    ...(placeholder ? { input_field_placeholder: placeholder } : {}),
  };
}

export function mainKeyboard(cat: Catalog): ReplyMarkup {
  const b = cat.buttons;
  return markup(
    [
      [b.quickInvite],
      [b.status, b.users],
      [b.invites, b.settings],
      [b.help],
    ],
    cat.ph.main,
  );
}

/** 狀態分類的子選單：使用者統計、伺服器與媒體庫列表。 */
export function statusKeyboard(cat: Catalog): ReplyMarkup {
  const b = cat.buttons;
  return markup([[b.userStatus], [b.serverStatus], [b.libraryStatus], [b.home]], cat.ph.status);
}

export function usersKeyboard(cat: Catalog): ReplyMarkup {
  const b = cat.buttons;
  return markup(
    [
      [b.listUsers, b.enableUser],
      [b.disableUser, b.extendUser],
      [b.deleteUser, b.resetPassword],
      [b.home],
    ],
    cat.ph.users,
  );
}

export function invitesKeyboard(cat: Catalog): ReplyMarkup {
  const b = cat.buttons;
  return markup(
    [
      [b.quickInvite],
      [b.listInvites, b.pendingInvites],
      [b.usedInvites, b.expiredInvites],
      [b.createInvite, b.deleteInvite],
      [b.home],
    ],
    cat.ph.invites,
  );
}

export function settingsKeyboard(cat: Catalog): ReplyMarkup {
  const b = cat.buttons;
  return markup(
    [
      [b.quickSettings, b.setLanguage],
      [b.resetSettings],
      [b.home],
    ],
    cat.ph.settings,
  );
}

/** 設定 → 快速邀請分類的子選單。 */
export function quickSettingsKeyboard(cat: Catalog): ReplyMarkup {
  const b = cat.buttons;
  return markup(
    [
      [b.setExpiry, b.setDuration],
      [b.setPermissions, b.setLibraries],
      [b.reuseCode],
      [b.backSettings, b.home],
    ],
    cat.ph.settings,
  );
}

export function confirmKeyboard(cat: Catalog): ReplyMarkup {
  return markup([[cat.buttons.confirm, cat.buttons.cancel], [cat.buttons.home]], cat.ph.confirm);
}

export function removeKeyboard(): ReplyMarkup {
  return { remove_keyboard: true };
}

export function withNav(cat: Catalog, base: ReplyMarkup, page: number, pages: number): ReplyMarkup {
  if (!("keyboard" in base)) return base;
  const nav = navRow(cat, page, pages);
  const rows = base.keyboard.map((row) => row.map((button) => button.text));
  return markup(nav.length ? [nav, ...rows] : rows, base.input_field_placeholder);
}

export function userButton(cat: Catalog, id: number): string {
  return labeledButton(cat.labels.user, id);
}

export function serverButton(cat: Catalog, id: number, selected = false): string {
  return toggleButton(cat.labels.server, id, selected);
}

export function libraryButton(cat: Catalog, id: number, selected: boolean): string {
  return toggleButton(cat.labels.library, id, selected);
}

export function deleteInviteButton(cat: Catalog, id: number): string {
  return labeledButton(cat.labels.deleteInvite, id);
}

export function parseUserButton(cat: Catalog, text: string): number | null {
  return parseLabeledId(cat.labels.user, text);
}

export function parseServerButton(cat: Catalog, text: string): number | null {
  return parseToggleButton(cat.labels.server, text);
}

export function parseLibraryButton(cat: Catalog, text: string): number | null {
  return parseToggleButton(cat.labels.library, text);
}

export function parseDeleteInviteButton(cat: Catalog, text: string): number | null {
  return parseLabeledId(cat.labels.deleteInvite, text);
}

function labeledButton(label: string, id: number): string {
  return `${label} #${id}`;
}

function toggleButton(label: string, id: number, selected: boolean): string {
  return `${selected ? "✅ " : ""}${labeledButton(label, id)}`;
}

function parseLabeledId(label: string, text: string): number | null {
  return parseId(text, new RegExp(`^${escapeRegExp(label)} #(\\d+)$`));
}

function parseToggleButton(label: string, text: string): number | null {
  return parseId(text, new RegExp(`^(?:✅ )?${escapeRegExp(label)} #(\\d+)$`));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function permissionKeyboard(cat: Catalog, flags: PermissionFlags, done: string = cat.buttons.nextStep): ReplyMarkup {
  const b = cat.buttons;
  return markup(
    [
      [b.toggleDownloads, b.toggleLive],
      [b.toggleUploads],
      [done],
      [b.cancel, b.home],
    ],
    cat.permissionPlaceholder(flags),
  );
}

function parseId(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  if (!match?.[1]) return null;
  return Number(match[1]);
}
