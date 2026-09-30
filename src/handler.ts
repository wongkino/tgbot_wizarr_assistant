import {
  actionPrompt,
  esc,
  formatDate,
  formatInviteList,
  formatInviteSummary,
  formatLibraries,
  formatLibraryChoices,
  formatPermissions,
  formatServerChoices,
  formatServers,
  formatStatus,
  formatUserList,
  helpText,
  link,
  QUICK_LIBRARIES,
  pageWindow,
  unauthorizedText,
  welcomeText,
} from "./format.ts";
import { qrPng } from "./qr.ts";
import {
  B,
  navRow,
  PAGE,
  confirmKeyboard,
  deleteInviteButton,
  inviteFilterOf,
  invitesKeyboard,
  librariesKeyboard,
  libraryButton,
  mainKeyboard,
  markup,
  parseDeleteInviteButton,
  parseLibraryButton,
  parseServerButton,
  parseUserButton,
  permissionKeyboard,
  removeKeyboard,
  serverButton,
  serversKeyboard,
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
  ReplyMarkup,
  Screen,
  ServerInfo,
  Update,
  UserAction,
  UserInfo,
} from "./types.ts";
import { WizarrError } from "./wizarr.ts";

const SESSION_TTL_SECONDS = 30 * 60;

export async function handleUpdate(update: Update, ctx: AppContext): Promise<void> {
  const message = update.message;
  if (!message?.from) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = (message.text ?? "").trim();

  if (message.chat.type !== "private") {
    if (commandOf(text)) {
      await send(ctx, chatId, "請在與機器人的私訊中使用。", removeKeyboard());
    }
    return;
  }

  if (!ctx.config.adminIds.has(userId)) {
    await send(ctx, chatId, unauthorizedText(userId), removeKeyboard());
    return;
  }

  const screen = (await ctx.sessions.get(String(userId))) ?? { type: "main" as const };
  try {
    const next = await dispatch(screen, text, ctx, chatId, userId);
    await ctx.sessions.set(String(userId), next, SESSION_TTL_SECONDS);
  } catch (error) {
    if (!(error instanceof WizarrError)) {
      console.error("[bot]", error instanceof Error ? error.message : error);
    }
    const detail = error instanceof WizarrError ? `Wizarr 錯誤：${esc(error.message)}` : "處理時發生錯誤，請稍後再試。";
    try {
      await send(ctx, chatId, detail, keyboardFor(screen));
    } catch (sendError) {
      console.error("[bot] 無法回覆", sendError instanceof Error ? sendError.message : sendError);
    }
  }
}

