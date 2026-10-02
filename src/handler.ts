import {
  esc,
  formatDate,
  formatInviteList,
  formatInviteSummary,
  formatLibraries,
  formatLibraryChoices,
  formatPermissions,
  formatQuickSettings,
  formatServerChoices,
  formatServerLines,
  formatServers,
  formatStatus,
  formatUserList,
  link,
  pageWindow,
} from "./format.ts";
import {
  catalogFor,
  DEFAULT_LANG,
  langFromButton,
  languageKeyboard,
  languagePrompt,
  loadLang,
  saveLang,
} from "./i18n.ts";
import type { Catalog, Lang } from "./i18n.ts";
import { qrPng } from "./qr.ts";
import {
  defaultQuickSettings,
  loadQuickSettings,
  parseQuickSettings,
  sameQuickSettings,
  saveQuickSettings,
} from "./settings.ts";
import {
  navRow,
  PAGE,
  confirmKeyboard,
  deleteInviteButton,
  inviteFilterOf,
  invitesKeyboard,
  libraryButton,
  mainKeyboard,
  markup,
  parseDeleteInviteButton,
  parseLibraryButton,
  parseServerButton,
  parseUserButton,
  permissionKeyboard,
  quickSettingsKeyboard,
  removeKeyboard,
  serverButton,
  settingsKeyboard,
  statusKeyboard,
  userActionOf,
  userButton,
  usersKeyboard,
  withNav,
} from "./keyboard.ts";
import { SCREEN_PARENT } from "./session.ts";
import type {
  AppContext,
  CreateInvitationInput,
  InvitationInfo,
  InviteDraft,
  InviteFilter,
  LibraryInfo,
  PendingAction,
  PermissionFlags,
  PickedServerLibraries,
  QuickInviteSettings,
  QuickLibraryMatcher,
  ReplyMarkup,
  Screen,
  ServerInfo,
  Update,
  UserAction,
  UserInfo,
} from "./types.ts";
import { WizarrError } from "./wizarr.ts";

const SESSION_TTL_SECONDS = 30 * 60;

/** 單次請求的上下文：加上該使用者的語言目錄。 */
type Req = AppContext & { cat: Catalog; lang: Lang };

export async function handleUpdate(update: Update, ctx: AppContext): Promise<void> {
  const message = update.message;
  if (!message?.from) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = (message.text ?? "").trim();
  const storedLang = await loadLang(ctx.sessions, userId);

  if (message.chat.type !== "private") {
    if (commandOf(text)) {
      await send(ctx, chatId, catalogFor(storedLang ?? DEFAULT_LANG).msg.privateOnly, removeKeyboard());
    }
    return;
  }

  if (!ctx.config.adminIds.has(userId)) {
    await send(ctx, chatId, catalogFor(storedLang ?? DEFAULT_LANG).unauthorized(userId), removeKeyboard());
    return;
  }

  if (storedLang === null) {
    try {
      const picked = langFromButton(text);
      if (!picked) {
        await send(ctx, chatId, languagePrompt(), languageKeyboard());
        return;
      }
      await saveLang(ctx.sessions, userId, picked);
      const cat = catalogFor(picked);
      await send(ctx, chatId, cat.welcome(), mainKeyboard(cat));
      await ctx.sessions.set(String(userId), { type: "main" }, SESSION_TTL_SECONDS);
    } catch (error) {
      console.error("[bot] 無法回覆", error instanceof Error ? error.message : error);
    }
    return;
  }

  const cat = catalogFor(storedLang);
  const req: Req = { ...ctx, cat, lang: storedLang };
  const screen = (await ctx.sessions.get(String(userId))) ?? { type: "main" as const };
  try {
    const next = await dispatch(screen, text, req, chatId, userId);
    await ctx.sessions.set(String(userId), next, SESSION_TTL_SECONDS);
  } catch (error) {
    if (!(error instanceof WizarrError)) {
      console.error("[bot]", error instanceof Error ? error.message : error);
    }
    const detail =
      error instanceof WizarrError
        ? error.connection
          ? cat.msg.wizarrUnreachable(esc(error.message))
          : cat.msg.wizarrError(esc(error.message))
        : cat.msg.genericError;
    // 出錯時回到上層畫面，讓 session 與送出錯誤訊息時顯示的鍵盤一致。
    const parent = parentOf(screen);
    try {
      await send(ctx, chatId, detail, keyboardFor(cat, parent));
      await ctx.sessions.set(String(userId), parent, SESSION_TTL_SECONDS);
    } catch (sendError) {
      console.error("[bot] 無法回覆", sendError instanceof Error ? sendError.message : sendError);
    }
  }
}

async function dispatch(
  screen: Screen,
  text: string,
  ctx: Req,
  chatId: number,
  userId: number,
): Promise<Screen> {
  const B = ctx.cat.buttons;
  if (!text) {
    await send(ctx, chatId, ctx.cat.msg.useKeyboard, keyboardFor(ctx.cat, screen));
    return screen;
  }

  const command = commandOf(text);
  if (command === "start" || command === "menu" || text === B.home) {
    await send(ctx, chatId, ctx.cat.welcome(), mainKeyboard(ctx.cat));
    return { type: "main" };
  }
  if (command === "id") {
    await send(ctx, chatId, ctx.cat.msg.yourId(userId), keyboardFor(ctx.cat, screen));
    return screen;
  }
  if (command === "help" || text === B.help) {
    await send(ctx, chatId, ctx.cat.help(), keyboardFor(ctx.cat, screen));
    return screen;
  }
  if (command === "cancel" || text === B.cancel) {
    const parent = parentOf(screen);
    await send(ctx, chatId, ctx.cat.msg.cancelled, keyboardFor(ctx.cat, parent));
    return parent;
  }
  if (text === B.status) {
    await send(ctx, chatId, ctx.cat.msg.statusMenu, statusKeyboard(ctx.cat));
    return { type: "status" };
  }
  if (text === B.userStatus) {
    await send(ctx, chatId, formatStatus(ctx.cat, await ctx.wizarr.getStatus()), keyboardFor(ctx.cat, screen));
    return screen;
  }
  if (text === B.users) {
    await send(ctx, chatId, ctx.cat.msg.usersMenu, usersKeyboard(ctx.cat));
    return { type: "users" };
  }
  if (text === B.invites) {
    await send(ctx, chatId, ctx.cat.msg.invitesMenu, invitesKeyboard(ctx.cat));
    return { type: "invites" };
  }
  if (text === B.libraryStatus) return showLibraries(ctx, chatId, 0);
  if (text === B.serverStatus) return showServers(ctx, chatId, 0);
  if (text === B.listUsers) return showUserList(ctx, chatId, 0);
  if (text === B.settings) return showSettings(ctx, chatId);

  const userAction = userActionOf(ctx.cat, text);
  if (userAction) return beginPickUser(ctx, chatId, userAction, 0);

  const inviteFilter = inviteFilterOf(ctx.cat, text);
  if (inviteFilter) return showInviteList(ctx, chatId, 0, inviteFilter);
  if (text === B.quickInvite) return beginQuickInvite(ctx, chatId);
  if (text === B.createInvite) return beginCreateInvite(ctx, chatId);
  if (text === B.deleteInvite) return beginDeleteInvite(ctx, chatId, 0);

  switch (screen.type) {
    case "user_list":
      if (text === B.prev || text === B.next) {
        return showUserList(ctx, chatId, shiftPage(B, screen.page, text));
      }
      break;
    case "invite_list":
      if (text === B.prev || text === B.next) {
        return showInviteList(ctx, chatId, shiftPage(B, screen.page, text), screen.filter);
      }
      break;
    case "library_list":
      if (text === B.prev || text === B.next) {
        return showLibraries(ctx, chatId, shiftPage(B, screen.page, text));
      }
      break;
    case "server_list":
      if (text === B.prev || text === B.next) {
        return showServers(ctx, chatId, shiftPage(B, screen.page, text));
      }
      break;
    case "pick_user":
      return handlePickUser(screen, text, ctx, chatId);
    case "extend_days":
      return handleExtendDays(screen, text, ctx, chatId);
    case "invite_server":
      return pickVerifiedServers(screen, text, ctx, chatId, (chosen) => beginInviteExpiry(ctx, chatId, chosen));
    case "invite_expiry":
      return handleInviteExpiry(screen.draft, text, ctx, chatId);
    case "invite_duration":
      return handleInviteDuration(screen.draft, text, ctx, chatId);
    case "invite_library_mode":
      return handleLibraryMode(screen.draft, text, ctx, chatId);
    case "invite_library_pick":
      return handleLibraryPick(screen, text, ctx, chatId);
    case "invite_permissions":
      return handlePermissions(screen.draft, text, ctx, chatId);
    case "delete_invite_pick":
      return handleDeleteInvitePick(screen.page, text, ctx, chatId);
    case "settings":
      return handleSettingsMenu(text, ctx, chatId);
    case "settings_quick":
      return handleQuickSettingsMenu(text, ctx, chatId);
    case "settings_expiry":
      return handleSettingsExpiry(text, ctx, chatId);
    case "settings_duration":
      return handleSettingsDuration(text, ctx, chatId);
    case "settings_permissions":
      return handleSettingsPermissions(screen, text, ctx, chatId);
    case "settings_library_server":
      return handleSettingsLibraryServer(screen, text, ctx, chatId);
    case "settings_library_pick":
      return handleSettingsLibraryPick(screen, text, ctx, chatId);
    case "settings_library_more":
      return handleSettingsLibraryMore(screen, text, ctx, chatId);
    case "settings_lang":
      return handleSettingsLang(text, ctx, chatId, userId);
    case "confirm":
      return handleConfirm(screen.pending, text, ctx, chatId);
    default:
      break;
  }

  await send(ctx, chatId, ctx.cat.msg.useKeyboardHelp, keyboardFor(ctx.cat, screen));
  return screen;
}

