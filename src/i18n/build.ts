import { esc, formatDate, link } from "../format.ts";
import type { PermissionFlags } from "../types.ts";
import type { Buttons, Catalog } from "./catalog.ts";

/**
 * 一種語言要提供的純字串資料；所有共用邏輯都在 buildCatalog。
 * 模板字串用 {name} 佔位符，由 buildCatalog 代入（需要跳脫的值會先處理）。
 * 多行模板直接用 \n 換行。
 */
export interface CatalogStrings {
  /** Intl.DateTimeFormat 使用的 locale。 */
  dateLocale: string;
  /** formatDate 遇到空值時顯示的文字。 */
  neverExpires: string;
  buttons: Buttons;
  labels: { user: string; server: string; library: string; deleteInvite: string };
  ph: Catalog["ph"];
  /** 名稱列表的分隔符，例如 ", " 或 "、"。 */
  delimiter: string;
  words: {
    yes: string;
    no: string;
    on: string;
    off: string;
    enabled: string;
    disabled: string;
    verified: string;
    unverified: string;
    unlimited: string;
    notSpecified: string;
    noEmail: string;
    allEnabledLibraries: string;
    /** 快速設定裡「未勾選伺服器」的顯示文字。 */
    allVerifiedServers: string;
  };
  filterTitles: { all: string; pending: string; used: string; expired: string };
  statusLabels: { pending: string; used: string; expired: string };
  invitesEmpty: { all: string; pending: string; used: string; expired: string };
  /** 各使用者操作的提示用語，代入 actionPrompt 的 {verb}。 */
  actionVerbs: { enable: string; disable: string; extend: string; delete: string; reset: string };
  titles: {
    users: string;
    usersUnit: string;
    usersEmpty: string;
    invitesUnit: string;
    libraries: string;
    librariesUnit: string;
    librariesEmpty: string;
    servers: string;
    serversUnit: string;
    serversEmpty: string;
    libraryChoices: string;
    libraryChoicesNone: string;
    permissions: string;
    permissionsHintNext: string;
    permissionsHintConfirm: string;
    quickSettings: string;
    inviteSummary: string;
    /** 預設媒體庫流程的累計摘要標題。 */
    pickedLibraries: string;
  };
  tpl: {
    /** {title} {page} {pages} {total} {unit} */
    pagedTitle: string;
    /** 權限鍵盤的輸入框提示：{downloads} {live} {uploads}（代入 on/off） */
    permissionPlaceholder: string;
    /** 伺服器詳情的權限行：{downloads} {live} {uploads}（代入 yes/no） */
    serverPermissions: string;
    /** 權限明細三行：{value}（代入 yes/no） */
    permDownloads: string;
    permLive: string;
    permUploads: string;
    /** {duration} */
    durationDays: string;
    /** 連結有效期一天（英文單數用；其他語言可與 expiryDays 相同），{days} */
    expiryOneDay: string;
    /** {days} */
    expiryDays: string;
    /** expiryLabel(null) */
    expiryNever: string;
    /** 使用者列表第二行：{server} {serverType} {email} */
    userLine2: string;
    /** 邀請列表第二行：{servers} */
    inviteLine2: string;
    /** 邀請列表第三行：{date} {duration} */
    inviteLine3: string;
    /** 伺服器第一行與選擇列表行：{id} {name} {serverType} */
    serverLine: string;
    serverInternal: string;
    serverInternalNone: string;
    serverExternal: string;
    serverExternalNone: string;
    serverChoicesHeader: string;
    /** {done}（媒體庫選好了按鈕） */
    libraryChoicesHint: string;
    /** {ids} */
    libraryChoicesSelected: string;
    /** 快速設定與邀請摘要共用：{expiry} */
    lineExpiry: string;
    /** {duration} */
    lineDuration: string;
    /** {libraries} */
    lineLibraries: string;
    /** 快速設定裡的伺服器行：{servers}（預先組好的多台字串） */
    lineServers: string;
    /** 快速設定裡的沿用代碼行：{value}（代入 on/off） */
    lineReuse: string;
    /** 摘要裡單台伺服器的格式：{name} {id} */
    serverEntry: string;
    /** 邀請摘要第一行：{servers}（預先組好的多台字串） */
    summaryServer: string;
    /** 預設媒體庫累計摘要的逐台行：{server} {libraries} */
    pickedServerLine: string;
    /** {verb} */
    actionPrompt: string;
    /** {users} {invites} {pending} {expired} */
    statusInfo: string;
    /** {userId} */
    unauthorized: string;
    /** {quickInvite} {status} {users} {invites} {settings} */
    welcome: string;
    /** {settings} */
    help: string;
  };
  msg: {
    privateOnly: string;
    /** {detail} */
    wizarrError: string;
    /** fetch 層級連線失敗：{detail} */
    wizarrUnreachable: string;
    genericError: string;
    useKeyboard: string;
    useKeyboardHelp: string;
    /** {userId} */
    yourId: string;
    cancelled: string;
    usersMenu: string;
    invitesMenu: string;
    statusMenu: string;
    noUsers: string;
    userNotFound: string;
    /** {username} {id} */
    userLine: string;
    /** {url}（已是 HTML） */
    linkLine: string;
    /** {date} */
    expiresLine: string;
    resetShareWarning: string;
    /** {username} {id} */
    extendDaysPrompt: string;
    /** {username} {id} */
    disableWarning: string;
    /** {username} {id} */
    deleteWarning: string;
    chooseDays: string;
    /** {date} */
    newExpiryLine: string;
    noServersQuick: string;
    pickVerified: string;
    /** {missing} {settingsButton} */
    quickMissingLibraries: string;
    quickReuseTitle: string;
    inviteCreatedTitle: string;
    settingsExpiryPrompt: string;
    settingsDurationPrompt: string;
    settingsResetDone: string;
    settingsChooseItem: string;
    chooseExpiry: string;
    expirySaved: string;
    chooseDuration: string;
    durationSaved: string;
    permissionsToggleOrConfirm: string;
    permissionsSaved: string;
    noServersLibrarySettings: string;
    chooseLibraryServersSettings: string;
    /** 選到的伺服器沒有已啟用的媒體庫：{name} */
    noLibrariesOnServerSettings: string;
    allLibrariesSaved: string;
    pickOneLibrary: string;
    librariesSaved: string;
    /** 預設媒體庫累計摘要後的追問。 */
    chooseMoreServers: string;
    /** 沿用代碼開關的儲存提示：{value}（代入 on/off） */
    reuseSaved: string;
    /** {id} */
    libraryFallbackName: string;
    /** API 缺欄位時的使用者顯示名：{id} */
    userFallbackName: string;
    /** API 缺欄位時的伺服器顯示名：{id} */
    serverFallbackName: string;
    /** API 缺欄位時的伺服器名（無 ID 可用時） */
    unknownServer: string;
    /** API 沒回訊息時的操作完成提示 */
    actionDone: string;
    /** API 沒回訊息時的延長完成提示 */
    extendDone: string;
    /** API 沒回訊息時的重設密碼完成提示 */
    resetDone: string;
    noServers: string;
    pickOneServer: string;
    /** {serverName}（多台時已預先 join） */
    inviteServerExpiryPrompt: string;
    inviteDurationPrompt: string;
    libraryModePrompt: string;
    noLibrariesFallback: string;
    chooseLibraryMode: string;
    permissionsToggleOrNext: string;
    draftIncomplete: string;
    noDeletableInvites: string;
    chooseInviteToDelete: string;
    inviteNotFound: string;
    /** {code} {id} */
    deleteInviteWarning: string;
    confirmOrCancel: string;
    /** {code} {link} */
    inviteCaption: string;
    chooseLanguage: string;
    languageSaved: string;
  };
}