async function dispatch(
  screen: Screen,
  text: string,
  ctx: AppContext,
  chatId: number,
  userId: number,
): Promise<Screen> {
  if (!text) {
    await send(ctx, chatId, "請使用底部鍵盤。", keyboardFor(screen));
    return screen;
  }

  const command = commandOf(text);
  if (command === "start" || command === "menu" || text === B.home) {
    await send(ctx, chatId, welcomeText(), mainKeyboard());
    return { type: "main" };
  }
  if (command === "id") {
    await send(ctx, chatId, `你的 Telegram ID：<code>${userId}</code>`, keyboardFor(screen));
    return screen;
  }
  if (command === "help" || text === B.help) {
    await send(ctx, chatId, helpText(), keyboardFor(screen));
    return screen;
  }
  if (command === "cancel" || text === B.cancel) {
    const parent = parentOf(screen);
    await send(ctx, chatId, "已取消。", keyboardFor(parent));
    return parent;
  }
  if (text === B.status) {
    await send(ctx, chatId, formatStatus(await ctx.wizarr.getStatus()), keyboardFor(screen));
    return screen;
  }
  if (text === B.users) {
    await send(
      ctx,
      chatId,
      "選擇使用者操作。可先列出，再點啟用、停用、延長、刪除或重設密碼。",
      usersKeyboard(),
    );
    return { type: "users" };
  }
  if (text === B.invites) {
    await send(
      ctx,
      chatId,
      "選擇邀請操作。快速邀請會直接建立；建立邀請會逐步詢問伺服器、期限、媒體庫與權限。",
      invitesKeyboard(),
    );
    return { type: "invites" };
  }
  if (text === B.libraries || text === B.listLibraries) return showLibraries(ctx, chatId, 0);
  if (text === B.servers || text === B.listServers) return showServers(ctx, chatId, 0);
  if (text === B.listUsers) return showUserList(ctx, chatId, 0);

  const userAction = userActionOf(text);
  if (userAction) return beginPickUser(ctx, chatId, userAction, 0);

  const inviteFilter = inviteFilterOf(text);
  if (inviteFilter) return showInviteList(ctx, chatId, 0, inviteFilter);
  if (text === B.quickInvite) return beginQuickInvite(ctx, chatId);
  if (text === B.createInvite) return beginCreateInvite(ctx, chatId);
  if (text === B.deleteInvite) return beginDeleteInvite(ctx, chatId, 0);

  switch (screen.type) {
    case "user_list":
      if (text === B.prev || text === B.next) {
        return showUserList(ctx, chatId, shiftPage(screen.page, text));
      }
      break;
    case "invite_list":
      if (text === B.prev || text === B.next) {
        return showInviteList(ctx, chatId, shiftPage(screen.page, text), screen.filter);
      }
      break;
    case "library_list":
      if (text === B.prev || text === B.next) {
        return showLibraries(ctx, chatId, shiftPage(screen.page, text));
      }
      break;
    case "server_list":
      if (text === B.prev || text === B.next) {
        return showServers(ctx, chatId, shiftPage(screen.page, text));
      }
      break;
    case "pick_user":
      return handlePickUser(screen, text, ctx, chatId);
    case "extend_days":
      return handleExtendDays(screen, text, ctx, chatId);
    case "invite_server":
      return handleInviteServer(text, ctx, chatId);
    case "quick_invite_server":
      return handleQuickInviteServer(text, ctx, chatId);
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
    case "confirm":
      return handleConfirm(screen.pending, text, ctx, chatId);
    default:
      break;
  }

  await send(ctx, chatId, "請使用底部鍵盤。輸入 /help 可看說明。", keyboardFor(screen));
  return screen;
}

async function showUserList(ctx: AppContext, chatId: number, page: number): Promise<Screen> {
  const shown = await showList(ctx, chatId, await ctx.wizarr.listUsers(), page, PAGE.users, formatUserList, usersKeyboard());
  return { type: "user_list", page: shown };
}

async function beginPickUser(ctx: AppContext, chatId: number, action: UserAction, page: number): Promise<Screen> {
  const users = await ctx.wizarr.listUsers();
  if (!users.length) {
    await send(ctx, chatId, "目前沒有使用者。", usersKeyboard());
    return { type: "users" };
  }
  return renderPickUser(ctx, chatId, action, users, page);
}

async function renderPickUser(
  ctx: AppContext,
  chatId: number,
  action: UserAction,
  users: UserInfo[],
  page: number,
): Promise<Screen> {
  const view = pageWindow(users, page, PAGE.users);
  await send(ctx, chatId, `${actionPrompt(action)}\n\n${formatUserList(view)}`, pickKeyboard(view));
  return { type: "pick_user", action, page: view.page };
}