async function showUserList(ctx: Req, chatId: number, page: number): Promise<Screen> {
  const shown = await showList(
    ctx,
    chatId,
    await listUsersNamed(ctx),
    page,
    PAGE.users,
    (view) => formatUserList(ctx.cat, view),
    usersKeyboard(ctx.cat),
  );
  return { type: "user_list", page: shown };
}

async function beginPickUser(ctx: Req, chatId: number, action: UserAction, page: number): Promise<Screen> {
  const users = await listUsersNamed(ctx);
  if (!users.length) {
    await send(ctx, chatId, ctx.cat.msg.noUsers, usersKeyboard(ctx.cat));
    return { type: "users" };
  }
  return renderPickUser(ctx, chatId, action, users, page);
}

async function renderPickUser(
  ctx: Req,
  chatId: number,
  action: UserAction,
  users: UserInfo[],
  page: number,
): Promise<Screen> {
  const view = pageWindow(users, page, PAGE.users);
  await send(ctx, chatId, `${ctx.cat.actionPrompt(action)}\n\n${formatUserList(ctx.cat, view)}`, pickKeyboard(ctx.cat, view));
  return { type: "pick_user", action, page: view.page };
}

async function handlePickUser(
  screen: Extract<Screen, { type: "pick_user" }>,
  text: string,
  ctx: Req,
  chatId: number,
): Promise<Screen> {
  const B = ctx.cat.buttons;
  const users = await listUsersNamed(ctx);
  if (text === B.prev || text === B.next) {
    return renderPickUser(ctx, chatId, screen.action, users, shiftPage(B, screen.page, text));
  }
  const user = findUser(ctx.cat, users, text);
  if (!user) {
    const view = pageWindow(users, screen.page, PAGE.users);
    await send(ctx, chatId, ctx.cat.msg.userNotFound, pickKeyboard(ctx.cat, view));
    return screen;
  }

  if (screen.action === "enable") {
    await sendActionResult(ctx, chatId, await ctx.wizarr.enableUser(user.id), usersKeyboard(ctx.cat));
    return { type: "users" };
  }
  if (screen.action === "reset") {
    const reset = await ctx.wizarr.resetPassword(user.id);
    await send(
      ctx,
      chatId,
      [
        esc(reset.message ?? ctx.cat.msg.resetDone),
        ctx.cat.msg.userLine(user.username, user.id),
        ctx.cat.msg.linkLine(link(reset.url)),
        ctx.cat.msg.expiresLine(formatDate(ctx.cat, reset.expiresAt)),
        ctx.cat.msg.resetShareWarning,
      ].join("\n"),
      usersKeyboard(ctx.cat),
    );
    return { type: "users" };
  }
  if (screen.action === "extend") {
    await send(ctx, chatId, ctx.cat.msg.extendDaysPrompt(user.username, user.id), extendDaysKeyboard(ctx.cat));
    return { type: "extend_days", userId: user.id, username: user.username };
  }

  const pending: PendingAction =
    screen.action === "disable"
      ? { kind: "disable_user", userId: user.id, username: user.username }
      : { kind: "delete_user", userId: user.id, username: user.username };
  const warning =
    pending.kind === "disable_user"
      ? ctx.cat.msg.disableWarning(user.username, user.id)
      : ctx.cat.msg.deleteWarning(user.username, user.id);
  await send(ctx, chatId, warning, confirmKeyboard(ctx.cat));
  return { type: "confirm", pending };
}

async function handleExtendDays(
  screen: Extract<Screen, { type: "extend_days" }>,
  text: string,
  ctx: Req,
  chatId: number,
): Promise<Screen> {
  const B = ctx.cat.buttons;
  const days = text === B.days7 ? 7 : text === B.days30 ? 30 : text === B.days90 ? 90 : 0;
  if (!days) {
    await send(ctx, chatId, ctx.cat.msg.chooseDays, extendDaysKeyboard(ctx.cat));
    return screen;
  }
  const result = await ctx.wizarr.extendUser(screen.userId, days);
  await send(
    ctx,
    chatId,
    `${esc(result.message ?? ctx.cat.msg.extendDone)}\n${ctx.cat.msg.newExpiryLine(formatDate(ctx.cat, result.newExpiry))}`,
    usersKeyboard(ctx.cat),
  );
  return { type: "users" };
}

async function showInviteList(
  ctx: Req,
  chatId: number,
  page: number,
  filter: InviteFilter,
): Promise<Screen> {
  const invites = (await ctx.wizarr.listInvitations()).filter((invite) => filter === "all" || invite.status === filter);
  const shown = await showList(
    ctx,
    chatId,
    invites,
    page,
    PAGE.invites,
    (view) => formatInviteList(ctx.cat, view, filter),
    invitesKeyboard(ctx.cat),
  );
  for (const invite of pageWindow(invites, shown, PAGE.invites).items) {
    await sendInviteQr(ctx, chatId, invite);
  }
  return { type: "invite_list", page: shown, filter };
}

async function beginQuickInvite(ctx: Req, chatId: number): Promise<Screen> {
  const servers = await verifiedServers(ctx);
  if (!servers.length) {
    await send(ctx, chatId, ctx.cat.msg.noServersQuick, invitesKeyboard(ctx.cat));
    return { type: "invites" };
  }
  return createQuickInvite(ctx, chatId, servers);
}

