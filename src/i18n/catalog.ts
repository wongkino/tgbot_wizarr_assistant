import type {
  InvitationInfo,
  InviteDraft,
  InviteFilter,
  LibraryInfo,
  PermissionFlags,
  PickedServerLibraries,
  QuickInviteSettings,
  ServerInfo,
  StatusInfo,
  UserAction,
  UserInfo,
} from "../types.ts";

export interface Buttons {
  /** 主選單的狀態分類入口。 */
  status: string;
  users: string;
  invites: string;
  /** 狀態分類裡的三個項目。 */
  userStatus: string;
  libraryStatus: string;
  serverStatus: string;
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
  /** 預設媒體庫流程：選完一台後再加入其他伺服器。 */
  moreServers: string;
  /** 預設媒體庫流程：結束並儲存所有已選。 */
  picksDone: string;
  nextStep: string;
  toggleDownloads: string;
  toggleLive: string;
  toggleUploads: string;
  days7: string;
  days30: string;
  days90: string;
  settings: string;
  /** 設定根層的快速邀請分類入口。 */
  quickSettings: string;
  /** 從分類子選單返回設定根層。 */
  backSettings: string;
  setExpiry: string;
  setDuration: string;
  setPermissions: string;
  setLibraries: string;
  reuseCode: string;
  showQr: string;
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
    status: string;
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
  /** servers 用來把勾選的 serverIds 解析成名稱；null 表示未查詢（顯示 #id）。 */
  quickSettingsBody(settings: QuickInviteSettings, servers: ServerInfo[] | null): string[];
  inviteSummaryTitle: string;
  inviteSummaryBody(draft: InviteDraft): string[];
  durationLabel(duration: string, unlimited: boolean): string;
  allEnabledLibraries: string;
  librariesLine(names: string[]): string;
  /** 「伺服器：A、B」行，用於預設媒體庫挑選畫面的範圍標頭。 */
  serversLine(names: string[]): string;
  /** 預設媒體庫流程的累計摘要：逐台列出伺服器與已選媒體庫，並詢問是否繼續。 */
  pickedLibrariesText(picked: PickedServerLibraries[]): string;
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
    statusMenu: string;
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
    /** 選到的伺服器沒有已啟用的媒體庫：{name} */
    noLibrariesOnServerSettings(name: string): string;
    allLibrariesSaved: string;
    pickOneLibrary: string;
    librariesSaved: string;
    /** 預設媒體庫累計摘要後的追問。 */
    chooseMoreServers: string;
    /** 沿用代碼開關切換後的提示，代入新狀態。 */
    reuseSaved(on: boolean): string;
    /** QR code 開關切換後的提示，代入新狀態。 */
    qrSaved(on: boolean): string;
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