async function handlePickUser(
  screen: Extract<Screen, { type: "pick_user" }>,
  text: string,
  ctx: AppContext,
  chatId: number,
): Promise<Screen> {
  const users = await ctx.wizarr.listUsers();
  if (text === B.prev || text === B.next) {
    return renderPickUser(ctx, chatId, screen.action, users, shiftPage(screen.page, text));
  }
  const user = findUser(users, text);
  if (!user) {
    const view = pageWindow(users, screen.page, PAGE.users);
    await send(ctx, chatId, "找不到這個使用者。請點選按鈕，或輸入正確的 ID / 使用者名稱。", pickKeyboard(view));
    return screen;
  }

  if (screen.action === "enable") {
    const message = await ctx.wizarr.enableUser(user.id);
    await send(ctx, chatId, esc(message), usersKeyboard());
    return { type: "users" };
  }
  if (screen.action === "reset") {
    const reset = await ctx.wizarr.resetPassword(user.id);
    await send(
      ctx,
      chatId,
      [
        esc(reset.message),
        `使用者：${esc(user.username)}（#${user.id}）`,
        `連結：${link(reset.url)}`,
        `到期：${formatDate(reset.expiresAt)}`,
        "請只把連結交給這位使用者。",
      ].join("\n"),
      usersKeyboard(),
    );
    return { type: "users" };
  }
  if (screen.action === "extend") {
    await send(ctx, chatId, `要把 <b>${esc(user.username)}</b>（#${user.id}）延長幾天？`, extendDaysKeyboard());
    return { type: "extend_days", userId: user.id, username: user.username };
  }

  const pending: PendingAction =
    screen.action === "disable"
      ? { kind: "disable_user", userId: user.id, username: user.username }
      : { kind: "delete_user", userId: user.id, username: user.username };
  const warning =
    pending.kind === "disable_user"
      ? `將停用 <b>${esc(user.username)}</b>（#${user.id}）。\n若伺服器不支援停用，Wizarr 會改為刪除這個帳號。`
      : `將刪除 <b>${esc(user.username)}</b>（#${user.id}）。\n這會從 Wizarr 與媒體伺服器移除帳號。`;
  await send(ctx, chatId, warning, confirmKeyboard());
  return { type: "confirm", pending };
}

async function handleExtendDays(
  screen: Extract<Screen, { type: "extend_days" }>,
  text: string,
  ctx: AppContext,
  chatId: number,
): Promise<Screen> {
  const days = text === B.days7 ? 7 : text === B.days30 ? 30 : text === B.days90 ? 90 : 0;
  if (!days) {
    await send(ctx, chatId, "請選擇延長天數。", extendDaysKeyboard());
    return screen;
  }
  const result = await ctx.wizarr.extendUser(screen.userId, days);
  await send(
    ctx,
    chatId,
    `${esc(result.message)}\n新到期日：${formatDate(result.newExpiry)}`,
    usersKeyboard(),
  );
  return { type: "users" };
}

async function showInviteList(
  ctx: AppContext,
  chatId: number,
  page: number,
  filter: InviteFilter,
): Promise<Screen> {
  const invites = (await ctx.wizarr.listInvitations()).filter((invite) => filter === "all" || invite.status === filter);
  const shown = await showList(ctx, chatId, invites, page, PAGE.invites, (view) => formatInviteList(view, filter), invitesKeyboard());
  for (const invite of pageWindow(invites, shown, PAGE.invites).items) {
    await sendInviteQr(ctx, chatId, invite);
  }
  return { type: "invite_list", page: shown, filter };
}

async function beginQuickInvite(ctx: AppContext, chatId: number): Promise<Screen> {
  const servers = await embyServers(ctx);
  if (!servers.length) {
    await send(ctx, chatId, "沒有已驗證的 Emby 伺服器，無法建立快速邀請。", invitesKeyboard());
    return { type: "invites" };
  }
  const only = servers.length === 1 ? servers[0] : undefined;
  if (only) return createQuickInvite(ctx, chatId, only);
  await send(ctx, chatId, "選擇 Emby 伺服器，選完會立即建立邀請。", serverChoiceKeyboard(servers));
  return { type: "quick_invite_server" };
}

async function handleQuickInviteServer(text: string, ctx: AppContext, chatId: number): Promise<Screen> {
  const servers = await embyServers(ctx);
  const server = await chosenServer(text, ctx, chatId, servers, "請點選其中一台已驗證的 Emby 伺服器。");
  if (!server) return { type: "quick_invite_server" };
  return createQuickInvite(ctx, chatId, server);
}

const QUICK_INVITE_TTL_SECONDS = 8 * 24 * 60 * 60;