async function createQuickInvite(ctx: Req, chatId: number, servers: ServerInfo[]): Promise<Screen> {
  const settings = await loadQuickSettings(ctx.sessions);
  // 跟隨設定裡勾選的伺服器（僅計算仍已驗證的）；從未設定時才用全部已驗證伺服器。
  const verifiedIds = new Set(servers.map((server) => server.id));
  const selectedIds = settings.serverIds?.filter((id) => verifiedIds.has(id)) ?? [];
  let serverIds = settings.serverIds?.length ? selectedIds : sortedServerIds(servers);
  if (!serverIds.length) {
    await send(ctx, chatId, ctx.cat.msg.noServersQuick, invitesKeyboard(ctx.cat));
    return { type: "invites" };
  }
  const enabled = await enabledLibraries(ctx, serverIds);
  // 預設媒體庫未設定（或為空）時，涵蓋這些伺服器的全部已啟用媒體庫。
  const preset = settings.libraries?.length ? settings.libraries : null;
  let libraryIds: number[] = [];
  let libraries = ctx.cat.librariesLine([ctx.cat.allEnabledLibraries]);
  if (preset) {
    const { selected, missing } = matchLibraries(enabled, preset);
    if (missing.length) {
      await send(
        ctx,
        chatId,
        ctx.cat.msg.quickMissingLibraries(missing, ctx.cat.buttons.settings),
        invitesKeyboard(ctx.cat),
      );
      return { type: "invites" };
    }
    libraryIds = selected.map((library) => library.id);
    libraries = ctx.cat.librariesLine(selected.map((library) => library.name));
    if (!settings.serverIds?.length) {
      // 舊版設定沒記錄勾選的伺服器：以比對到的媒體庫所屬伺服器為準；重新儲存設定後改用記錄值。
      serverIds = [...new Set(selected.map((library) => library.serverId).filter((id): id is number => id !== null))].sort(
        (a, b) => a - b,
      );
    }
  }
  // 關閉沿用時每次都新建，不查現有邀請；仍會記住新代碼，重新開啟沿用時可接著用。
  const existing = settings.reuseCode
    ? reusableQuickInvite(await ctx.wizarr.listInvitations(), libraryIds, settings, await savedQuickInvite(ctx, serverIds))
    : undefined;
  if (existing) {
    await sendCreatedInvitation(ctx, chatId, existing, libraries, ctx.cat.msg.quickReuseTitle);
    return { type: "invites" };
  }
  const invitation = await ctx.wizarr.createInvitation({
    serverIds,
    expiresInDays: settings.expiresInDays,
    duration: settings.duration,
    unlimited: settings.unlimited,
    libraryIds,
    allowDownloads: settings.allowDownloads,
    allowLiveTv: settings.allowLiveTv,
    allowMobileUploads: settings.allowMobileUploads,
  });
  try {
    await rememberQuickInvite(ctx, serverIds, invitation.code, settings, libraryIds);
  } catch (error) {
    console.error("[bot] 無法記住快速邀請", error instanceof Error ? error.message : error);
  }
  await sendCreatedInvitation(ctx, chatId, invitation, libraries);
  return { type: "invites" };
}

function reusableQuickInvite(
  invites: InvitationInfo[],
  libraryIds: number[],
  settings: QuickInviteSettings,
  saved: SavedQuickInvite | null,
  now = Date.now(),
): InvitationInfo | undefined {
  if (!saved || !sameQuickSettings(saved.settings, settings) || !sameIds(saved.libraryIds, libraryIds)) {
    return undefined;
  }
  return invites.find((invite) => invite.code === saved.code && inviteReusable(invite, now));
}

function inviteReusable(invite: InvitationInfo, now: number): boolean {
  if (invite.status !== "pending" && invite.status !== "used") return false;
  // 永不過期的邀請本來就有效，可以直接沿用。
  if (!invite.expires) return true;
  const time = Date.parse(invite.expires);
  return !Number.isNaN(time) && time > now;
}

/** 用名稱或 externalId 比對預設媒體庫；回傳比對到的媒體庫與找不到的名稱。 */
function matchLibraries(
  libraries: LibraryInfo[],
  matchers: QuickLibraryMatcher[],
): { selected: LibraryInfo[]; missing: string[] } {
  return matchByKey(
    libraries,
    matchers,
    (matcher) => matcher.name,
    (library, matcher) =>
      library.name === matcher.name || (matcher.externalId !== null && library.externalId === matcher.externalId),
  );
}

/** 依 keys 逐一比對 items；比對不到的收入 missing（用 label 取名），比對到的去重後依 id 排序。 */
function matchByKey<T extends { id: number }, K>(
  items: T[],
  keys: K[],
  label: (key: K) => string,
  matches: (item: T, key: K) => boolean,
): { selected: T[]; missing: string[] } {
  const selected = new Map<number, T>();
  const missing: string[] = [];
  for (const key of keys) {
    const found = items.filter((item) => matches(item, key));
    if (!found.length) missing.push(label(key));
    for (const item of found) selected.set(item.id, item);
  }
  return { selected: [...selected.values()].sort((a, b) => a.id - b.id), missing };
}

interface SavedQuickInvite {
  code: string;
  libraryIds: number[];
  settings: QuickInviteSettings;
}

async function savedQuickInvite(ctx: Req, serverIds: number[]): Promise<SavedQuickInvite | null> {
  const raw = await ctx.sessions.getText(quickInviteKey(serverIds));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const code = (parsed as { code?: unknown }).code;
    const libraryIds = (parsed as { libraryIds?: unknown }).libraryIds;
    const settings = parseQuickSettings((parsed as { settings?: unknown }).settings);
    if (typeof code !== "string" || !code || !Array.isArray(libraryIds) || !settings) return null;
    const ids = libraryIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0);
    if (ids.length !== libraryIds.length) return null;
    return { code, libraryIds: ids, settings };
  } catch {
    return null;
  }
}

async function rememberQuickInvite(
  ctx: Req,
  serverIds: number[],
  code: string,
  settings: QuickInviteSettings,
  libraryIds: number[],
): Promise<void> {
  if (!code) return;
  const saved: SavedQuickInvite = { code, libraryIds, settings };
  const ttl = ((settings.expiresInDays ?? 365) + 1) * 24 * 60 * 60;
  await ctx.sessions.setText(quickInviteKey(serverIds), JSON.stringify(saved), ttl);
}

/** 快速邀請代碼沿用的鍵：同一組伺服器（排序後）共用一組代碼。 */
function quickInviteKey(serverIds: number[]): string {
  return `quick-invite:${[...serverIds].sort((a, b) => a - b).join(",")}`;
}

function sameIds(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort((x, y) => x - y);
  const b = [...right].sort((x, y) => x - y);
  return a.every((id, index) => id === b[index]);
}

/** 多選切換：已選則移除、未選則加入，結果依 id 排序。 */
function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id].sort((a, b) => a - b);
}

/** 伺服器 id 列表（排序後），與快速邀請代碼的鍵使用相同順序。 */
function sortedServerIds(servers: ServerInfo[]): number[] {
  return servers.map((server) => server.id).sort((a, b) => a - b);
}

async function verifiedServers(ctx: Req): Promise<ServerInfo[]> {
  return (await listServersNamed(ctx)).filter((server) => server.verified);
}

/** 快速邀請設定的內容文字；有記錄勾選伺服器時才查名稱，查詢失敗只顯示 #id，不擋設定頁。 */
async function quickSettingsText(ctx: Req): Promise<string> {
  const settings = await loadQuickSettings(ctx.sessions);
  let servers: ServerInfo[] | null = null;
  if (settings.serverIds?.length) {
    try {
      servers = await listServersNamed(ctx);
    } catch (error) {
      console.error("[bot] 設定頁無法取得伺服器名稱", error instanceof Error ? error.message : error);
    }
  }
  return formatQuickSettings(ctx.cat, settings, servers);
}

async function showSettings(ctx: Req, chatId: number, notice?: string): Promise<Screen> {
  const body = await quickSettingsText(ctx);
  await send(ctx, chatId, notice ? `${notice}\n\n${body}` : body, settingsKeyboard(ctx.cat));
  return { type: "settings" };
}