/** 把 {name} 佔位符換成 vars 的值；未定義的佔位符保留原樣。 */
function tpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : match,
  );
}

/** 由字串資料建立完整語言目錄；所有語言共用的組裝邏輯集中在這裡。 */
export function buildCatalog(s: CatalogStrings): Catalog {
  const flag = (on: boolean): string => (on ? s.words.on : s.words.off);
  const yn = (value: boolean): string => (value ? s.words.yes : s.words.no);
  const join = (items: (string | number)[]): string => items.join(s.delimiter);
  const durationLabel = (duration: string, unlimited: boolean): string =>
    unlimited || duration === "unlimited" || duration === "" ? s.words.unlimited : tpl(s.tpl.durationDays, { duration });
  const expiryLabel = (days: number | null): string =>
    days == null ? s.tpl.expiryNever : tpl(days === 1 ? s.tpl.expiryOneDay : s.tpl.expiryDays, { days });
  const permissionLines = (permissions: PermissionFlags): string[] => [
    tpl(s.tpl.permDownloads, { value: yn(permissions.allowDownloads) }),
    tpl(s.tpl.permLive, { value: yn(permissions.allowLiveTv) }),
    tpl(s.tpl.permUploads, { value: yn(permissions.allowMobileUploads) }),
  ];
  const serverLine = (server: { id: number; name: string; serverType: string }): string =>
    tpl(s.tpl.serverLine, { id: server.id, name: esc(server.name), serverType: esc(server.serverType) });

  const catalog: Catalog = {
    dateLocale: s.dateLocale,
    buttons: s.buttons,
    labels: s.labels,
    ph: s.ph,
    flag,
    yn,
    neverExpires: s.neverExpires,
    pagedTitle: (title, page, pages, total, unit) =>
      tpl(s.tpl.pagedTitle, { title, page: page + 1, pages, total, unit }),
    permissionPlaceholder: (p) =>
      tpl(s.tpl.permissionPlaceholder, {
        downloads: flag(p.allowDownloads),
        live: flag(p.allowLiveTv),
        uploads: flag(p.allowMobileUploads),
      }),
    welcome: () =>
      tpl(s.tpl.welcome, {
        quickInvite: s.buttons.quickInvite,
        status: s.buttons.status,
        users: s.buttons.users,
        invites: s.buttons.invites,
        settings: s.buttons.settings,
      }),
    help: () => tpl(s.tpl.help, { settings: s.buttons.settings }),
    unauthorized: (userId) => tpl(s.tpl.unauthorized, { userId }),
    statusInfo: (status) =>
      tpl(s.tpl.statusInfo, {
        users: status.users,
        invites: status.invites,
        pending: status.pending,
        expired: status.expired,
      }),
    usersTitle: s.titles.users,
    usersUnit: s.titles.usersUnit,
    usersEmpty: s.titles.usersEmpty,
    userItem: (user) => [
      `<b>#${user.id}</b> ${esc(user.username)}`,
      tpl(s.tpl.userLine2, {
        server: esc(user.server),
        serverType: esc(user.serverType),
        email: user.email ? esc(user.email) : s.words.noEmail,
      }),
      tpl(s.msg.expiresLine, { date: formatDate(catalog, user.expires) }),
    ],
    inviteFilterTitle: (filter) => s.filterTitles[filter],
    invitesUnit: s.titles.invitesUnit,
    invitesEmpty: (filter) => s.invitesEmpty[filter],
    inviteItem: (invite) => {
      const servers = invite.serverNames.length ? join(invite.serverNames.map(esc)) : s.words.notSpecified;
      return [
        `<b>#${invite.id}</b> <code>${esc(invite.code)}</code> · ${esc(catalog.inviteStatusLabel(invite.status))}`,
        tpl(s.tpl.inviteLine2, { servers }),
        tpl(s.tpl.inviteLine3, {
          date: formatDate(catalog, invite.expires),
          duration: esc(durationLabel(invite.duration, invite.unlimited)),
        }),
        link(invite.url),
      ];
    },
    inviteStatusLabel: (status) => (s.statusLabels as Record<string, string>)[status] ?? status,
    librariesTitle: s.titles.libraries,
    librariesUnit: s.titles.librariesUnit,
    librariesEmpty: s.titles.librariesEmpty,
    libraryItem: (library) =>
      `<b>#${library.id}</b> ${esc(library.name)} · ${library.enabled ? s.words.enabled : s.words.disabled}`,
    serversTitle: s.titles.servers,
    serversUnit: s.titles.serversUnit,
    serversEmpty: s.titles.serversEmpty,
    serverItem: (server) => [
      serverLine(server),
      server.verified ? s.words.verified : s.words.unverified,
      server.serverUrl ? tpl(s.tpl.serverInternal, { url: esc(server.serverUrl) }) : s.tpl.serverInternalNone,
      server.externalUrl ? tpl(s.tpl.serverExternal, { url: esc(server.externalUrl) }) : s.tpl.serverExternalNone,
      tpl(s.tpl.serverPermissions, {
        downloads: yn(server.allowDownloads),
        live: yn(server.allowLiveTv),
        uploads: yn(server.allowMobileUploads),
      }),
    ],
    serverLines: (servers) => servers.map(serverLine),
    serverChoices: (servers) => [s.tpl.serverChoicesHeader, "", ...servers.map(serverLine)].join("\n"),
    libraryChoicesTitle: s.titles.libraryChoices,
    libraryChoicesHint: tpl(s.tpl.libraryChoicesHint, { done: s.buttons.librariesDone }),
    libraryChoicesSelected: (ids) => tpl(s.tpl.libraryChoicesSelected, { ids: join(ids.map((id) => `#${id}`)) }),
    libraryChoicesNone: s.titles.libraryChoicesNone,
    permissionsTitle: s.titles.permissions,
    permissionLines,
    permissionsHintNext: s.titles.permissionsHintNext,
    permissionsHintConfirm: s.titles.permissionsHintConfirm,
    quickSettingsTitle: s.titles.quickSettings,
    quickSettingsBody: (settings, servers) => {
      const libraries =
        settings.libraries === null ? s.words.allEnabledLibraries : join(settings.libraries.map((item) => esc(item.name)));
      const serverNames = settings.serverIds?.length
        ? join(
            settings.serverIds.map((id) => {
              const name = servers?.find((server) => server.id === id)?.name;
              return name ? esc(name) : tpl(s.msg.serverFallbackName, { id });
            }),
          )
        : s.words.allVerifiedServers;
      return [
        tpl(s.tpl.lineExpiry, { expiry: expiryLabel(settings.expiresInDays) }),
        tpl(s.tpl.lineDuration, { duration: esc(durationLabel(settings.duration, settings.unlimited)) }),
        tpl(s.tpl.lineServers, { servers: serverNames }),
        tpl(s.tpl.lineLibraries, { libraries }),
        tpl(s.tpl.lineReuse, { value: flag(settings.reuseCode) }),
        ...permissionLines(settings),
      ];
    },
    inviteSummaryTitle: s.titles.inviteSummary,
    inviteSummaryBody: (draft) => {
      const libraries = draft.useAllLibraries
        ? s.words.allEnabledLibraries
        : draft.libraryNames.length
          ? join(draft.libraryNames.map(esc))
          : join(draft.libraryIds.map((id) => `#${id}`));
      const servers = draft.serverNames.length
        ? join(
            draft.serverNames.map((name, index) =>
              tpl(s.tpl.serverEntry, { name: esc(name), id: draft.serverIds[index] ?? "?" }),
            ),
          )
        : s.words.notSpecified;
      return [
        tpl(s.tpl.summaryServer, { servers }),
        tpl(s.tpl.lineExpiry, { expiry: expiryLabel(draft.expiresInDays === undefined ? null : draft.expiresInDays) }),
        tpl(s.tpl.lineDuration, { duration: esc(durationLabel(draft.duration ?? "unlimited", draft.unlimited === true)) }),
        tpl(s.tpl.lineLibraries, { libraries }),
        ...permissionLines(draft),
      ];
    },
    durationLabel,
    allEnabledLibraries: s.words.allEnabledLibraries,
    librariesLine: (names) => tpl(s.tpl.lineLibraries, { libraries: join(names.map(esc)) }),
    serversLine: (names) => tpl(s.tpl.lineServers, { servers: join(names.map(esc)) }),
    pickedLibrariesText: (picked) =>
      [
        `<b>${s.titles.pickedLibraries}</b>`,
        ...picked.map((item) =>
          tpl(s.tpl.pickedServerLine, {
            server: esc(item.serverName),
            libraries: join(item.libraries.map((library) => esc(library.name))),
          }),
        ),
        "",
        s.msg.chooseMoreServers,
      ].join("\n"),
    actionPrompt: (action) => tpl(s.tpl.actionPrompt, { verb: s.actionVerbs[action] }),
    msg: {
      privateOnly: s.msg.privateOnly,
      wizarrError: (detail) => tpl(s.msg.wizarrError, { detail }),
      wizarrUnreachable: (detail) => tpl(s.msg.wizarrUnreachable, { detail }),
      genericError: s.msg.genericError,
      useKeyboard: s.msg.useKeyboard,
      useKeyboardHelp: s.msg.useKeyboardHelp,
      yourId: (userId) => tpl(s.msg.yourId, { userId }),
      cancelled: s.msg.cancelled,
      usersMenu: s.msg.usersMenu,
      invitesMenu: s.msg.invitesMenu,
      statusMenu: s.msg.statusMenu,
      noUsers: s.msg.noUsers,
      userNotFound: s.msg.userNotFound,
      userLine: (username, id) => tpl(s.msg.userLine, { username: esc(username), id }),
      linkLine: (urlHtml) => tpl(s.msg.linkLine, { url: urlHtml }),
      expiresLine: (formatted) => tpl(s.msg.expiresLine, { date: formatted }),
      resetShareWarning: s.msg.resetShareWarning,
      extendDaysPrompt: (username, id) => tpl(s.msg.extendDaysPrompt, { username: esc(username), id }),
      disableWarning: (username, id) => tpl(s.msg.disableWarning, { username: esc(username), id }),
      deleteWarning: (username, id) => tpl(s.msg.deleteWarning, { username: esc(username), id }),
      chooseDays: s.msg.chooseDays,
      newExpiryLine: (formatted) => tpl(s.msg.newExpiryLine, { date: formatted }),
      noServersQuick: s.msg.noServersQuick,
      pickVerified: s.msg.pickVerified,
      quickMissingLibraries: (missing, settingsButton) =>
        tpl(s.msg.quickMissingLibraries, { missing: join(missing.map(esc)), settingsButton }),
      quickReuseTitle: s.msg.quickReuseTitle,
      inviteCreatedTitle: s.msg.inviteCreatedTitle,
      settingsExpiryPrompt: s.msg.settingsExpiryPrompt,
      settingsDurationPrompt: s.msg.settingsDurationPrompt,
      settingsResetDone: s.msg.settingsResetDone,
      settingsChooseItem: s.msg.settingsChooseItem,
      chooseExpiry: s.msg.chooseExpiry,
      expirySaved: s.msg.expirySaved,
      chooseDuration: s.msg.chooseDuration,
      durationSaved: s.msg.durationSaved,
      permissionsToggleOrConfirm: s.msg.permissionsToggleOrConfirm,
      permissionsSaved: s.msg.permissionsSaved,
      noServersLibrarySettings: s.msg.noServersLibrarySettings,
      chooseLibraryServersSettings: s.msg.chooseLibraryServersSettings,
      noLibrariesOnServerSettings: (name) => tpl(s.msg.noLibrariesOnServerSettings, { name: esc(name) }),
      allLibrariesSaved: s.msg.allLibrariesSaved,
      pickOneLibrary: s.msg.pickOneLibrary,
      librariesSaved: s.msg.librariesSaved,
      chooseMoreServers: s.msg.chooseMoreServers,
      reuseSaved: (on) => tpl(s.msg.reuseSaved, { value: flag(on) }),
      libraryFallbackName: (id) => tpl(s.msg.libraryFallbackName, { id }),
      userFallbackName: (id) => tpl(s.msg.userFallbackName, { id }),
      serverFallbackName: (id) => tpl(s.msg.serverFallbackName, { id }),
      unknownServer: s.msg.unknownServer,
      actionDone: s.msg.actionDone,
      extendDone: s.msg.extendDone,
      resetDone: s.msg.resetDone,
      noServers: s.msg.noServers,
      pickOneServer: s.msg.pickOneServer,
      inviteServerExpiryPrompt: (serverNames) =>
        tpl(s.msg.inviteServerExpiryPrompt, { serverName: join(serverNames.map(esc)) }),
      inviteDurationPrompt: s.msg.inviteDurationPrompt,
      libraryModePrompt: s.msg.libraryModePrompt,
      noLibrariesFallback: s.msg.noLibrariesFallback,
      chooseLibraryMode: s.msg.chooseLibraryMode,
      permissionsToggleOrNext: s.msg.permissionsToggleOrNext,
      draftIncomplete: s.msg.draftIncomplete,
      noDeletableInvites: s.msg.noDeletableInvites,
      chooseInviteToDelete: s.msg.chooseInviteToDelete,
      inviteNotFound: s.msg.inviteNotFound,
      deleteInviteWarning: (code, id) => tpl(s.msg.deleteInviteWarning, { code: esc(code), id }),
      confirmOrCancel: s.msg.confirmOrCancel,
      inviteCaption: (code, url) => tpl(s.msg.inviteCaption, { code: esc(code), link: link(url) }),
      chooseLanguage: s.msg.chooseLanguage,
      languageSaved: s.msg.languageSaved,
    },
  };
  return catalog;
}