async function createQuickInvite(ctx: AppContext, chatId: number, server: ServerInfo): Promise<Screen> {
  const { selected, missing } = matchQuickLibraries(await enabledLibraries(ctx, server.id));
  if (missing.length) {
    await send(
      ctx,
      chatId,
      `這台 Emby 沒有完整的預設媒體庫，無法建立快速邀請。\n缺少：${missing.join("、")}。`,
      invitesKeyboard(),
    );
    return { type: "invites" };
  }
  const libraryIds = selected.map((library) => library.id);
  const libraries = `媒體庫：${selected.map((library) => esc(library.name)).join("、")}`;
  const invites = await ctx.wizarr.listInvitations();
  const existing = reusableQuickInvite(invites, libraryIds, await savedQuickInvite(ctx, server.id));
  if (existing) {
    await sendCreatedInvitation(ctx, chatId, existing, libraries, "已有相同的快速邀請，沿用這組代碼。");
    return { type: "invites" };
  }
  const invitation = await ctx.wizarr.createInvitation({
    serverIds: [server.id],
    expiresInDays: 7,
    duration: "unlimited",
    unlimited: true,
    libraryIds,
    allowDownloads: false,
    allowLiveTv: false,
    allowMobileUploads: false,
  });
  try {
    await rememberQuickInvite(ctx, server.id, invitation.code, libraryIds);
  } catch (error) {
    console.error("[bot] 無法記住快速邀請", error instanceof Error ? error.message : error);
  }
  await sendCreatedInvitation(ctx, chatId, invitation, libraries);
  return { type: "invites" };
}

function reusableQuickInvite(
  invites: InvitationInfo[],
  libraryIds: number[],
  saved: SavedQuickInvite | null,
  now = Date.now(),
): InvitationInfo | undefined {
  if (!saved || !sameIds(saved.libraryIds, libraryIds)) return undefined;
  return invites.find((invite) => invite.code === saved.code && quickInviteStillOpen(invite, now));
}

function quickInviteStillOpen(invite: InvitationInfo, now: number): boolean {
  if (!invite.unlimited || (invite.status !== "pending" && invite.status !== "used") || !invite.expires) return false;
  const time = Date.parse(invite.expires);
  return !Number.isNaN(time) && time > now && time <= now + QUICK_INVITE_TTL_SECONDS * 1000;
}

function matchQuickLibraries(libraries: LibraryInfo[]): { selected: LibraryInfo[]; missing: string[] } {
  const selected = new Map<number, LibraryInfo>();
  const missing: string[] = [];
  for (const preset of QUICK_LIBRARIES) {
    const matches = libraries.filter((library) => library.name === preset.name || library.externalId === preset.externalId);
    if (!matches.length) missing.push(preset.name);
    for (const library of matches) selected.set(library.id, library);
  }
  return { selected: [...selected.values()].sort((a, b) => a.id - b.id), missing };
}

interface SavedQuickInvite {
  code: string;
  libraryIds: number[];
}

async function savedQuickInvite(ctx: AppContext, serverId: number): Promise<SavedQuickInvite | null> {
  const raw = await ctx.sessions.getText(`quick-invite:${serverId}`);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const code = (parsed as { code?: unknown }).code;
    const libraryIds = (parsed as { libraryIds?: unknown }).libraryIds;
    if (typeof code !== "string" || !code || !Array.isArray(libraryIds)) return null;
    const ids = libraryIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0);
    if (ids.length !== libraryIds.length) return null;
    return { code, libraryIds: ids };
  } catch {
    return null;
  }
}

async function rememberQuickInvite(ctx: AppContext, serverId: number, code: string, libraryIds: number[]): Promise<void> {
  if (!code) return;
  const saved: SavedQuickInvite = { code, libraryIds };
  await ctx.sessions.setText(`quick-invite:${serverId}`, JSON.stringify(saved), QUICK_INVITE_TTL_SECONDS);
}

function sameIds(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort((x, y) => x - y);
  const b = [...right].sort((x, y) => x - y);
  return a.every((id, index) => id === b[index]);
}

function isEmby(server: ServerInfo): boolean {
  return server.serverType.trim().toLowerCase() === "emby";
}

async function embyServers(ctx: AppContext): Promise<ServerInfo[]> {
  return (await verifiedServers(ctx)).filter(isEmby);
}

async function verifiedServers(ctx: AppContext): Promise<ServerInfo[]> {
  return (await ctx.wizarr.listServers()).filter((server) => server.verified);
}

