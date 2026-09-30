import type { InviteDraft, InviteFilter, ReplyMarkup, UserAction } from "./types.ts";

export const PAGE = {
  users: 8,
  invites: 5,
  libraries: 8,
  servers: 8,
} as const;

export const B = {
  status: "📊 狀態",
  users: "👥 使用者",
  invites: "✉️ 邀請",
  libraries: "📚 媒體庫",
  servers: "🖥️ 伺服器",
  help: "❓ 說明",
  home: "⬅️ 主選單",
  listUsers: "📋 列出使用者",
  enableUser: "✅ 啟用使用者",
  disableUser: "🚫 停用使用者",
  extendUser: "⏳ 延長到期",
  deleteUser: "🗑️ 刪除使用者",
  resetPassword: "🔑 重設密碼",
  listInvites: "📋 全部邀請",
  pendingInvites: "⏳ 待使用",
  usedInvites: "✅ 已使用",
  expiredInvites: "⌛ 已過期",
  createInvite: "➕ 建立邀請",
  deleteInvite: "🗑️ 刪除邀請",
  listLibraries: "📋 列出媒體庫",
  listServers: "📋 列出伺服器",
  confirm: "✅ 確認",
  cancel: "❌ 取消",
  prev: "◀️ 上一頁",
  next: "▶️ 下一頁",
  expiry1: "連結 1 天",
  expiry7: "連結 7 天",
  expiry30: "連結 30 天",
  expiryNever: "連結不過期",
  dur7: "帳號 7 天",
  dur30: "帳號 30 天",
  dur90: "帳號 90 天",
  durUnlimited: "帳號無限制",
  allLibraries: "使用全部媒體庫",
  pickLibraries: "自訂媒體庫",
  librariesDone: "媒體庫選好了",
  nextStep: "➡️ 下一步",
  toggleDownloads: "切換下載",
  toggleLive: "切換直播",
  toggleUploads: "切換上傳",
  days7: "延長 7 天",
  days30: "延長 30 天",
  days90: "延長 90 天",
} as const;

const INVITE_FILTERS = {
  [B.listInvites]: "all",
  [B.pendingInvites]: "pending",
  [B.usedInvites]: "used",
  [B.expiredInvites]: "expired",
} as const satisfies Record<string, InviteFilter>;

const USER_ACTIONS = {
  [B.enableUser]: "enable",
  [B.disableUser]: "disable",
  [B.extendUser]: "extend",
  [B.deleteUser]: "delete",
  [B.resetPassword]: "reset",
} as const satisfies Record<string, UserAction>;

export function inviteFilterOf(text: string): InviteFilter | undefined {
  if (!Object.hasOwn(INVITE_FILTERS, text)) return undefined;
  return INVITE_FILTERS[text as keyof typeof INVITE_FILTERS];
}

export function userActionOf(text: string): UserAction | undefined {
  if (!Object.hasOwn(USER_ACTIONS, text)) return undefined;
  return USER_ACTIONS[text as keyof typeof USER_ACTIONS];
}

export function markup(rows: string[][], placeholder?: string): ReplyMarkup {
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    is_persistent: true,
    ...(placeholder ? { input_field_placeholder: placeholder } : {}),
  };
}

export function mainKeyboard(): ReplyMarkup {
  return markup(
    [
      [B.status, B.users],
      [B.invites, B.libraries],
      [B.servers, B.help],
    ],
    "選擇功能",
  );
}

export function usersKeyboard(): ReplyMarkup {
  return markup(
    [
      [B.listUsers, B.enableUser],
      [B.disableUser, B.extendUser],
      [B.deleteUser, B.resetPassword],
      [B.home],
    ],
    "選擇使用者操作",
  );
}

export function invitesKeyboard(): ReplyMarkup {
  return markup(
    [
      [B.listInvites, B.pendingInvites],
      [B.usedInvites, B.expiredInvites],
      [B.createInvite, B.deleteInvite],
      [B.home],
    ],
    "選擇邀請操作",
  );
}

export function librariesKeyboard(): ReplyMarkup {
  return markup([[B.listLibraries], [B.home]], "媒體庫");
}

export function serversKeyboard(): ReplyMarkup {
  return markup([[B.listServers], [B.home]], "伺服器");
}

export function confirmKeyboard(): ReplyMarkup {
  return markup([[B.confirm, B.cancel], [B.home]], "確認或取消");
}

export function cancelKeyboard(): ReplyMarkup {
  return markup([[B.cancel, B.home]], "可取消");
}

export function removeKeyboard(): ReplyMarkup {
  return { remove_keyboard: true };
}

export function withNav(base: ReplyMarkup, page: number, pages: number): ReplyMarkup {
  if (!("keyboard" in base)) return base;
  const nav: string[] = [];
  if (page > 0) nav.push(B.prev);
  if (page < pages - 1) nav.push(B.next);
  const rows = base.keyboard.map((row) => row.map((button) => button.text));
  return markup(nav.length ? [nav, ...rows] : rows, base.input_field_placeholder);
}

export function userButton(id: number): string {
  return `使用者 #${id}`;
}

export function serverButton(id: number): string {
  return `伺服器 #${id}`;
}

export function libraryButton(id: number, selected: boolean): string {
  return selected ? `✅ 媒體庫 #${id}` : `媒體庫 #${id}`;
}

export function deleteInviteButton(id: number): string {
  return `刪除邀請 #${id}`;
}

export function parseUserButton(text: string): number | null {
  return parseId(text, /^使用者 #(\d+)$/);
}

export function parseServerButton(text: string): number | null {
  return parseId(text, /^伺服器 #(\d+)$/);
}

export function parseLibraryButton(text: string): number | null {
  return parseId(text, /^(?:✅ )?媒體庫 #(\d+)$/);
}

export function parseDeleteInviteButton(text: string): number | null {
  return parseId(text, /^刪除邀請 #(\d+)$/);
}

export function permissionKeyboard(draft: InviteDraft): ReplyMarkup {
  return markup(
    [
      [B.toggleDownloads, B.toggleLive],
      [B.toggleUploads],
      [B.nextStep],
      [B.cancel, B.home],
    ],
    `下載${flag(draft.allowDownloads)} · 直播${flag(draft.allowLiveTv)} · 上傳${flag(draft.allowMobileUploads)}`,
  );
}

function flag(value: boolean): string {
  return value ? "開" : "關";
}

function parseId(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  if (!match?.[1]) return null;
  return Number(match[1]);
}