/** 設定 → 快速邀請分類：同樣顯示目前設定內容，配子選單鍵盤。 */
async function showQuickSettings(ctx: Req, chatId: number, notice?: string): Promise<Screen> {
  const body = await quickSettingsText(ctx);
  await send(ctx, chatId, notice ? `${notice}\n\n${body}` : body, quickSettingsKeyboard(ctx.cat));
  return { type: "settings_quick" };
}

/** 讀出目前快速邀請設定、套用 patch 後存回。 */
async function updateQuickSettings(ctx: Req, patch: Partial<QuickInviteSettings>): Promise<void> {
  const settings = await loadQuickSettings(ctx.sessions);
  await saveQuickSettings(ctx.sessions, { ...settings, ...patch });
}

async function handleSettingsMenu(text: string, ctx: Req, chatId: number): Promise<Screen> {
  const B = ctx.cat.buttons;
  if (text === B.quickSettings) return showQuickSettings(ctx, chatId);
  if (text === B.setLanguage) {
    await send(ctx, chatId, ctx.cat.msg.chooseLanguage, languageKeyboard());
    return { type: "settings_lang" };
  }
  if (text === B.showQr) {
    const { showQr } = await loadQuickSettings(ctx.sessions);
    const next = !showQr;
    await updateQuickSettings(ctx, { showQr: next });
    return showSettings(ctx, chatId, ctx.cat.msg.qrSaved(next));
  }
  if (text === B.resetSettings) {
    await saveQuickSettings(ctx.sessions, defaultQuickSettings());
    return showSettings(ctx, chatId, ctx.cat.msg.settingsResetDone);
  }
  return showSettings(ctx, chatId, ctx.cat.msg.settingsChooseItem);
}

/** 設定 → 快速邀請分類的子選單：五個預設值項目與返回。 */
async function handleQuickSettingsMenu(text: string, ctx: Req, chatId: number): Promise<Screen> {
  const B = ctx.cat.buttons;
  if (text === B.setExpiry) {
    await send(ctx, chatId, ctx.cat.msg.settingsExpiryPrompt, expiryKeyboard(ctx.cat));
    return { type: "settings_expiry" };
  }
  if (text === B.setDuration) {
    await send(ctx, chatId, ctx.cat.msg.settingsDurationPrompt, durationKeyboard(ctx.cat));
    return { type: "settings_duration" };
  }
  if (text === B.setPermissions) {
    const settings = await loadQuickSettings(ctx.sessions);
    const permissions = permissionFlagsOf(settings);
    await send(
      ctx,
      chatId,
      formatPermissions(ctx.cat, permissions, ctx.cat.permissionsHintConfirm),
      permissionKeyboard(ctx.cat, permissions, B.confirm),
    );
    return { type: "settings_permissions", permissions };
  }
  if (text === B.setLibraries) return beginSettingsLibraries(ctx, chatId);
  if (text === B.reuseCode) {
    const { reuseCode } = await loadQuickSettings(ctx.sessions);
    const next = !reuseCode;
    await updateQuickSettings(ctx, { reuseCode: next });
    return showQuickSettings(ctx, chatId, ctx.cat.msg.reuseSaved(next));
  }
  if (text === B.backSettings) return showSettings(ctx, chatId);
  return showQuickSettings(ctx, chatId, ctx.cat.msg.settingsChooseItem);
}

async function handleSettingsLang(text: string, ctx: Req, chatId: number, userId: number): Promise<Screen> {
  const picked = langFromButton(text);
  if (!picked) {
    await send(ctx, chatId, languagePrompt(), languageKeyboard());
    return { type: "settings_lang" };
  }
  await saveLang(ctx.sessions, userId, picked);
  const cat = catalogFor(picked);
  return showSettings({ ...ctx, cat, lang: picked }, chatId, cat.msg.languageSaved);
}

async function handleSettingsExpiry(text: string, ctx: Req, chatId: number): Promise<Screen> {
  const expires = expiryChoice(ctx.cat, text);
  if (expires === undefined) {
    await send(ctx, chatId, ctx.cat.msg.chooseExpiry, expiryKeyboard(ctx.cat));
    return { type: "settings_expiry" };
  }
  await updateQuickSettings(ctx, { expiresInDays: expires });
  return showQuickSettings(ctx, chatId, ctx.cat.msg.expirySaved);
}

async function handleSettingsDuration(text: string, ctx: Req, chatId: number): Promise<Screen> {
  const choice = durationChoice(ctx.cat, text);
  if (!choice) {
    await send(ctx, chatId, ctx.cat.msg.chooseDuration, durationKeyboard(ctx.cat));
    return { type: "settings_duration" };
  }
  await updateQuickSettings(ctx, { duration: choice.duration, unlimited: choice.unlimited });
  return showQuickSettings(ctx, chatId, ctx.cat.msg.durationSaved);
}

async function handleSettingsPermissions(
  screen: Extract<Screen, { type: "settings_permissions" }>,
  text: string,
  ctx: Req,
  chatId: number,
): Promise<Screen> {
  const B = ctx.cat.buttons;
  const toggled = togglePermission(ctx.cat, screen.permissions, text);
  if (toggled) {
    await send(
      ctx,
      chatId,
      formatPermissions(ctx.cat, toggled, ctx.cat.permissionsHintConfirm),
      permissionKeyboard(ctx.cat, toggled, B.confirm),
    );
    return { type: "settings_permissions", permissions: toggled };
  }
  if (text === B.confirm) {
    await updateQuickSettings(ctx, permissionFlagsOf(screen.permissions));
    return showQuickSettings(ctx, chatId, ctx.cat.msg.permissionsSaved);
  }
  await send(ctx, chatId, ctx.cat.msg.permissionsToggleOrConfirm, permissionKeyboard(ctx.cat, screen.permissions, B.confirm));
  return screen;
}

/** 預設媒體庫流程：逐台進行——先選一台伺服器、挑它的媒體庫，再決定要不要加入其他伺服器。 */
async function beginSettingsLibraries(ctx: Req, chatId: number): Promise<Screen> {
  const servers = await verifiedServers(ctx);
  if (!servers.length) {
    await send(ctx, chatId, ctx.cat.msg.noServersLibrarySettings, quickSettingsKeyboard(ctx.cat));
    return { type: "settings_quick" };
  }
  if (servers.length === 1) return pickSettingsLibrary(ctx, chatId, servers[0], []);
  return renderSettingsServerPick(ctx, chatId, []);
}

/** 單選伺服器畫面：列出尚未設定的伺服器，點一台就進入它的媒體庫挑選。 */
async function renderSettingsServerPick(
  ctx: Req,
  chatId: number,
  picked: PickedServerLibraries[],
  notice?: string,
): Promise<Screen> {
  const servers = await verifiedServers(ctx);
  const remaining = servers.filter((server) => !picked.some((item) => item.serverId === server.id));
  const base = `${ctx.cat.msg.chooseLibraryServersSettings}\n\n${formatServerLines(ctx.cat, remaining)}`;
  const rows = remaining.map((server) => [serverButton(ctx.cat, server.id)]);
  // 「使用全部媒體庫」是整體預設，與逐台挑選互斥，只在還沒挑過任何伺服器時提供。
  if (!picked.length) rows.push([ctx.cat.buttons.allLibraries]);
  await send(ctx, chatId, notice ? `${notice}\n\n${base}` : base, markup(withCancel(ctx.cat, ...rows), ctx.cat.ph.chooseServer));
  return { type: "settings_library_server", picked };
}

