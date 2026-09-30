import type { Catalog } from "./i18n/catalog.ts";
import type {
  InvitationInfo,
  InviteDraft,
  InviteFilter,
  LibraryInfo,
  PermissionFlags,
  QuickInviteSettings,
  ServerInfo,
  StatusInfo,
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

export function formatDate(cat: Catalog, value: string | null | undefined): string {
  if (!value) return cat.neverExpires;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return esc(value);
  return new Intl.DateTimeFormat(cat.dateLocale, {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatPaged<T>(
  cat: Catalog,
  view: PageView<T>,
  title: string,
  unit: string,
  empty: string,
  linesFor: (item: T) => string[],
): string {
  if (view.total === 0) return empty;
  const lines = [cat.pagedTitle(title, view.page, view.pages, view.total, unit), ""];
  for (const item of view.items) lines.push(...linesFor(item), "");
  return lines.join("\n").trimEnd();
}

export function formatStatus(cat: Catalog, status: StatusInfo): string {
  return cat.statusInfo(status);
}

export function formatUserList(cat: Catalog, view: PageView<UserInfo>): string {
  return formatPaged(cat, view, cat.usersTitle, cat.usersUnit, cat.usersEmpty, (user) => cat.userItem(user));
}

export function formatInviteList(cat: Catalog, view: PageView<InvitationInfo>, filter: InviteFilter): string {
  return formatPaged(cat, view, cat.inviteFilterTitle(filter), cat.invitesUnit, cat.invitesEmpty(filter), (invite) =>
    cat.inviteItem(invite),
  );
}

export function formatLibraries(cat: Catalog, view: PageView<LibraryInfo>): string {
  return formatPaged(cat, view, cat.librariesTitle, cat.librariesUnit, cat.librariesEmpty, (library) =>
    cat.libraryItem(library),
  );
}

export function formatServers(cat: Catalog, view: PageView<ServerInfo>): string {
  return formatPaged(cat, view, cat.serversTitle, cat.serversUnit, cat.serversEmpty, (server) => cat.serverItem(server));
}

export function formatServerChoices(cat: Catalog, servers: ServerInfo[]): string {
  return cat.serverChoices(servers);
}

export function formatLibraryChoices(cat: Catalog, view: PageView<LibraryInfo>, selected: number[]): string {
  const lines = [
    `<b>${cat.libraryChoicesTitle}</b>`,
    cat.libraryChoicesHint,
    selected.length ? cat.libraryChoicesSelected(selected) : cat.libraryChoicesNone,
    "",
  ];
  for (const library of view.items) {
    const mark = selected.includes(library.id) ? "✅" : "▫️";
    lines.push(`${mark} <b>#${library.id}</b> ${esc(library.name)}`);
  }
  return lines.join("\n");
}

export function formatPermissions(cat: Catalog, permissions: PermissionFlags, hint = cat.permissionsHintNext): string {
  return [`<b>${cat.permissionsTitle}</b>`, ...cat.permissionLines(permissions), "", hint].join("\n");
}

export function formatQuickSettings(cat: Catalog, settings: QuickInviteSettings): string {
  return [`<b>${cat.quickSettingsTitle}</b>`, ...cat.quickSettingsBody(settings)].join("\n");
}

export function formatInviteSummary(cat: Catalog, draft: InviteDraft): string {
  return [`<b>${cat.inviteSummaryTitle}</b>`, ...cat.inviteSummaryBody(draft)].join("\n");
}

export function absoluteUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const root = base.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${root}${suffix}`;
}
