export interface StatusInfo {
  users: number;
  invites: number;
  pending: number;
  expired: number;
}

export interface UserInfo {
  id: number;
  /** 缺欄位時為空字串，由 handler 依使用者語言補上顯示名。 */
  username: string;
  email: string | null;
  /** 缺欄位時為空字串，由 handler 依使用者語言補上顯示名。 */
  server: string;
  serverType: string;
  expires: string | null;
}

export interface InvitationInfo {
  id: number;
  code: string;
  url: string;
  status: string;
  created: string | null;
  expires: string | null;
  usedAt: string | null;
  usedBy: string | null;
  duration: string;
  unlimited: boolean;
  libraryIds: number[];
  serverNames: string[];
}

export interface LibraryInfo {
  id: number;
  /** 缺欄位時為空字串，由 handler 依使用者語言補上顯示名。 */
  name: string;
  externalId: string | null;
  serverId: number | null;
  /** 缺欄位時為空字串，由 handler 依使用者語言補上顯示名。 */
  serverName: string;
  enabled: boolean;
}

export interface ServerInfo {
  id: number;
  /** 缺欄位時為空字串，由 handler 依使用者語言補上顯示名。 */
  name: string;
  serverType: string;
  serverUrl: string | null;
  externalUrl: string | null;
  verified: boolean;
  allowDownloads: boolean;
  allowLiveTv: boolean;
  allowMobileUploads: boolean;
}

export interface CreateInvitationInput {
  serverIds: number[];
  expiresInDays: 1 | 7 | 30 | null;
  duration: string;
  unlimited: boolean;
  libraryIds: number[];
  allowDownloads: boolean;
  allowLiveTv: boolean;
  allowMobileUploads: boolean;
}

export interface PermissionFlags {
  allowDownloads: boolean;
  allowLiveTv: boolean;
  allowMobileUploads: boolean;
}

export interface QuickLibraryMatcher {
  name: string;
  externalId: string | null;
}

export interface QuickInviteSettings extends PermissionFlags {
  expiresInDays: 1 | 7 | 30 | null;
  duration: string;
  unlimited: boolean;
  /** 設定預設媒體庫時勾選的伺服器；null 表示未設定，快速邀請涵蓋所有已驗證伺服器。 */
  serverIds: number[] | null;
  libraries: QuickLibraryMatcher[] | null;
  /** 設定不變時沿用未過期的快速邀請代碼；false 則每次都新建。 */
  reuseCode: boolean;
}

export interface PasswordResetInfo {
  /** API 回傳的訊息；缺欄位時為 null，由 handler 依使用者語言補上。 */
  message: string | null;
  url: string;
  expiresAt: string | null;
}

export interface ExtendResult {
  /** API 回傳的訊息；缺欄位時為 null，由 handler 依使用者語言補上。 */
  message: string | null;
  newExpiry: string | null;
}

export interface WizarrApi {
  getStatus(): Promise<StatusInfo>;
  listUsers(query?: { username?: string }): Promise<UserInfo[]>;
  deleteUser(id: number): Promise<string | null>;
  enableUser(id: number): Promise<string | null>;
  disableUser(id: number): Promise<string | null>;
  extendUser(id: number, days: number): Promise<ExtendResult>;
  resetPassword(id: number): Promise<PasswordResetInfo>;
  listInvitations(): Promise<InvitationInfo[]>;
  createInvitation(input: CreateInvitationInput): Promise<InvitationInfo>;
  deleteInvitation(id: number): Promise<string | null>;
  listLibraries(): Promise<LibraryInfo[]>;
  listServers(): Promise<ServerInfo[]>;
}

export type ReplyButton = { text: string };

export type ReplyMarkup =
  | {
      keyboard: ReplyButton[][];
      resize_keyboard: true;
      is_persistent: true;
      input_field_placeholder?: string;
    }
  | { remove_keyboard: true };

export interface TelegramApi {
  sendMessage(chatId: number, text: string, markup?: ReplyMarkup): Promise<void>;
  sendPhoto(chatId: number, image: Uint8Array, caption?: string): Promise<void>;
  getUpdates(offset: number, signal?: AbortSignal): Promise<Update[]>;
  deleteWebhook(): Promise<void>;
}

export interface TelegramUser {
  id: number;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
}

export interface Update {
  update_id: number;
  message?: TelegramMessage;
}

export type UserAction = "enable" | "disable" | "extend" | "delete" | "reset";

export type InviteFilter = "all" | "pending" | "used" | "expired";

export interface InviteDraft extends PermissionFlags {
  serverIds: number[];
  serverNames: string[];
  expiresInDays?: 1 | 7 | 30 | null;
  duration?: string;
  unlimited?: boolean;
  useAllLibraries?: boolean;
  libraryIds: number[];
  libraryNames: string[];
}

export type PendingAction =
  | { kind: "disable_user"; userId: number; username: string }
  | { kind: "delete_user"; userId: number; username: string }
  | { kind: "delete_invite"; invitationId: number; code: string }
  | { kind: "create_invite"; input: CreateInvitationInput };

export type Screen =
  | { type: "main" }
  | { type: "users" }
  | { type: "invites" }
  | { type: "user_list"; page: number }
  | { type: "invite_list"; page: number; filter: InviteFilter }
  | { type: "library_list"; page: number }
  | { type: "server_list"; page: number }
  | { type: "pick_user"; action: UserAction; page: number }
  | { type: "extend_days"; userId: number; username: string }
  | { type: "invite_server"; selectedIds: number[] }
  | { type: "invite_expiry"; draft: InviteDraft }
  | { type: "invite_duration"; draft: InviteDraft }
  | { type: "invite_library_mode"; draft: InviteDraft }
  | { type: "invite_library_pick"; draft: InviteDraft; page: number }
  | { type: "invite_permissions"; draft: InviteDraft }
  | { type: "delete_invite_pick"; page: number }
  | { type: "settings" }
  | { type: "settings_quick" }
  | { type: "settings_expiry" }
  | { type: "settings_duration" }
  | { type: "settings_permissions"; permissions: PermissionFlags }
  | { type: "settings_library_server"; selectedIds: number[] }
  | { type: "settings_library_pick"; serverIds: number[]; serverNames: string[]; selectedIds: number[]; page: number }
  | { type: "settings_lang" }
  | { type: "confirm"; pending: PendingAction };

export interface SessionStore {
  get(key: string): Promise<Screen | null>;
  set(key: string, value: Screen, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  getText(key: string): Promise<string | null>;
  setText(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export interface AppConfig {
  telegramToken: string;
  webhookSecret: string;
  adminIds: Set<number>;
  wizarrApiBase: string;
  wizarrApiKey: string;
  wizarrPublicUrl: string;
  mode: "polling" | "webhook";
  port: number;
  /** 日期顯示使用的 IANA 時區名稱。 */
  timeZone: string;
}

export interface AppContext {
  config: AppConfig;
  wizarr: WizarrApi;
  telegram: TelegramApi;
  sessions: SessionStore;
}