async function handleSettingsLibraryServer(
  screen: Extract<Screen, { type: "settings_library_server" }>,
  text: string,
  ctx: Req,
  chatId: number,
): Promise<Screen> {
  if (text === ctx.cat.buttons.allLibraries && !screen.picked.length) {
    await updateQuickSettings(ctx, { libraries: null, serverIds: null });
    return showQuickSettings(ctx, chatId, ctx.cat.msg.allLibrariesSaved);
  }
  const servers = await verifiedServers(ctx);
  const remaining = servers.filter((server) => !screen.picked.some((item) => item.serverId === server.id));
  const serverId = parseServerButton(ctx.cat, text);
  const server = serverId == null ? undefined : remaining.find((item) => item.id === serverId);
  if (!server) return renderSettingsServerPick(ctx, chatId, screen.picked, ctx.cat.msg.pickVerified);
  return pickSettingsLibrary(ctx, chatId, server, screen.picked);
}

/** 進入單台伺服器的媒體庫挑選；該台沒有已啟用媒體庫時退回伺服器選擇。 */
async function pickSettingsLibrary(
  ctx: Req,
  chatId: number,
  server: ServerInfo,
  picked: PickedServerLibraries[],
): Promise<Screen> {
  const enabled = await enabledLibraries(ctx, [server.id]);
  if (!enabled.length) {
    return renderSettingsServerPick(ctx, chatId, picked, ctx.cat.msg.noLibrariesOnServerSettings(server.name));
  }
  return renderSettingsLibraryPick(ctx, chatId, server.id, server.name, picked, [], 0, enabled);
}

async function renderSettingsLibraryPick(
  ctx: Req,
  chatId: number,
  serverId: number,
  serverName: string,
  picked: PickedServerLibraries[],
  selectedIds: number[],
  page: number,
  libraries: LibraryInfo[],
  notice?: string,
): Promise<Screen> {
  // 標頭明示目前挑的是哪一台伺服器的媒體庫。
  const header = ctx.cat.serversLine([serverName]);
  const shown = await sendLibraryPick(
    ctx,
    chatId,
    libraries,
    selectedIds,
    page,
    ctx.cat.ph.choosePresetLibrary,
    notice,
    header,
    picked.length === 0,
  );
  return { type: "settings_library_pick", serverId, serverName, selectedIds, page: shown, picked };
}

async function handleSettingsLibraryPick(
  screen: Extract<Screen, { type: "settings_library_pick" }>,
  text: string,
  ctx: Req,
  chatId: number,
): Promise<Screen> {
  const B = ctx.cat.buttons;
  const { serverId, serverName, selectedIds, picked } = screen;
  const enabled = await enabledLibraries(ctx, [serverId]);
  const rerender = (notice?: string) =>
    renderSettingsLibraryPick(ctx, chatId, serverId, serverName, picked, selectedIds, screen.page, enabled, notice);
  if (text === B.prev || text === B.next) {
    return renderSettingsLibraryPick(ctx, chatId, serverId, serverName, picked, selectedIds, shiftPage(B, screen.page, text), enabled);
  }
  if (text === B.allLibraries && !picked.length) {
    await updateQuickSettings(ctx, { libraries: null, serverIds: null });
    return showQuickSettings(ctx, chatId, ctx.cat.msg.allLibrariesSaved);
  }
  if (text === B.librariesDone) {
    if (!selectedIds.length) return rerender(ctx.cat.msg.pickOneLibrary);
    const libraries: QuickLibraryMatcher[] = selectedIds.map((id) => {
      const library = enabled.find((item) => item.id === id);
      return { name: library?.name ?? ctx.cat.msg.libraryFallbackName(id), externalId: library?.externalId ?? null };
    });
    const next = [...picked, { serverId, serverName, libraries }];
    const remaining = (await verifiedServers(ctx)).filter((server) => !next.some((item) => item.serverId === server.id));
    // 已沒有其他伺服器可加，直接儲存。
    if (!remaining.length) return finishSettingsLibraries(ctx, chatId, next);
    return renderSettingsLibraryMore(ctx, chatId, next);
  }
  const libraryId = parseLibraryButton(ctx.cat, text);
  const library = libraryId == null ? undefined : enabled.find((item) => item.id === libraryId);
  if (!library) return rerender(ctx.cat.msg.pickOneLibrary);
  return renderSettingsLibraryPick(ctx, chatId, serverId, serverName, picked, toggleId(selectedIds, library.id), screen.page, enabled);
}

/** 選完一台後的摘要畫面：列出累計選擇，問要不要再加一台。 */
async function renderSettingsLibraryMore(
  ctx: Req,
  chatId: number,
  picked: PickedServerLibraries[],
): Promise<Screen> {
  const rows = withCancel(ctx.cat, [ctx.cat.buttons.moreServers], [ctx.cat.buttons.picksDone]);
  await send(ctx, chatId, ctx.cat.pickedLibrariesText(picked), markup(rows, ctx.cat.ph.choosePresetLibrary));
  return { type: "settings_library_more", picked };
}

async function handleSettingsLibraryMore(
  screen: Extract<Screen, { type: "settings_library_more" }>,
  text: string,
  ctx: Req,
  chatId: number,
): Promise<Screen> {
  const B = ctx.cat.buttons;
  if (text === B.picksDone) return finishSettingsLibraries(ctx, chatId, screen.picked);
  if (text === B.moreServers) {
    const remaining = (await verifiedServers(ctx)).filter((server) => !screen.picked.some((item) => item.serverId === server.id));
    if (!remaining.length) return finishSettingsLibraries(ctx, chatId, screen.picked);
    return renderSettingsServerPick(ctx, chatId, screen.picked);
  }
  return renderSettingsLibraryMore(ctx, chatId, screen.picked);
}

/** 把逐台累計的選擇存成預設媒體庫設定。 */
async function finishSettingsLibraries(ctx: Req, chatId: number, picked: PickedServerLibraries[]): Promise<Screen> {
  const serverIds = picked.map((item) => item.serverId).sort((a, b) => a - b);
  const libraries = picked.flatMap((item) => item.libraries);
  await updateQuickSettings(ctx, { serverIds, libraries });
  return showQuickSettings(ctx, chatId, ctx.cat.msg.librariesSaved);
}

async function beginCreateInvite(ctx: Req, chatId: number): Promise<Screen> {
  return chooseServers(ctx, chatId, "invite_server", await verifiedServers(ctx), {
    empty: { message: ctx.cat.msg.noServers, keyboard: invitesKeyboard(ctx.cat), screen: { type: "invites" } },
    single: (servers) => beginInviteExpiry(ctx, chatId, servers),
  });
}

async function beginInviteExpiry(ctx: Req, chatId: number, servers: ServerInfo[]): Promise<Screen> {
  const ordered = [...servers].sort((a, b) => a.id - b.id);
  const draft = emptyDraft();
  draft.serverIds = ordered.map((server) => server.id);
  draft.serverNames = ordered.map((server) => server.name);
  await send(ctx, chatId, ctx.cat.msg.inviteServerExpiryPrompt(draft.serverNames), expiryKeyboard(ctx.cat));
  return { type: "invite_expiry", draft };
}

async function handleInviteExpiry(draft: InviteDraft, text: string, ctx: Req, chatId: number): Promise<Screen> {
  const expires = expiryChoice(ctx.cat, text);
  if (expires === undefined) {
    await send(ctx, chatId, ctx.cat.msg.chooseExpiry, expiryKeyboard(ctx.cat));
    return { type: "invite_expiry", draft };
  }
  const next = { ...draft, expiresInDays: expires };
  await send(ctx, chatId, ctx.cat.msg.inviteDurationPrompt, durationKeyboard(ctx.cat));
  return { type: "invite_duration", draft: next };
}

async function handleInviteDuration(draft: InviteDraft, text: string, ctx: Req, chatId: number): Promise<Screen> {
  const choice = durationChoice(ctx.cat, text);
  if (!choice) {
    await send(ctx, chatId, ctx.cat.msg.chooseDuration, durationKeyboard(ctx.cat));
    return { type: "invite_duration", draft };
  }
  const next = { ...draft, duration: choice.duration, unlimited: choice.unlimited };
  await send(ctx, chatId, ctx.cat.msg.libraryModePrompt, libraryModeKeyboard(ctx.cat));
  return { type: "invite_library_mode", draft: next };
}