async function beginCreateInvite(ctx: AppContext, chatId: number): Promise<Screen> {
  const servers = await verifiedServers(ctx);
  if (!servers.length) {
    await send(ctx, chatId, "沒有已驗證的伺服器，無法建立邀請。", invitesKeyboard());
    return { type: "invites" };
  }
  await send(ctx, chatId, formatServerChoices(servers), serverChoiceKeyboard(servers));
  return { type: "invite_server" };
}

async function handleInviteServer(text: string, ctx: AppContext, chatId: number): Promise<Screen> {
  const servers = await verifiedServers(ctx);
  const server = await chosenServer(text, ctx, chatId, servers, "請點選其中一台已驗證的伺服器。");
  if (!server) return { type: "invite_server" };
  const draft = emptyDraft();
  draft.serverId = server.id;
  draft.serverName = server.name;
  await send(ctx, chatId, `伺服器：<b>${esc(server.name)}</b>\n邀請連結多久後失效？`, expiryKeyboard());
  return { type: "invite_expiry", draft };
}

async function handleInviteExpiry(draft: InviteDraft, text: string, ctx: AppContext, chatId: number): Promise<Screen> {
  const expires = expiryChoice(text);
  if (expires === undefined) {
    await send(ctx, chatId, "請選擇邀請連結的有效期。", expiryKeyboard());
    return { type: "invite_expiry", draft };
  }
  const next = { ...draft, expiresInDays: expires };
  await send(ctx, chatId, "受邀使用者的帳號可以使用多久？", durationKeyboard());
  return { type: "invite_duration", draft: next };
}

async function handleInviteDuration(draft: InviteDraft, text: string, ctx: AppContext, chatId: number): Promise<Screen> {
  const choice = durationChoice(text);
  if (!choice) {
    await send(ctx, chatId, "請選擇帳號使用期限。", durationKeyboard());
    return { type: "invite_duration", draft };
  }
  const next = { ...draft, duration: choice.duration, unlimited: choice.unlimited };
  await send(ctx, chatId, "要開放哪些媒體庫？", libraryModeKeyboard());
  return { type: "invite_library_mode", draft: next };
}

async function handleLibraryMode(draft: InviteDraft, text: string, ctx: AppContext, chatId: number): Promise<Screen> {
  if (text === B.allLibraries) return showPermissions(ctx, chatId, allLibraries(draft));
  if (text === B.pickLibraries) {
    const libraries = await enabledLibraries(ctx, draft.serverId);
    if (!libraries.length) {
      const next = allLibraries(draft);
      await send(
        ctx,
        chatId,
        `這台伺服器沒有已啟用的媒體庫，將改用全部可用範圍。\n\n${formatPermissions(next)}`,
        permissionKeyboard(next),
      );
      return { type: "invite_permissions", draft: next };
    }
    return renderLibraryPick(ctx, chatId, { ...draft, useAllLibraries: false }, 0, libraries);
  }
  await send(ctx, chatId, "請選擇全部媒體庫或自訂媒體庫。", libraryModeKeyboard());
  return { type: "invite_library_mode", draft };
}

