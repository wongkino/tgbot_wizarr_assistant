import type {
  InvitationInfo,
  InviteDraft,
  InviteFilter,
  LibraryInfo,
  PermissionFlags,
  QuickInviteSettings,
  ServerInfo,
  StatusInfo,
  UserAction,
  UserInfo,
} from "../types.ts";

export interface Buttons {
  status: string;
  users: string;
  invites: string;
  libraries: string;
  servers: string;
  help: string;
  home: string;
  listUsers: string;
  enableUser: string;
  disableUser: string;
  extendUser: string;
  deleteUser: string;
  resetPassword: string;
  listInvites: string;
  pendingInvites: string;
  usedInvites: string;
  expiredInvites: string;
  quickInvite: string;
  createInvite: string;
  deleteInvite: string;
  listLibraries: string;
  listServers: string;
  confirm: string;
  cancel: string;
  prev: string;
  next: string;
  expiry1: string;
  expiry7: string;
  expiry30: string;
  expiryNever: string;
  dur7: string;
  dur30: string;
  dur90: string;
  durUnlimited: string;
  allLibraries: string;
  pickLibraries: string;
  librariesDone: string;
  serversDone: string;
  nextStep: string;
  toggleDownloads: string;
  toggleLive: string;
  toggleUploads: string;
  days7: string;
  days30: string;
  days90: string;
  settings: string;
  setExpiry: string;
  setDuration: string;
  setPermissions: string;
  setLibraries: string;
  setServers: string;
  /** 預設伺服器改回每次手動選擇。 */
  askServersEverytime: string;
  setLanguage: string;
  resetSettings: string;
}

export interface Catalog {
  /** Intl.DateTimeFormat 使用的 locale。 */
  dateLocale: string;
  buttons: Buttons;
  /** 動態實體按鈕的前綴，例如「使用者 #12」。 */
  labels: { user: string; server: string; library: string; deleteInvite: string };
  /** 各鍵盤的輸入框提示。 */
  ph: {
    main: string;
    users: string;
    invites: string;
    libraries: string;
    servers: string;
    settings: string;
    confirm: string;
    expiry: string;
    duration: string;
    libraryMode: string;
    pickUser: string;
    chooseServer: string;
    chooseLibrary: string;
    choosePresetLibrary: string;
    chooseInvite: string;
    chooseDays: string;
    language: string;
  };
  flag(on: boolean): string;
  yn(value: boolean): string;
  neverExpires: string;
  pagedTitle(title: string, page: number, pages: number, total: number, unit: string): string;
  permissionPlaceholder(permissions: PermissionFlags): string;
  welcome(): string;
  help(): string;
  unauthorized(userId: number): string;
  statusInfo(status: StatusInfo): string;
  usersTitle: string;
  usersUnit: string;
  usersEmpty: string;
  userItem(user: UserInfo): string[];
  inviteFilterTitle(filter: InviteFilter): string;
  invitesUnit: string;
  invitesEmpty(filter: InviteFilter): string;
  inviteItem(invite: InvitationInfo): string[];
  inviteStatusLabel(status: string): string;
  librariesTitle: string;
  librariesUnit: string;
  librariesEmpty: string;
  libraryItem(library: LibraryInfo): string;
  serversTitle: string;
  serversUnit: string;
  serversEmpty: string;
  serverItem(server: ServerInfo): string[];
  /** 伺服器選擇列表的逐台行（不含標題）。 */
  serverLines(servers: ServerInfo[]): string[];
  serverChoices(servers: ServerInfo[]): string;
  libraryChoicesTitle: string;
  libraryChoicesHint: string;
  libraryChoicesSelected(ids: number[]): string;
  libraryChoicesNone: string;
  permissionsTitle: string;
  permissionLines(permissions: PermissionFlags): string[];
  permissionsHintNext: string;
  permissionsHintConfirm: string;
  quickSettingsTitle: string;
  quickSettingsBody(settings: QuickInviteSettings): string[];
  inviteSummaryTitle: string;
  inviteSummaryBody(draft: InviteDraft): string[];
  durationLabel(duration: string, unlimited: boolean): string;
  allEnabledLibraries: string;
  librariesLine(names: string[]): string;
  actionPrompt(action: UserAction): string;
  msg: {
    privateOnly: string;
    wizarrError(detail: string): string;
    /** fetch 層級的連線失敗（無 HTTP 回應）。 */
    wizarrUnreachable(detail: string): string;
    genericError: string;
    useKeyboard: string;
    useKeyboardHelp: string;
    yourId(userId: number): string;
    cancelled: string;
    usersMenu: string;
    invitesMenu: string;
    noUsers: string;
    userNotFound: string;
    userLine(username: string, id: number): string;
    linkLine(urlHtml: string): string;
    expiresLine(formatted: string): string;
    resetShareWarning: string;
    extendDaysPrompt(username: string, id: number): string;
    disableWarning(username: string, id: number): string;
    deleteWarning(username: string, id: number): string;
    chooseDays: string;
    newExpiryLine(formatted: string): string;
    noServersQuick: string;
    chooseServersQuick: string;
    pickVerified: string;
    quickMissingLibraries(missing: string[], settingsButton: string): string;
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
    /** 預設伺服器的選擇提示。 */
    chooseServersSettings: string;
    noServersSettings: string;
    serversSaved: string;
    askServersSaved: string;
    /** 預設伺服器比對不到：{missing} {settingsButton} */
    quickMissingServers(missing: string[], settingsButton: string): string;
    allLibrariesSaved: string;
    pickOneLibrary: string;
    librariesSaved: string;
    libraryFallbackName(id: number): string;
    /** API 缺欄位時的使用者顯示名。 */
    userFallbackName(id: number): string;
    /** API 缺欄位時的伺服器顯示名。 */
    serverFallbackName(id: number): string;
    /** API 缺欄位時的伺服器名（無 ID 可用時）。 */
    unknownServer: string;
    /** API 沒回訊息時的操作完成提示。 */
    actionDone: string;
    /** API 沒回訊息時的延長完成提示。 */
    extendDone: string;
    /** API 沒回訊息時的重設密碼完成提示。 */
    resetDone: string;
    noServers: string;
    pickOneServer: string;
    inviteServerExpiryPrompt(serverNames: string[]): string;
    inviteDurationPrompt: string;
    libraryModePrompt: string;
    noLibrariesFallback: string;
    chooseLibraryMode: string;
    permissionsToggleOrNext: string;
    draftIncomplete: string;
    noDeletableInvites: string;
    chooseInviteToDelete: string;
    inviteNotFound: string;
    deleteInviteWarning(code: string, id: number): string;
    confirmOrCancel: string;
    inviteCaption(code: string, url: string): string;
    chooseLanguage: string;
    languageSaved: string;
  };
}