async function handleLibraryMode(draft: InviteDraft, text: string, ctx: Req, chatId: number): Promise<Screen> {
  const B = ctx.cat.buttons;
  if (text === B.allLibraries) return showPermissions(ctx, chatId, allLibraries(draft));
  if (text === B.pickLibraries) {
    const libraries = await enabledLibraries(ctx, draft.serverIds);
    if (!libraries.length) {
      const next = allLibraries(draft);
      await send(
        ctx,
        chatId,
        `${ctx.cat.msg.noLibrariesFallback}\n\n${formatPermissions(ctx.cat, next)}`,
        permissionKeyboard(ctx.cat, next),
      );
      return { type: "invite_permissions", draft: next };
    }
    return renderLibraryPick(ctx, chatId, { ...draft, useAllLibraries: false }, 0, libraries);
  }
  await send(ctx, chatId, ctx.cat.msg.chooseLibraryMode, libraryModeKeyboard(ctx.cat));
  return { type: "invite_library_mode", draft };
}

async function handleLibraryPick(
  screen: Extract<Screen, { type: "invite_library_pick" }>,
  text: string,
  ctx: Req,
  chatId: number,
): Promise<Screen> {
  const B = ctx.cat.buttons;
  const libraries = await enabledLibraries(ctx, screen.draft.serverIds);
  if (text === B.prev || text === B.next) {
    return renderLibraryPick(ctx, chatId, screen.draft, shiftPage(B, screen.page, text), libraries);
  }
  if (text === B.allLibraries) {
    return showPermissions(ctx, chatId, allLibraries(screen.draft));
  }
  if (text === B.librariesDone) {
    if (!screen.draft.libraryIds.length) {
      return renderLibraryPick(ctx, chatId, screen.draft, screen.page, libraries, ctx.cat.msg.pickOneLibrary);
    }
    return showPermissions(ctx, chatId, { ...screen.draft, useAllLibraries: false });
  }

  const libraryId = parseLibraryButton(ctx.cat, text);
  const library = libraryId == null ? undefined : libraries.find((item) => item.id === libraryId);
  if (!library) {
    return renderLibraryPick(ctx, chatId, screen.draft, screen.page, libraries, ctx.cat.msg.pickOneLibrary);
  }

  const selected = new Map(screen.draft.libraryIds.map((id, index) => [id, screen.draft.libraryNames[index] ?? library.name]));
  if (selected.has(library.id)) selected.delete(library.id);
  else selected.set(library.id, library.name);
  const libraryIds = [...selected.keys()].sort((a, b) => a - b);
  const next = {
    ...screen.draft,
    useAllLibraries: false,
    libraryIds,
    libraryNames: libraryIds.map((id) => selected.get(id) ?? ""),
  };
  return renderLibraryPick(ctx, chatId, next, screen.page, libraries);
}

async function renderLibraryPick(
  ctx: Req,
  chatId: number,
  draft: InviteDraft,
  page: number,
  libraries: LibraryInfo[],
  notice?: string,
): Promise<Screen> {
  const shown = await sendLibraryPick(ctx, chatId, libraries, draft.libraryIds, page, ctx.cat.ph.chooseLibrary, notice);
  return { type: "invite_library_pick", draft, page: shown };
}

/** 兩種媒體庫選擇畫面共用的渲染：分頁 + 內文 + 鍵盤，回傳實際頁碼。showAll 控制是否提供「使用全部媒體庫」。 */
async function sendLibraryPick(
  ctx: Req,
  chatId: number,
  libraries: LibraryInfo[],
  selectedIds: number[],
  page: number,
  placeholder: string,
  notice?: string,
  header?: string,
  showAll = true,
): Promise<number> {
  const view = pageWindow(libraries, page, PAGE.libraries);
  await send(
    ctx,
    chatId,
    libraryPickText(ctx.cat, view, selectedIds, notice, header),
    libraryPickMarkup(ctx.cat, view, selectedIds, placeholder, showAll),
  );
  return view.page;
}

/** 兩種媒體庫選擇畫面共用的內文（含固定標頭與提示前綴）。 */
function libraryPickText(
  cat: Catalog,
  view: ReturnType<typeof pageWindow<LibraryInfo>>,
  selectedIds: number[],
  notice?: string,
  header?: string,
): string {
  const body = formatLibraryChoices(cat, view, selectedIds);
  return [header, notice, body].filter((part) => part).join("\n\n");
}

/** 兩種媒體庫選擇畫面共用的鍵盤：媒體庫按鈕 + 選好了/全部 + 取消/回首頁。 */
function libraryPickMarkup(
  cat: Catalog,
  view: { page: number; pages: number; items: LibraryInfo[] },
  selectedIds: number[],
  placeholder: string,
  showAll: boolean,
): ReplyMarkup {
  const B = cat.buttons;
  const rows = choiceRows(
    cat,
    view.items.map((library) => libraryButton(cat, library.id, selectedIds.includes(library.id))),
    view,
    [showAll ? [B.librariesDone, B.allLibraries] : [B.librariesDone]],
  );
  return markup(rows, placeholder);
}

async function handlePermissions(draft: InviteDraft, text: string, ctx: Req, chatId: number): Promise<Screen> {
  const B = ctx.cat.buttons;
  const toggled = togglePermission(ctx.cat, draft, text);
  if (toggled) return showPermissions(ctx, chatId, { ...draft, ...toggled });
  if (text === B.nextStep) return askCreateConfirm(ctx, chatId, draft);
  await send(ctx, chatId, ctx.cat.msg.permissionsToggleOrNext, permissionKeyboard(ctx.cat, draft));
  return { type: "invite_permissions", draft };
}

function togglePermission(cat: Catalog, flags: PermissionFlags, text: string): PermissionFlags | null {
  const B = cat.buttons;
  if (text === B.toggleDownloads) return { ...flags, allowDownloads: !flags.allowDownloads };
  if (text === B.toggleLive) return { ...flags, allowLiveTv: !flags.allowLiveTv };
  if (text === B.toggleUploads) return { ...flags, allowMobileUploads: !flags.allowMobileUploads };
  return null;
}

function permissionFlagsOf(flags: PermissionFlags): PermissionFlags {
  return {
    allowDownloads: flags.allowDownloads,
    allowLiveTv: flags.allowLiveTv,
    allowMobileUploads: flags.allowMobileUploads,
  };
}

async function showPermissions(ctx: Req, chatId: number, draft: InviteDraft): Promise<Screen> {
  await send(ctx, chatId, formatPermissions(ctx.cat, draft), permissionKeyboard(ctx.cat, draft));
  return { type: "invite_permissions", draft };
}

async function askCreateConfirm(ctx: Req, chatId: number, draft: InviteDraft): Promise<Screen> {
  const input = toInvitationInput(draft);
  if (!input) {
    await send(ctx, chatId, ctx.cat.msg.draftIncomplete, invitesKeyboard(ctx.cat));
    return { type: "invites" };
  }
  await send(ctx, chatId, formatInviteSummary(ctx.cat, draft), confirmKeyboard(ctx.cat));
  return { type: "confirm", pending: { kind: "create_invite", input } };
}

async function beginDeleteInvite(ctx: Req, chatId: number, page: number): Promise<Screen> {
  const invites = (await ctx.wizarr.listInvitations()).filter(
    (invite) => invite.status === "pending" || invite.status === "expired",
  );
  if (!invites.length) {
    await send(ctx, chatId, ctx.cat.msg.noDeletableInvites, invitesKeyboard(ctx.cat));
    return { type: "invites" };
  }
  const view = pageWindow(invites, page, PAGE.invites);
  const rows = choiceRows(
    ctx.cat,
    view.items.map((invite) => deleteInviteButton(ctx.cat, invite.id)),
    view,
  );
  await send(
    ctx,
    chatId,
    `${ctx.cat.msg.chooseInviteToDelete}\n\n${formatInviteList(ctx.cat, view, "all")}`,
    markup(rows, ctx.cat.ph.chooseInvite),
  );
  return { type: "delete_invite_pick", page: view.page };
}