async function handleLibraryPick(
  screen: Extract<Screen, { type: "invite_library_pick" }>,
  text: string,
  ctx: AppContext,
  chatId: number,
): Promise<Screen> {
  const libraries = await enabledLibraries(ctx, screen.draft.serverId);
  if (text === B.prev || text === B.next) {
    return renderLibraryPick(ctx, chatId, screen.draft, shiftPage(screen.page, text), libraries);
  }
  if (text === B.allLibraries) {
    return showPermissions(ctx, chatId, allLibraries(screen.draft));
  }
  if (text === B.librariesDone) {
    if (!screen.draft.libraryIds.length) {
      return renderLibraryPick(ctx, chatId, screen.draft, screen.page, libraries, "請至少選一個媒體庫，或改用全部媒體庫。");
    }
    return showPermissions(ctx, chatId, { ...screen.draft, useAllLibraries: false });
  }

  const libraryId = parseLibraryButton(text);
  const library = libraryId == null ? undefined : libraries.find((item) => item.id === libraryId);
  if (!library) {
    return renderLibraryPick(ctx, chatId, screen.draft, screen.page, libraries, "請點選媒體庫、選好了，或改用全部媒體庫。");
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
  ctx: AppContext,
  chatId: number,
  draft: InviteDraft,
  page: number,
  libraries: LibraryInfo[],
  notice?: string,
): Promise<Screen> {
  const view = pageWindow(libraries, page, PAGE.libraries);
  const rows = choiceRows(
    view.items.map((library) => libraryButton(library.id, draft.libraryIds.includes(library.id))),
    view,
    [[B.librariesDone, B.allLibraries]],
  );
  const body = formatLibraryChoices(view, draft.libraryIds);
  await send(ctx, chatId, notice ? `${notice}\n\n${body}` : body, markup(rows, "選擇媒體庫"));
  return { type: "invite_library_pick", draft, page: view.page };
}

async function handlePermissions(draft: InviteDraft, text: string, ctx: AppContext, chatId: number): Promise<Screen> {
  if (text === B.toggleDownloads || text === B.toggleLive || text === B.toggleUploads) {
    const next: InviteDraft = {
      ...draft,
      allowDownloads: text === B.toggleDownloads ? !draft.allowDownloads : draft.allowDownloads,
      allowLiveTv: text === B.toggleLive ? !draft.allowLiveTv : draft.allowLiveTv,
      allowMobileUploads: text === B.toggleUploads ? !draft.allowMobileUploads : draft.allowMobileUploads,
    };
    return showPermissions(ctx, chatId, next);
  }
  if (text === B.nextStep) return askCreateConfirm(ctx, chatId, draft);
  await send(ctx, chatId, "請切換權限，或按下一步。", permissionKeyboard(draft));
  return { type: "invite_permissions", draft };
}

async function showPermissions(ctx: AppContext, chatId: number, draft: InviteDraft): Promise<Screen> {
  await send(ctx, chatId, formatPermissions(draft), permissionKeyboard(draft));
  return { type: "invite_permissions", draft };
}

async function askCreateConfirm(ctx: AppContext, chatId: number, draft: InviteDraft): Promise<Screen> {
  const input = toInvitationInput(draft);
  if (!input) {
    await send(ctx, chatId, "邀請資料不完整，請重新建立。", invitesKeyboard());
    return { type: "invites" };
  }
  await send(ctx, chatId, formatInviteSummary(draft), confirmKeyboard());
  return { type: "confirm", pending: { kind: "create_invite", input, serverName: draft.serverName ?? "" } };
}

async function beginDeleteInvite(ctx: AppContext, chatId: number, page: number): Promise<Screen> {
  const invites = (await ctx.wizarr.listInvitations()).filter(
    (invite) => invite.status === "pending" || invite.status === "expired",
  );
  if (!invites.length) {
    await send(ctx, chatId, "沒有可刪除的待使用或已過期邀請。", invitesKeyboard());
    return { type: "invites" };
  }
  const view = pageWindow(invites, page, PAGE.invites);
  const rows = choiceRows(
    view.items.map((invite) => deleteInviteButton(invite.id)),
    view,
  );
  await send(
    ctx,
    chatId,
    `選擇要刪除的邀請。\n\n${formatInviteList(view, "all")}`,
    markup(rows, "選擇邀請"),
  );
  return { type: "delete_invite_pick", page: view.page };
}

async function handleDeleteInvitePick(page: number, text: string, ctx: AppContext, chatId: number): Promise<Screen> {
  if (text === B.prev || text === B.next) return beginDeleteInvite(ctx, chatId, shiftPage(page, text));
  const invitationId = parseDeleteInviteButton(text);
  const invites = await ctx.wizarr.listInvitations();
  const invite = invitationId == null ? undefined : invites.find((item) => item.id === invitationId);
  if (!invite) {
    await send(ctx, chatId, "找不到這個邀請，請重新選擇。");
    return beginDeleteInvite(ctx, chatId, page);
  }
  await send(
    ctx,
    chatId,
    `將刪除邀請 <code>${esc(invite.code)}</code>（#${invite.id}）。\n這不會移除已經建立的媒體帳號。`,
    confirmKeyboard(),
  );
  return { type: "confirm", pending: { kind: "delete_invite", invitationId: invite.id, code: invite.code } };
}

async function handleConfirm(pending: PendingAction, text: string, ctx: AppContext, chatId: number): Promise<Screen> {
  if (text !== B.confirm) {
    await send(ctx, chatId, "請按確認或取消。", confirmKeyboard());
    return { type: "confirm", pending };
  }

  if (pending.kind === "disable_user") {
    const message = await ctx.wizarr.disableUser(pending.userId);
    await send(ctx, chatId, esc(message), usersKeyboard());
    return { type: "users" };
  }
  if (pending.kind === "delete_user") {
    const message = await ctx.wizarr.deleteUser(pending.userId);
    await send(ctx, chatId, esc(message), usersKeyboard());
    return { type: "users" };
  }
  if (pending.kind === "delete_invite") {
    const message = await ctx.wizarr.deleteInvitation(pending.invitationId);
    await send(ctx, chatId, esc(message), invitesKeyboard());
    return { type: "invites" };
  }

  const invitation = await ctx.wizarr.createInvitation(pending.input);
  await sendCreatedInvitation(ctx, chatId, invitation);
  return { type: "invites" };
}

async function sendCreatedInvitation(
  ctx: AppContext,
  chatId: number,
  invitation: { code: string; url: string },
  detail?: string,
  title = "邀請已建立。",
): Promise<void> {
  const lines = [title, inviteCaption(invitation)];
  if (detail) lines.push(detail);
  await send(ctx, chatId, lines.join("\n"), invitesKeyboard());
  await sendInviteQr(ctx, chatId, invitation);
}

async function sendInviteQr(
  ctx: AppContext,
  chatId: number,
  invitation: { code: string; url: string },
): Promise<void> {
  if (!/^https?:\/\//i.test(invitation.url)) return;
  await ctx.telegram.sendPhoto(chatId, await qrPng(invitation.url), inviteCaption(invitation));
}

function inviteCaption(invitation: { code: string; url: string }): string {
  return `代碼：<code>${esc(invitation.code)}</code>\n${link(invitation.url)}`;
}

async function showLibraries(ctx: AppContext, chatId: number, page: number): Promise<Screen> {
  const shown = await showList(ctx, chatId, await ctx.wizarr.listLibraries(), page, PAGE.libraries, formatLibraries, librariesKeyboard());
  return { type: "library_list", page: shown };
}

async function showServers(ctx: AppContext, chatId: number, page: number): Promise<Screen> {
  const shown = await showList(ctx, chatId, await ctx.wizarr.listServers(), page, PAGE.servers, formatServers, serversKeyboard());
  return { type: "server_list", page: shown };
}

async function showList<T>(
  ctx: AppContext,
  chatId: number,
  items: T[],
  page: number,
  size: number,
  format: (view: ReturnType<typeof pageWindow<T>>) => string,
  keyboard: ReplyMarkup,
): Promise<number> {
  const view = pageWindow(items, page, size);
  await send(ctx, chatId, format(view), withNav(keyboard, view.page, view.pages));
  return view.page;
}

async function enabledLibraries(ctx: AppContext, serverId: number | undefined): Promise<LibraryInfo[]> {
  const libraries = await ctx.wizarr.listLibraries();
  return libraries.filter((library) => library.enabled && library.serverId === serverId);
}

function findUser(users: UserInfo[], text: string): UserInfo | undefined {
  const buttonId = parseUserButton(text);
  if (buttonId != null) return users.find((user) => user.id === buttonId);
  if (/^\d+$/.test(text)) return users.find((user) => user.id === Number(text));
  const lowered = text.toLowerCase();
  return users.find((user) => user.username.toLowerCase() === lowered);
}

function toInvitationInput(draft: InviteDraft): CreateInvitationInput | null {
  if (!draft.serverId || draft.expiresInDays === undefined || !draft.duration || draft.unlimited === undefined) {
    return null;
  }
  return {
    serverIds: [draft.serverId],
    expiresInDays: draft.expiresInDays,
    duration: draft.duration,
    unlimited: draft.unlimited,
    libraryIds: draft.useAllLibraries ? [] : draft.libraryIds,
    allowDownloads: draft.allowDownloads,
    allowLiveTv: draft.allowLiveTv,
    allowMobileUploads: draft.allowMobileUploads,
  };
}

async function chosenServer(
  text: string,
  ctx: AppContext,
  chatId: number,
  servers: ServerInfo[],
  miss: string,
): Promise<ServerInfo | undefined> {
  const serverId = parseServerButton(text);
  const server = serverId == null ? undefined : servers.find((item) => item.id === serverId);
  if (server) return server;
  await send(ctx, chatId, miss, serverChoiceKeyboard(servers));
  return undefined;
}

function extendDaysKeyboard(): ReplyMarkup {
  return markup(withCancel([B.days7, B.days30, B.days90]), "選擇天數");
}

function allLibraries(draft: InviteDraft): InviteDraft {
  return { ...draft, useAllLibraries: true, libraryIds: [], libraryNames: [] };
}

function withCancel(...rows: string[][]): string[][] {
  return [...rows, [B.cancel, B.home]];
}

function choiceRows(labels: string[], view?: { page: number; pages: number }, beforeCancel: string[][] = []): string[][] {
  const rows = labels.map((text) => [text]);
  if (view) appendNav(rows, view.page, view.pages);
  return withCancel(...rows, ...beforeCancel);
}

function emptyDraft(): InviteDraft {
  return {
    libraryIds: [],
    libraryNames: [],
    allowDownloads: false,
    allowLiveTv: false,
    allowMobileUploads: false,
  };
}

function expiryChoice(text: string): 1 | 7 | 30 | null | undefined {
  if (text === B.expiry1) return 1;
  if (text === B.expiry7) return 7;
  if (text === B.expiry30) return 30;
  if (text === B.expiryNever) return null;
  return undefined;
}

function durationChoice(text: string): { duration: string; unlimited: boolean } | null {
  if (text === B.dur7) return { duration: "7", unlimited: false };
  if (text === B.dur30) return { duration: "30", unlimited: false };
  if (text === B.dur90) return { duration: "90", unlimited: false };
  if (text === B.durUnlimited) return { duration: "unlimited", unlimited: true };
  return null;
}

function expiryKeyboard(): ReplyMarkup {
  return markup(withCancel([B.expiry1, B.expiry7], [B.expiry30, B.expiryNever]), "邀請連結有效期");
}

function durationKeyboard(): ReplyMarkup {
  return markup(withCancel([B.dur7, B.dur30], [B.dur90, B.durUnlimited]), "帳號使用期限");
}

function libraryModeKeyboard(): ReplyMarkup {
  return markup(withCancel([B.allLibraries], [B.pickLibraries]), "選擇媒體庫");
}

function serverChoiceKeyboard(servers: ServerInfo[]): ReplyMarkup {
  return markup(choiceRows(servers.map((server) => serverButton(server.id))), "選擇伺服器");
}

function pickKeyboard(view: { page: number; pages: number; items: UserInfo[] }): ReplyMarkup {
  return markup(choiceRows(view.items.map((user) => userButton(user.id)), view), "輸入 ID 或使用者名稱");
}

function appendNav(rows: string[][], page: number, pages: number): void {
  const nav = navRow(page, pages);
  if (nav.length) rows.push(nav);
}

function shiftPage(page: number, text: string): number {
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

function keyboardFor(screen: Screen): ReplyMarkup {
  if (screen.type === "confirm") return confirmKeyboard();
  switch (parentOf(screen).type) {
    case "users":
      return usersKeyboard();
    case "invites":
      return invitesKeyboard();
    case "libraries":
      return librariesKeyboard();
    case "servers":
      return serversKeyboard();
    default:
      return mainKeyboard();
  }
}

function commandOf(text: string): string | null {
  const match = /^\/([a-z0-9_]+)(?:@\w+)?(?:\s|$)/i.exec(text);
  return match?.[1]?.toLowerCase() ?? null;
}

async function send(ctx: AppContext, chatId: number, text: string, markup?: ReplyMarkup): Promise<void> {
  await ctx.telegram.sendMessage(chatId, text, markup);
}
