import { B } from "./keyboard.ts";
import type {
  InvitationInfo,
  InviteDraft,
  InviteFilter,
  LibraryInfo,
  ServerInfo,
  StatusInfo,
  UserAction,
  UserInfo,
} from "./types.ts";

export interface PageView<T> {
  page: number;
  pages: number;
  total: number;
  items: T[];
}

export function pageWindow<T>(items: T[], page: number, size: number): PageView<T> {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const start = current * size;
  return {
    page: current,
    pages,
    total: items.length,
    items: items.slice(start, start + size),
  };
}

export function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escAttr(value: string): string {
  return esc(value).replaceAll('"', "&quot;");
}

export function link(url: string): string {
  if (!/^https?:\/\//i.test(url)) return esc(url);
  const safe = escAttr(url);
  return `<a href="${safe}">${safe}</a>`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "無期限";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return esc(value);
  return new Intl.DateTimeFormat("zh-Hant-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function welcomeText(): string {
  return [
    "<b>Wizarr 助理</b>",
    "用底部的回覆鍵盤管理邀請、使用者、媒體庫與伺服器。",
    "",
    `${B.quickInvite} 直接建立邀請`,
    `${B.status} 查看統計`,
    `${B.users} 管理使用者`,
    `${B.invites} 建立或刪除邀請`,
    `${B.libraries} 查看媒體庫`,
    `${B.servers} 查看媒體伺服器`,
    "",
    "輸入 /cancel 可取消目前步驟，/id 可查看你的 Telegram ID。",
  ].join("\n");
}

export const QUICK_LIBRARIES = [
  { name: "動畫-已完結", externalId: "611380" },
  { name: "動畫-連載中", externalId: "598899" },
  { name: "電影", externalId: "4" },
  { name: "電視", externalId: "4761" },
] as const;

export function helpText(): string {
  const libraries = QUICK_LIBRARIES.map((library) => library.name).join("、");
  return [
    "<b>使用說明</b>",
    "所有功能都從底部回覆鍵盤進入。",
    "",
    "<b>使用者</b>",
    "可列出、啟用、停用、延長到期、刪除，以及產生重設密碼連結。",
    "停用時若媒體伺服器不支援，Wizarr 會改為刪除該帳號。",
    "",
    "<b>邀請</b>",
    "可依狀態列出、用快速邀請直接建立，或逐步建立邀請，也可以刪除尚未使用的邀請連結。",
    "列出或建立邀請時，會同時送出邀請網址的 QR code。",
    "快速邀請會立即建立：連結 7 天、只使用 Emby、帳號無限制，下載、直播與上傳皆關閉。",
    `媒體庫固定為${libraries}。`,
    "刪除邀請不會移除已經建立的媒體帳號。",
    "",
    "<b>媒體庫 / 伺服器</b>",
    "顯示 Wizarr 目前已知的媒體庫與已連接伺服器。",
  ].join("\n");
}

export function unauthorizedText(userId: number): string {
  return [
    "這個帳號未獲授權。",
    `你的 Telegram ID：<code>${userId}</code>`,
    "請管理員把這個 ID 加入 TELEGRAM_ADMIN_IDS。",
  ].join("\n");
}

export function formatStatus(status: StatusInfo): string {
  return [
    "<b>Wizarr 狀態</b>",
    `使用者：${status.users}`,
    `邀請：${status.invites}`,
    `待使用：${status.pending}`,
    `已過期：${status.expired}`,
  ].join("\n");
}

function formatPaged<T>(
  view: PageView<T>,
  title: string,
  unit: string,
  empty: string,
  linesFor: (item: T) => string[],
): string {
  if (view.total === 0) return empty;
  const lines = [`<b>${title}</b>（第 ${view.page + 1}/${view.pages} 頁，共 ${view.total} ${unit}）`, ""];
  for (const item of view.items) lines.push(...linesFor(item), "");
  return lines.join("\n").trimEnd();
}

function permissionLines(permissions: {
  allowDownloads: boolean;
  allowLiveTv: boolean;
  allowMobileUploads: boolean;
}): string[] {
  return [
    `下載：${yn(permissions.allowDownloads)}`,
    `直播：${yn(permissions.allowLiveTv)}`,
    `手機上傳：${yn(permissions.allowMobileUploads)}`,
  ];
}

export function formatUserList(view: PageView<UserInfo>): string {
  return formatPaged(view, "使用者", "人", "目前沒有使用者。", (user) => [
    `<b>#${user.id}</b> ${esc(user.username)}`,
    `${esc(user.server)}（${esc(user.serverType)}）· ${user.email ? esc(user.email) : "沒有電郵"}`,
    `到期：${formatDate(user.expires)}`,
  ]);
}

export function formatInviteList(view: PageView<InvitationInfo>, filter: InviteFilter): string {
  const title = filterLabel(filter);
  return formatPaged(view, title, "個", `目前沒有${title}。`, (invite) => {
    const servers = invite.serverNames.length ? invite.serverNames.map(esc).join("、") : "未指定";
    return [
      `<b>#${invite.id}</b> <code>${esc(invite.code)}</code> · ${esc(statusLabel(invite.status))}`,
      `伺服器：${servers}`,
      `連結到期：${formatDate(invite.expires)} · 帳號：${esc(durationLabel(invite.duration, invite.unlimited))}`,
      link(invite.url),
    ];
  });
}

export function formatLibraries(view: PageView<LibraryInfo>): string {
  return formatPaged(view, "媒體庫", "個", "目前沒有媒體庫。", (library) => [
    `<b>#${library.id}</b> ${esc(library.name)} · ${library.enabled ? "已啟用" : "已停用"}`,
    `${esc(library.serverName)}${library.externalId ? ` · ${esc(library.externalId)}` : ""}`,
  ]);
}

export function formatServers(view: PageView<ServerInfo>): string {
  return formatPaged(view, "伺服器", "台", "目前沒有媒體伺服器。", (server) => [
    `<b>#${server.id}</b> ${esc(server.name)}（${esc(server.serverType)}）`,
    server.verified ? "已驗證" : "未驗證",
    server.serverUrl ? `內部：${esc(server.serverUrl)}` : "內部網址：沒有",
    server.externalUrl ? `外部：${esc(server.externalUrl)}` : "外部網址：沒有",
    `下載 ${yn(server.allowDownloads)} · 直播 ${yn(server.allowLiveTv)} · 上傳 ${yn(server.allowMobileUploads)}`,
  ]);
}

export function formatServerChoices(servers: ServerInfo[]): string {
  const lines = ["選擇要邀請的伺服器：", ""];
  for (const server of servers) {
    lines.push(`<b>#${server.id}</b> ${esc(server.name)}（${esc(server.serverType)}）`);
  }
  return lines.join("\n");
}

export function formatLibraryChoices(view: PageView<LibraryInfo>, selected: number[]): string {
  const lines = [
    "<b>選擇媒體庫</b>",
    "再按一次可取消選取。選好後按「媒體庫選好了」。",
    selected.length ? `已選：${selected.map((id) => `#${id}`).join("、")}` : "尚未選取",
    "",
  ];
  for (const library of view.items) {
    const mark = selected.includes(library.id) ? "✅" : "▫️";
    lines.push(`${mark} <b>#${library.id}</b> ${esc(library.name)}`);
  }
  return lines.join("\n");
}

export function formatPermissions(draft: InviteDraft): string {
  return ["<b>邀請權限</b>", ...permissionLines(draft), "", "可切換後按下一步。"].join("\n");
}

export function formatInviteSummary(draft: InviteDraft): string {
  const libraries = draft.useAllLibraries
    ? "全部已啟用的媒體庫"
    : draft.libraryNames.length
      ? draft.libraryNames.map(esc).join("、")
      : draft.libraryIds.map((id) => `#${id}`).join("、");
  return [
    "<b>請確認建立邀請</b>",
    `伺服器：${esc(draft.serverName ?? "未指定")}（#${draft.serverId ?? "?"}）`,
    `邀請連結：${draft.expiresInDays == null ? "不過期" : `${draft.expiresInDays} 天`}`,
    `帳號期限：${esc(durationLabel(draft.duration ?? "unlimited", draft.unlimited === true))}`,
    `媒體庫：${libraries}`,
    ...permissionLines(draft),
  ].join("\n");
}

export function actionPrompt(action: UserAction): string {
  const verb: Record<UserAction, string> = {
    enable: "啟用",
    disable: "停用",
    extend: "延長到期",
    delete: "刪除",
    reset: "重設密碼",
  };
  return `選擇要${verb[action]}的使用者，或直接輸入 ID / 使用者名稱。`;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "待使用";
    case "used":
      return "已使用";
    case "expired":
      return "已過期";
    default:
      return status;
  }
}

export function filterLabel(filter: InviteFilter): string {
  switch (filter) {
    case "pending":
      return "待使用邀請";
    case "used":
      return "已使用邀請";
    case "expired":
      return "已過期邀請";
    default:
      return "全部邀請";
  }
}

export function durationLabel(duration: string, unlimited: boolean): string {
  if (unlimited || duration === "unlimited" || duration === "") return "無限制";
  return `${duration} 天`;
}

export function yn(value: boolean): string {
  return value ? "是" : "否";
}

export function absoluteUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const root = base.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${root}${suffix}`;
}