async function handleDeleteInvitePick(page: number, text: string, ctx: Req, chatId: number): Promise<Screen> {
  const B = ctx.cat.buttons;
  if (text === B.prev || text === B.next) return beginDeleteInvite(ctx, chatId, shiftPage(B, page, text));
  const invitationId = parseDeleteInviteButton(ctx.cat, text);
  const invites = await ctx.wizarr.listInvitations();
  const invite = invitationId == null ? undefined : invites.find((item) => item.id === invitationId);
  if (!invite) {
    await send(ctx, chatId, ctx.cat.msg.inviteNotFound);
    return beginDeleteInvite(ctx, chatId, page);
  }
  await send(ctx, chatId, ctx.cat.msg.deleteInviteWarning(invite.code, invite.id), confirmKeyboard(ctx.cat));
  return { type: "confirm", pending: { kind: "delete_invite", invitationId: invite.id, code: invite.code } };
}

async function handleConfirm(pending: PendingAction, text: string, ctx: Req, chatId: number): Promise<Screen> {
  if (text !== ctx.cat.buttons.confirm) {
    await send(ctx, chatId, ctx.cat.msg.confirmOrCancel, confirmKeyboard(ctx.cat));
    return { type: "confirm", pending };
  }

  if (pending.kind === "disable_user" || pending.kind === "delete_user") {
    const message =
      pending.kind === "disable_user"
        ? await ctx.wizarr.disableUser(pending.userId)
        : await ctx.wizarr.deleteUser(pending.userId);
    await sendActionResult(ctx, chatId, message, usersKeyboard(ctx.cat));
    return { type: "users" };
  }
  if (pending.kind === "delete_invite") {
    await sendActionResult(ctx, chatId, await ctx.wizarr.deleteInvitation(pending.invitationId), invitesKeyboard(ctx.cat));
    return { type: "invites" };
  }

  const invitation = await ctx.wizarr.createInvitation(pending.input);
  await sendCreatedInvitation(ctx, chatId, invitation);
  return { type: "invites" };
}

async function sendCreatedInvitation(
  ctx: Req,
  chatId: number,
  invitation: { code: string; url: string },
  detail?: string,
  title = ctx.cat.msg.inviteCreatedTitle,
): Promise<void> {
  const lines = [title, inviteCaption(ctx.cat, invitation)];
  if (detail) lines.push(detail);
  await send(ctx, chatId, lines.join("\n"), invitesKeyboard(ctx.cat));
  await sendInviteQr(ctx, chatId, invitation);
}

async function sendInviteQr(
  ctx: Req,
  chatId: number,
  invitation: { code: string; url: string },
): Promise<void> {
  if (!(await loadQuickSettings(ctx.sessions)).showQr) return;
  if (!/^https?:\/\//i.test(invitation.url)) return;
  try {
    await ctx.telegram.sendPhoto(chatId, await qrPng(invitation.url), inviteCaption(ctx.cat, invitation));
  } catch (error) {
    // QR code 是附加資訊，發送失敗不影響主流程（邀請文字已另外送出）。
    console.error("[bot] 無法送出邀請 QR code", error instanceof Error ? error.message : error);
  }
}

function inviteCaption(cat: Catalog, invitation: { code: string; url: string }): string {
  return cat.msg.inviteCaption(invitation.code, invitation.url);
}

async function showLibraries(ctx: Req, chatId: number, page: number): Promise<Screen> {
  const shown = await showList(
    ctx,
    chatId,
    await listLibrariesNamed(ctx),
    page,
    PAGE.libraries,
    (view) => formatLibraries(ctx.cat, view),
    markup([[ctx.cat.buttons.home]], ctx.cat.ph.libraries),
  );
  return { type: "library_list", page: shown };
}

async function showServers(ctx: Req, chatId: number, page: number): Promise<Screen> {
  const shown = await showList(
    ctx,
    chatId,
    await listServersNamed(ctx),
    page,
    PAGE.servers,
    (view) => formatServers(ctx.cat, view),
    markup([[ctx.cat.buttons.home]], ctx.cat.ph.servers),
  );
  return { type: "server_list", page: shown };
}

async function showList<T>(
  ctx: Req,
  chatId: number,
  items: T[],
  page: number,
  size: number,
  format: (view: ReturnType<typeof pageWindow<T>>) => string,
  keyboard: ReplyMarkup,
): Promise<number> {
  const view = pageWindow(items, page, size);
  await send(ctx, chatId, format(view), withNav(ctx.cat, keyboard, view.page, view.pages));
  return view.page;
}

async function enabledLibraries(ctx: Req, serverIds: number[]): Promise<LibraryInfo[]> {
  const libraries = await listLibrariesNamed(ctx);
  return libraries.filter((library) => library.enabled && library.serverId != null && serverIds.includes(library.serverId));
}

/** 以下三個 helper：API 缺欄位時名稱會是空字串，這裡補上使用者語言的顯示名。 */
async function listUsersNamed(ctx: Req): Promise<UserInfo[]> {
  const users = await ctx.wizarr.listUsers();
  return users.map((user) => ({
    ...user,
    username: user.username || ctx.cat.msg.userFallbackName(user.id),
    server: user.server || ctx.cat.msg.unknownServer,
  }));
}

async function listServersNamed(ctx: Req): Promise<ServerInfo[]> {
  const servers = await ctx.wizarr.listServers();
  return servers.map((server) => ({ ...server, name: server.name || ctx.cat.msg.serverFallbackName(server.id) }));
}

async function listLibrariesNamed(ctx: Req): Promise<LibraryInfo[]> {
  const libraries = await ctx.wizarr.listLibraries();
  return libraries.map((library) => ({
    ...library,
    name: library.name || ctx.cat.msg.libraryFallbackName(library.id),
    serverName: library.serverName || ctx.cat.msg.unknownServer,
  }));
}

function findUser(cat: Catalog, users: UserInfo[], text: string): UserInfo | undefined {
  const buttonId = parseUserButton(cat, text);
  if (buttonId != null) return users.find((user) => user.id === buttonId);
  if (/^\d+$/.test(text)) return users.find((user) => user.id === Number(text));
  const lowered = text.toLowerCase();
  return users.find((user) => user.username.toLowerCase() === lowered);
}

function toInvitationInput(draft: InviteDraft): CreateInvitationInput | null {
  if (!draft.serverIds.length || draft.expiresInDays === undefined || !draft.duration || draft.unlimited === undefined) {
    return null;
  }
  return {
    serverIds: draft.serverIds,
    expiresInDays: draft.expiresInDays,
    duration: draft.duration,
    unlimited: draft.unlimited,
    libraryIds: draft.useAllLibraries ? [] : draft.libraryIds,
    allowDownloads: draft.allowDownloads,
    allowLiveTv: draft.allowLiveTv,
    allowMobileUploads: draft.allowMobileUploads,
  };
}

/** 多選伺服器畫面的 screen 型別名稱（逐步建立邀請用；預設媒體庫流程是逐台單選，走自己的路）。 */
type ServerPickScreen = "invite_server";

/** 多選伺服器流程的入口：0 台顯示空狀態、1 台直接進入 single、多台進入多選畫面。 */
async function chooseServers(
  ctx: Req,
  chatId: number,
  type: ServerPickScreen,
  servers: ServerInfo[],
  options: {
    empty: { message: string; keyboard: ReplyMarkup; screen: Screen };
    single: (servers: ServerInfo[]) => Promise<Screen>;
  },
): Promise<Screen> {
  if (!servers.length) {
    await send(ctx, chatId, options.empty.message, options.empty.keyboard);
    return options.empty.screen;
  }
  if (servers.length === 1) return options.single(servers);
  return renderServerPick(ctx, chatId, type, servers, []);
}

/** 多選伺服器的訊息 + 鍵盤（✅ 切換、選好了送出）。 */
async function renderServerPick(
  ctx: Req,
  chatId: number,
  type: ServerPickScreen,
  servers: ServerInfo[],
  selectedIds: number[],
  notice?: string,
): Promise<Screen> {
  const base = formatServerChoices(ctx.cat, servers);
  await send(
    ctx,
    chatId,
    notice ? `${notice}\n\n${base}` : base,
    serverMultiKeyboard(ctx.cat, servers, selectedIds),
  );
  return { type, selectedIds };
}

function serverMultiKeyboard(cat: Catalog, servers: ServerInfo[], selectedIds: number[]): ReplyMarkup {
  return markup(
    choiceRows(
      cat,
      servers.map((server) => serverButton(cat, server.id, selectedIds.includes(server.id))),
      undefined,
      [[cat.buttons.serversDone]],
    ),
    cat.ph.chooseServer,
  );
}

/** 三個多選伺服器畫面共用的入口：重新讀取已驗證伺服器後交給 handleServerPick。 */
async function pickVerifiedServers(
  screen: { type: ServerPickScreen; selectedIds: number[] },
  text: string,
  ctx: Req,
  chatId: number,
  done: (chosen: ServerInfo[]) => Promise<Screen>,
): Promise<Screen> {
  const servers = await verifiedServers(ctx);
  return handleServerPick(screen, text, ctx, chatId, servers, ctx.cat.msg.pickVerified, done);
}

/** 各流程共用的多選伺服器處理：切換勾選，按「選好了」交給 done 繼續。 */
async function handleServerPick(
  screen: { type: ServerPickScreen; selectedIds: number[] },
  text: string,
  ctx: Req,
  chatId: number,
  servers: ServerInfo[],
  miss: string,
  done: (chosen: ServerInfo[]) => Promise<Screen>,
): Promise<Screen> {
  if (text === ctx.cat.buttons.serversDone) {
    const chosen = servers.filter((server) => screen.selectedIds.includes(server.id));
    if (!chosen.length) {
      return renderServerPick(ctx, chatId, screen.type, servers, screen.selectedIds, ctx.cat.msg.pickOneServer);
    }
    return done(chosen);
  }
  const serverId = parseServerButton(ctx.cat, text);
  const server = serverId == null ? undefined : servers.find((item) => item.id === serverId);
  if (!server) {
    return renderServerPick(ctx, chatId, screen.type, servers, screen.selectedIds, miss);
  }
  return renderServerPick(ctx, chatId, screen.type, servers, toggleId(screen.selectedIds, server.id));
}

function extendDaysKeyboard(cat: Catalog): ReplyMarkup {
  const B = cat.buttons;
  return markup(withCancel(cat, [B.days7, B.days30, B.days90]), cat.ph.chooseDays);
}

function allLibraries(draft: InviteDraft): InviteDraft {
  return { ...draft, useAllLibraries: true, libraryIds: [], libraryNames: [] };
}

function withCancel(cat: Catalog, ...rows: string[][]): string[][] {
  return [...rows, [cat.buttons.cancel, cat.buttons.home]];
}

function choiceRows(cat: Catalog, labels: string[], view?: { page: number; pages: number }, beforeCancel: string[][] = []): string[][] {
  const rows = labels.map((text) => [text]);
  if (view) appendNav(cat, rows, view.page, view.pages);
  return withCancel(cat, ...rows, ...beforeCancel);
}

function emptyDraft(): InviteDraft {
  return {
    serverIds: [],
    serverNames: [],
    libraryIds: [],
    libraryNames: [],
    allowDownloads: false,
    allowLiveTv: false,
    allowMobileUploads: false,
  };
}

function expiryChoice(cat: Catalog, text: string): 1 | 7 | 30 | null | undefined {
  const B = cat.buttons;
  if (text === B.expiry1) return 1;
  if (text === B.expiry7) return 7;
  if (text === B.expiry30) return 30;
  if (text === B.expiryNever) return null;
  return undefined;
}

function durationChoice(cat: Catalog, text: string): { duration: string; unlimited: boolean } | null {
  const B = cat.buttons;
  if (text === B.dur7) return { duration: "7", unlimited: false };
  if (text === B.dur30) return { duration: "30", unlimited: false };
  if (text === B.dur90) return { duration: "90", unlimited: false };
  if (text === B.durUnlimited) return { duration: "unlimited", unlimited: true };
  return null;
}

function expiryKeyboard(cat: Catalog): ReplyMarkup {
  const B = cat.buttons;
  return markup(withCancel(cat, [B.expiry1, B.expiry7], [B.expiry30, B.expiryNever]), cat.ph.expiry);
}

function durationKeyboard(cat: Catalog): ReplyMarkup {
  const B = cat.buttons;
  return markup(withCancel(cat, [B.dur7, B.dur30], [B.dur90, B.durUnlimited]), cat.ph.duration);
}

function libraryModeKeyboard(cat: Catalog): ReplyMarkup {
  const B = cat.buttons;
  return markup(withCancel(cat, [B.allLibraries], [B.pickLibraries]), cat.ph.libraryMode);
}

function pickKeyboard(cat: Catalog, view: { page: number; pages: number; items: UserInfo[] }): ReplyMarkup {
  return markup(choiceRows(cat, view.items.map((user) => userButton(cat, user.id)), view), cat.ph.pickUser);
}

function appendNav(cat: Catalog, rows: string[][], page: number, pages: number): void {
  const nav = navRow(cat, page, pages);
  if (nav.length) rows.push(nav);
}

function shiftPage(B: Catalog["buttons"], page: number, text: string): number {
  return text === B.next ? page + 1 : page - 1;
}

function parentOf(screen: Screen): Screen {
  if (screen.type === "confirm") return pendingParent(screen.pending);
  return { type: SCREEN_PARENT[screen.type] };
}

function pendingParent(pending: PendingAction): Screen {
  if (pending.kind === "create_invite" || pending.kind === "delete_invite") return { type: "invites" };
  return { type: "users" };
}

function keyboardFor(cat: Catalog, screen: Screen): ReplyMarkup {
  if (screen.type === "confirm") return confirmKeyboard(cat);
  if (screen.type === "status") return statusKeyboard(cat);
  if (screen.type === "settings") return settingsKeyboard(cat);
  if (screen.type === "settings_quick") return quickSettingsKeyboard(cat);
  switch (parentOf(screen).type) {
    case "users":
      return usersKeyboard(cat);
    case "invites":
      return invitesKeyboard(cat);
    case "status":
      return statusKeyboard(cat);
    case "settings":
      return settingsKeyboard(cat);
    case "settings_quick":
      return quickSettingsKeyboard(cat);
    default:
      return mainKeyboard(cat);
  }
}

function commandOf(text: string): string | null {
  const match = /^\/([a-z0-9_]+)(?:@\w+)?(?:\s|$)/i.exec(text);
  return match?.[1]?.toLowerCase() ?? null;
}

async function send(ctx: AppContext, chatId: number, text: string, markup?: ReplyMarkup): Promise<void> {
  await ctx.telegram.sendMessage(chatId, text, markup);
}

/** 操作結果：API 有回訊息用訊息（escape 後），沒有則用在地化的完成提示。 */
async function sendActionResult(ctx: Req, chatId: number, message: string | null, markup: ReplyMarkup): Promise<void> {
  await send(ctx, chatId, esc(message ?? ctx.cat.msg.actionDone), markup);
}
