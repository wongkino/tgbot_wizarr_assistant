import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleUpdate } from "./handler.ts";
import { catalogFor } from "./i18n.ts";
import { deleteInviteButton, libraryButton, serverButton, userButton } from "./keyboard.ts";
import { MemorySessionStore } from "./session.ts";
import { defaultQuickSettings, saveQuickSettings } from "./settings.ts";
import type {
  AppConfig,
  CreateInvitationInput,
  ReplyMarkup,
  Update,
  UserInfo,
  WizarrApi,
} from "./types.ts";
import { WizarrError } from "./wizarr.ts";

const cat = catalogFor("zh-TW");
const B = cat.buttons;

const config: AppConfig = {
  telegramToken: "token",
  webhookSecret: "",
  adminIds: new Set([7]),
  wizarrApiBase: "https://wizarr.example/api",
  wizarrApiKey: "key",
  wizarrPublicUrl: "https://wizarr.example",
  mode: "polling",
  port: 8080,
};

function message(text: string, userId = 7, chatType = "private"): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      text,
      chat: { id: userId, type: chatType },
      from: { id: userId },
    },
  };
}

class Recorder {
  readonly messages: { text: string; markup?: ReplyMarkup }[] = [];
  readonly photos: { image: Uint8Array; caption?: string }[] = [];

  async sendMessage(_chatId: number, text: string, markup?: ReplyMarkup): Promise<void> {
    this.messages.push({ text, markup });
  }

  async sendPhoto(_chatId: number, image: Uint8Array, caption?: string): Promise<void> {
    this.photos.push({ image, caption });
  }

  async getUpdates(): Promise<Update[]> {
    return [];
  }

  async deleteWebhook(): Promise<void> {}

  last(): { text: string; markup?: ReplyMarkup } {
    const item = this.messages.at(-1);
    assert.ok(item);
    return item;
  }

  buttons(): string[] {
    const markup = this.last().markup;
    if (!markup || !("keyboard" in markup)) return [];
    return markup.keyboard.flat().map((button) => button.text);
  }
}

function quickLibraryFixtures() {
  return [
    library(3, "Movies", "mov"),
    library(12, "Anime", "ani"),
    library(13, "TV Shows", "tv"),
    library(14, "Documentaries", "doc"),
  ];
}

function library(id: number, name: string, externalId: string) {
  return {
    id,
    name,
    externalId,
    serverId: 1,
    serverName: "Emby",
    enabled: true,
  };
}

function server(id: number, name: string, serverType: string) {
  return {
    id,
    name,
    serverType,
    serverUrl: null,
    externalUrl: null,
    verified: true,
    allowDownloads: false,
    allowLiveTv: false,
    allowMobileUploads: false,
  };
}

function users(count: number): UserInfo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    username: `user${String(index + 1).padStart(2, "0")}`,
    email: null,
    server: "Plex",
    serverType: "plex",
    expires: null,
  }));
}

function fakeWizarr(overrides: Partial<WizarrApi> = {}): WizarrApi & { created: CreateInvitationInput[]; disabled: number[] } {
  const state = { created: [] as CreateInvitationInput[], disabled: [] as number[] };
  const api: WizarrApi = {
    async getStatus() {
      return { users: 2, invites: 4, pending: 1, expired: 1 };
    },
    async listUsers() {
      return [
        {
          id: 12,
          username: "alice",
          email: "a@example.com",
          server: "Plex",
          serverType: "plex",
          expires: null,
        },
      ];
    },
    async deleteUser() {
      return "deleted";
    },
    async enableUser() {
      return "enabled";
    },
    async disableUser(id) {
      state.disabled.push(id);
      return "disabled";
    },
    async extendUser() {
      return { message: "extended", newExpiry: "2026-10-01T04:00:00Z" };
    },
    async resetPassword() {
      return { message: "reset", url: "https://wizarr.example/reset/token", expiresAt: null };
    },
    async listInvitations() {
      return [
        {
          id: 8,
          code: "ABCD",
          url: "https://wizarr.example/j/ABCD",
          status: "pending",
          created: null,
          expires: null,
          usedAt: null,
          usedBy: null,
          duration: "unlimited",
          unlimited: true,
          libraryIds: [],
          serverNames: ["Plex"],
        },
      ];
    },
    async createInvitation(input) {
      state.created.push(input);
      return {
        id: 9,
        code: "NEW1",
        url: "https://wizarr.example/j/NEW1",
        status: "pending",
        created: null,
        expires: null,
        usedAt: null,
        usedBy: null,
        duration: input.duration,
        unlimited: input.unlimited,
        libraryIds: input.libraryIds,
        serverNames: ["Plex"],
      };
    },
    async deleteInvitation() {
      return "invite deleted";
    },
    async listLibraries() {
      return [
        {
          id: 3,
          name: "Movies",
          externalId: "mov",
          serverId: 1,
          serverName: "Plex",
          enabled: true,
        },
      ];
    },
    async listServers() {
      return [
        {
          id: 1,
          name: "Plex",
          serverType: "plex",
          serverUrl: "http://plex:32400",
          externalUrl: null,
          verified: true,
          allowDownloads: false,
          allowLiveTv: false,
          allowMobileUploads: false,
        },
      ];
    },
    ...overrides,
  };
  return Object.assign(api, state);
}

async function run(text: string, ctx: { wizarr: WizarrApi; telegram: Recorder; sessions: MemorySessionStore }, userId = 7) {
  if (!(await ctx.sessions.getText(`lang:${userId}`))) {
    await ctx.sessions.setText(`lang:${userId}`, "zh-TW", 3600);
  }
  await handleUpdate(message(text, userId), {
    config: userId === 7 ? config : { ...config, adminIds: new Set([7]) },
    wizarr: ctx.wizarr,
    telegram: ctx.telegram,
    sessions: ctx.sessions,
  });
}

describe("授權", () => {
  it("未授權的人只會收到自己的 ID", async () => {
    let called = false;
    const telegram = new Recorder();
    const sessions = new MemorySessionStore();
    await sessions.setText("lang:99", "zh-TW", 3600);
    await handleUpdate(message("/start", 99), {
      config,
      wizarr: fakeWizarr({
        async getStatus() {
          called = true;
          return { users: 0, invites: 0, pending: 0, expired: 0 };
        },
      }),
      telegram,
      sessions,
    });
    assert.equal(called, false);
    assert.match(telegram.last().text, /99/);
    assert.match(telegram.last().text, /未獲授權/);
  });

  it("未授權且未選語言時預設用英文", async () => {
    const telegram = new Recorder();
    await handleUpdate(message("/start", 99), {
      config,
      wizarr: fakeWizarr(),
      telegram,
      sessions: new MemorySessionStore(),
    });
    assert.match(telegram.last().text, /not authorized/);
    assert.match(telegram.last().text, /99/);
  });

  it("群組裡的一般訊息不會回覆", async () => {
    const telegram = new Recorder();
    await handleUpdate(message("你好", 7, "group"), {
      config,
      wizarr: fakeWizarr(),
      telegram,
      sessions: new MemorySessionStore(),
    });
    assert.equal(telegram.messages.length, 0);
  });
});

describe("語言", () => {
  function rawCtx(wizarr: WizarrApi = fakeWizarr()) {
    return { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
  }

  async function runRaw(text: string, ctx: ReturnType<typeof rawCtx>) {
    await handleUpdate(message(text), {
      config,
      wizarr: ctx.wizarr,
      telegram: ctx.telegram,
      sessions: ctx.sessions,
    });
  }

  it("初次使用要先選語言", async () => {
    const ctx = rawCtx();
    await runRaw("/start", ctx);
    assert.match(ctx.telegram.last().text, /choose your language/);
    for (const label of ["English", "繁體中文", "简体中文", "日本語"]) {
      assert.ok(ctx.telegram.buttons().includes(label), label);
    }
    await runRaw("隨便打字", ctx);
    assert.match(ctx.telegram.last().text, /choose your language/);
  });

  it("選完語言後用該語言顯示主選單", async () => {
    const ctx = rawCtx();
    await runRaw("/start", ctx);
    await runRaw("English", ctx);
    assert.match(ctx.telegram.last().text, /Wizarr Assistant/);
    const en = catalogFor("en").buttons;
    assert.ok(ctx.telegram.buttons().includes(en.status));
    await runRaw(en.status, ctx);
    assert.match(ctx.telegram.last().text, /Users: 2/);
  });

  it("設定裡可切換語言，切換後立即生效", async () => {
    const ctx = rawCtx();
    await run(B.settings, ctx);
    assert.match(ctx.telegram.last().text, /快速邀請設定/);
    await run(B.setLanguage, ctx);
    assert.ok(ctx.telegram.buttons().includes("日本語"));
    await run("English", ctx);
    assert.match(ctx.telegram.last().text, /Language switched to English/);
    assert.match(ctx.telegram.last().text, /Quick invite settings/);
    const en = catalogFor("en").buttons;
    await run(en.settings, ctx);
    assert.match(ctx.telegram.last().text, /Quick invite settings/);
    await run(en.setLanguage, ctx);
    await run("繁體中文", ctx);
    assert.match(ctx.telegram.last().text, /語言已切換為繁體中文/);
    assert.match(ctx.telegram.last().text, /快速邀請設定/);
  });

  it("切換語言後快速邀請照常運作", async () => {
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Emby", "emby")];
      },
      async listLibraries() {
        return quickLibraryFixtures();
      },
    });
    const ctx = rawCtx(wizarr);
    await runRaw("English", ctx);
    const en = catalogFor("en").buttons;
    await runRaw(en.quickInvite, ctx);
    assert.match(ctx.telegram.last().text, /Invite created/);
    assert.match(ctx.telegram.last().text, /Libraries: All enabled libraries/);
    assert.equal(wizarr.created.length, 1);
  });
});

describe("回覆鍵盤", () => {
  it("原型屬性名稱不會被當成操作", async () => {
    const ctx = { wizarr: fakeWizarr(), telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run("toString", ctx);
    assert.match(ctx.telegram.last().text, /請使用底部鍵盤/);
    assert.equal(ctx.telegram.buttons().includes(B.enableUser), false);
  });

  it("/start 顯示主選單", async () => {
    const ctx = { wizarr: fakeWizarr(), telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run("/start", ctx);
    assert.ok(ctx.telegram.buttons().includes(B.status));
    assert.ok(ctx.telegram.buttons().includes(B.invites));
  });

  it("狀態會顯示 Wizarr 統計", async () => {
    const ctx = { wizarr: fakeWizarr(), telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.status, ctx);
    assert.match(ctx.telegram.last().text, /使用者：2/);
    assert.match(ctx.telegram.last().text, /待使用：1/);
  });

  it("使用者列表可以翻頁", async () => {
    const wizarr = fakeWizarr({ async listUsers() { return users(9); } });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.listUsers, ctx);
    assert.ok(ctx.telegram.buttons().includes(B.next));
    assert.match(ctx.telegram.last().text, /user01/);
    assert.doesNotMatch(ctx.telegram.last().text, /user09/);
    await run(B.next, ctx);
    assert.match(ctx.telegram.last().text, /user09/);
    assert.ok(ctx.telegram.buttons().includes(B.prev));
  });

  it("停用使用者要確認，取消不會呼叫 API", async () => {
    const wizarr = fakeWizarr();
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.disableUser, ctx);
    await run(userButton(cat, 12), ctx);
    assert.match(ctx.telegram.last().text, /改為刪除/);
    assert.deepEqual(wizarr.disabled, []);
    await run(B.cancel, ctx);
    assert.deepEqual(wizarr.disabled, []);
    await run(B.disableUser, ctx);
    await run(userButton(cat, 12), ctx);
    await run(B.confirm, ctx);
    assert.deepEqual(wizarr.disabled, [12]);
  });

  it("快速邀請直接建立，只用 Emby 與設定的媒體庫", async () => {
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Emby", "emby"), server(2, "Plex", "plex")];
      },
      async listLibraries() {
        return [
          library(3, "Movies", "mov"),
          library(8, "Collections", "col"),
          library(9, "Music Videos", "mv"),
          library(11, "Shorts", "short"),
          library(12, "Anime", "ani"),
          library(13, "TV Shows", "tv"),
          library(14, "Documentaries", "doc"),
        ];
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await saveQuickSettings(ctx.sessions, {
      ...defaultQuickSettings(),
      libraries: [
        { name: "Movies", externalId: "mov" },
        { name: "Anime", externalId: "ani" },
        { name: "TV Shows", externalId: "tv" },
        { name: "Documentaries", externalId: "doc" },
      ],
    });
    await run(B.quickInvite, ctx);
    assert.match(ctx.telegram.last().text, /邀請已建立/);
    assert.match(ctx.telegram.last().text, /媒體庫：Movies、Anime、TV Shows、Documentaries/);
    assert.doesNotMatch(ctx.telegram.last().text, /Music Videos|Shorts|Collections/);
    assert.deepEqual(wizarr.created, [
      {
        serverIds: [1],
        expiresInDays: 7,
        duration: "unlimited",
        unlimited: true,
        libraryIds: [3, 12, 13, 14],
        allowDownloads: false,
        allowLiveTv: false,
        allowMobileUploads: false,
      },
    ]);
    assert.equal(ctx.telegram.photos.length, 1);
    assert.match(ctx.telegram.photos[0]?.caption ?? "", /NEW1/);
    assert.match(ctx.telegram.photos[0]?.caption ?? "", /https:\/\/wizarr\.example\/j\/NEW1/);
  });

  it("Wizarr 沒有回傳媒體庫時仍沿用未過期的快速邀請", async () => {
    const invites: Awaited<ReturnType<WizarrApi["listInvitations"]>> = [];
    const created: CreateInvitationInput[] = [];
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Emby", "emby")];
      },
      async listLibraries() {
        return quickLibraryFixtures();
      },
      async listInvitations() {
        return invites;
      },
      async createInvitation(input) {
        created.push(input);
        const invite = {
          id: 9,
          code: "NEW1",
          url: "https://wizarr.example/j/NEW1",
          status: "pending",
          created: null,
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          usedAt: null,
          usedBy: null,
          duration: "unlimited",
          unlimited: true,
          libraryIds: [],
          serverNames: ["Emby"],
        };
        invites.push(invite);
        return invite;
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.quickInvite, ctx);
    await run(B.quickInvite, ctx);
    const current = invites[0];
    assert.ok(current);
    current.status = "used";
    await run(B.quickInvite, ctx);
    assert.equal(created.length, 1);
    assert.match(ctx.telegram.last().text, /沿用這組代碼/);
    assert.match(ctx.telegram.last().text, /NEW1/);
  });

  it("沒有到期時間或缺少設定的媒體庫時不會沿用或建立", async () => {
    const openEnded = fakeWizarr({
      async listServers() {
        return [server(1, "Emby", "emby")];
      },
      async listLibraries() {
        return quickLibraryFixtures();
      },
      async listInvitations() {
        return [
          {
            id: 8,
            code: "SAME",
            url: "https://wizarr.example/j/SAME",
            status: "pending",
            created: null,
            expires: null,
            usedAt: null,
            usedBy: null,
            duration: "unlimited",
            unlimited: true,
            libraryIds: [3, 12, 13, 14],
            serverNames: ["Emby"],
          },
        ];
      },
    });
    const openCtx = { wizarr: openEnded, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.quickInvite, openCtx);
    assert.equal(openEnded.created.length, 1);
    assert.doesNotMatch(openCtx.telegram.last().text, /沿用這組代碼/);

    const incomplete = fakeWizarr({
      async listServers() {
        return [server(1, "Emby", "emby")];
      },
      async listLibraries() {
        return [library(3, "Movies", "mov"), library(12, "Anime", "ani")];
      },
    });
    const incompleteCtx = { wizarr: incomplete, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await saveQuickSettings(incompleteCtx.sessions, {
      ...defaultQuickSettings(),
      libraries: [
        { name: "Movies", externalId: "mov" },
        { name: "Anime", externalId: "ani" },
        { name: "TV Shows", externalId: "tv" },
        { name: "Documentaries", externalId: "doc" },
      ],
    });
    await run(B.quickInvite, incompleteCtx);
    assert.equal(incomplete.created.length, 0);
    assert.match(incompleteCtx.telegram.last().text, /缺少：TV Shows、Documentaries/);
  });

  it("沒有 Emby 時不會建立快速邀請", async () => {
    const wizarr = fakeWizarr();
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.quickInvite, ctx);
    assert.match(ctx.telegram.last().text, /沒有已驗證的 Emby/);
    assert.equal(wizarr.created.length, 0);
    assert.equal(ctx.telegram.photos.length, 0);
  });

  function embyQuickCtx() {
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Emby", "emby")];
      },
      async listLibraries() {
        return quickLibraryFixtures();
      },
    });
    return { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
  }

  it("設定頁可調整快速邀請的預設值", async () => {
    const ctx = embyQuickCtx();
    await run(B.settings, ctx);
    assert.match(ctx.telegram.last().text, /快速邀請設定/);
    assert.match(ctx.telegram.last().text, /邀請連結：7 天/);
    assert.match(ctx.telegram.last().text, /帳號期限：無限制/);
    await run(B.setExpiry, ctx);
    await run(B.expiry30, ctx);
    assert.match(ctx.telegram.last().text, /已儲存連結有效期/);
    assert.match(ctx.telegram.last().text, /邀請連結：30 天/);
    await run(B.setDuration, ctx);
    await run(B.dur30, ctx);
    assert.match(ctx.telegram.last().text, /帳號期限：30 天/);
    await run(B.setPermissions, ctx);
    await run(B.toggleDownloads, ctx);
    assert.match(ctx.telegram.last().text, /下載：是/);
    await run(B.confirm, ctx);
    assert.match(ctx.telegram.last().text, /已儲存權限/);
    await run(B.quickInvite, ctx);
    assert.deepEqual(ctx.wizarr.created, [
      {
        serverIds: [1],
        expiresInDays: 30,
        duration: "30",
        unlimited: false,
        libraryIds: [],
        allowDownloads: true,
        allowLiveTv: false,
        allowMobileUploads: false,
      },
    ]);
  });

  it("可在設定裡自訂快速邀請的預設媒體庫", async () => {
    const ctx = embyQuickCtx();
    await run(B.settings, ctx);
    await run(B.setLibraries, ctx);
    assert.doesNotMatch(ctx.telegram.last().text, /✅/);
    await run(libraryButton(cat, 3, false), ctx);
    assert.match(ctx.telegram.last().text, /✅/);
    await run(libraryButton(cat, 12, false), ctx);
    await run(B.librariesDone, ctx);
    assert.match(ctx.telegram.last().text, /已儲存預設媒體庫/);
    assert.match(ctx.telegram.last().text, /媒體庫：Movies、Anime/);
    await run(B.quickInvite, ctx);
    assert.deepEqual(ctx.wizarr.created[0]?.libraryIds, [3, 12]);
  });

  it("預設媒體庫可改為全部已啟用的媒體庫", async () => {
    const ctx = embyQuickCtx();
    await run(B.settings, ctx);
    await run(B.setLibraries, ctx);
    await run(B.allLibraries, ctx);
    assert.match(ctx.telegram.last().text, /已改用全部已啟用的媒體庫/);
    await run(B.quickInvite, ctx);
    assert.deepEqual(ctx.wizarr.created[0]?.libraryIds, []);
    assert.match(ctx.telegram.last().text, /媒體庫：全部已啟用的媒體庫/);
  });

  it("重設預設會還原快速邀請設定", async () => {
    const ctx = embyQuickCtx();
    await run(B.settings, ctx);
    await run(B.setExpiry, ctx);
    await run(B.expiry30, ctx);
    assert.match(ctx.telegram.last().text, /邀請連結：30 天/);
    await run(B.resetSettings, ctx);
    assert.match(ctx.telegram.last().text, /已重設為預設值/);
    assert.match(ctx.telegram.last().text, /邀請連結：7 天/);
    await run(B.quickInvite, ctx);
    assert.equal(ctx.wizarr.created[0]?.expiresInDays, 7);
  });

  it("更改設定後不會沿用舊的快速邀請", async () => {
    const invites: Awaited<ReturnType<WizarrApi["listInvitations"]>> = [];
    const created: CreateInvitationInput[] = [];
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Emby", "emby")];
      },
      async listLibraries() {
        return quickLibraryFixtures();
      },
      async listInvitations() {
        return invites;
      },
      async createInvitation(input) {
        created.push(input);
        const invite = {
          id: 9 + created.length,
          code: `CODE${created.length}`,
          url: `https://wizarr.example/j/CODE${created.length}`,
          status: "pending",
          created: null,
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          usedAt: null,
          usedBy: null,
          duration: input.duration,
          unlimited: input.unlimited,
          libraryIds: input.libraryIds,
          serverNames: ["Emby"],
        };
        invites.push(invite);
        return invite;
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.quickInvite, ctx);
    await run(B.quickInvite, ctx);
    assert.equal(created.length, 1);
    assert.match(ctx.telegram.last().text, /沿用這組代碼/);
    await run(B.settings, ctx);
    await run(B.setExpiry, ctx);
    await run(B.expiry30, ctx);
    await run(B.quickInvite, ctx);
    assert.equal(created.length, 2);
    assert.equal(created[1]?.expiresInDays, 30);
    assert.match(ctx.telegram.last().text, /CODE2/);
  });

  it("可逐步建立邀請並限制媒體庫", async () => {
    const wizarr = fakeWizarr();
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.createInvite, ctx);
    // 只有一台已驗證伺服器，直接跳到有效期選擇
    assert.match(ctx.telegram.last().text, /邀請連結多久後失效/);
    await run(B.expiry7, ctx);
    await run(B.durUnlimited, ctx);
    await run(B.pickLibraries, ctx);
    await run(libraryButton(cat, 3, false), ctx);
    assert.match(ctx.telegram.last().text, /✅/);
    await run(B.librariesDone, ctx);
    await run(B.toggleDownloads, ctx);
    assert.match(ctx.telegram.last().text, /下載：是/);
    await run(B.nextStep, ctx);
    await run(B.confirm, ctx);
    assert.deepEqual(wizarr.created, [
      {
        serverIds: [1],
        expiresInDays: 7,
        duration: "unlimited",
        unlimited: true,
        libraryIds: [3],
        allowDownloads: true,
        allowLiveTv: false,
        allowMobileUploads: false,
      },
    ]);
    assert.match(ctx.telegram.last().text, /https:\/\/wizarr\.example\/j\/NEW1/);
    assert.equal(ctx.telegram.photos.length, 1);
    assert.match(ctx.telegram.photos[0]?.caption ?? "", /NEW1/);
  });

  it("多台伺服器時逐步建立會列出對照再選擇", async () => {
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Plex", "plex"), server(2, "Emby 二號", "emby")];
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.createInvite, ctx);
    const text = ctx.telegram.last().text;
    assert.match(text, /選擇要邀請的伺服器/);
    assert.match(text, /#1<\/b> Plex（plex）/);
    assert.match(text, /#2<\/b> Emby 二號（emby）/);
    await run(serverButton(cat, 2), ctx);
    await run(B.serversDone, ctx);
    assert.match(ctx.telegram.last().text, /伺服器：<b>Emby 二號<\/b>/);
    await run(B.expiry7, ctx);
    await run(B.durUnlimited, ctx);
    await run(B.allLibraries, ctx);
    await run(B.nextStep, ctx);
    await run(B.confirm, ctx);
    assert.deepEqual(wizarr.created[0]?.serverIds, [2]);
  });

  it("逐步建立可複選多台伺服器", async () => {
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Plex", "plex"), server(2, "Emby 二號", "emby")];
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.createInvite, ctx);
    await run(B.serversDone, ctx);
    assert.match(ctx.telegram.last().text, /請至少選一台伺服器/);
    await run(serverButton(cat, 2), ctx);
    await run(serverButton(cat, 1), ctx);
    const buttons = ctx.telegram.buttons();
    assert.ok(buttons.some((row) => row.includes(`✅ ${serverButton(cat, 1)}`)));
    assert.ok(buttons.some((row) => row.includes(`✅ ${serverButton(cat, 2)}`)));
    await run(serverButton(cat, 2), ctx);
    assert.ok(!ctx.telegram.buttons().some((row) => row.includes(`✅ ${serverButton(cat, 2)}`)));
    await run(serverButton(cat, 2), ctx);
    await run(B.serversDone, ctx);
    assert.match(ctx.telegram.last().text, /伺服器：<b>Plex、Emby 二號<\/b>/);
    await run(B.expiry7, ctx);
    await run(B.durUnlimited, ctx);
    await run(B.allLibraries, ctx);
    await run(B.nextStep, ctx);
    assert.match(ctx.telegram.last().text, /伺服器：Plex（#1）、Emby 二號（#2）/);
    await run(B.confirm, ctx);
    assert.deepEqual(wizarr.created[0]?.serverIds, [1, 2]);
  });

  it("多台 Emby 時快速邀請會列出名稱對照", async () => {
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Emby 一號", "emby"), server(2, "Emby 二號", "emby")];
      },
      async listLibraries() {
        return quickLibraryFixtures().map((item) => ({ ...item, serverId: 2, serverName: "Emby 二號" }));
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.quickInvite, ctx);
    const text = ctx.telegram.last().text;
    assert.match(text, /選擇 Emby 伺服器/);
    assert.match(text, /#1<\/b> Emby 一號/);
    assert.match(text, /#2<\/b> Emby 二號/);
    await run(serverButton(cat, 2), ctx);
    await run(B.serversDone, ctx);
    assert.match(ctx.telegram.last().text, /邀請已建立/);
    assert.deepEqual(wizarr.created[0]?.serverIds, [2]);
  });

  it("快速邀請可複選多台 Emby", async () => {
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Emby 一號", "emby"), server(2, "Emby 二號", "emby")];
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.quickInvite, ctx);
    await run(serverButton(cat, 1), ctx);
    await run(serverButton(cat, 2), ctx);
    await run(B.serversDone, ctx);
    assert.match(ctx.telegram.last().text, /邀請已建立/);
    assert.deepEqual(wizarr.created[0]?.serverIds, [1, 2]);
  });

  it("多台 Emby 時設定預設媒體庫會列出名稱對照", async () => {
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Emby 一號", "emby"), server(2, "Emby 二號", "emby")];
      },
      async listLibraries() {
        return quickLibraryFixtures();
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.settings, ctx);
    await run(B.setLibraries, ctx);
    const text = ctx.telegram.last().text;
    assert.match(text, /選擇要設定預設媒體庫的 Emby 伺服器/);
    assert.match(text, /#1<\/b> Emby 一號/);
    assert.match(text, /#2<\/b> Emby 二號/);
    await run(serverButton(cat, 1), ctx);
    assert.match(ctx.telegram.last().text, /選擇媒體庫/);
  });

  it("列出邀請時會送出每一組網址的 QR code", async () => {
    const ctx = { wizarr: fakeWizarr(), telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.listInvites, ctx);
    assert.match(ctx.telegram.last().text, /ABCD/);
    assert.equal(ctx.telegram.photos.length, 1);
    assert.match(ctx.telegram.photos[0]?.caption ?? "", /ABCD/);
    assert.match(ctx.telegram.photos[0]?.caption ?? "", /https:\/\/wizarr\.example\/j\/ABCD/);
    assert.equal(ctx.telegram.photos[0]?.image[0], 0x89);
  });

  it("刪除邀請前會確認", async () => {
    let deleted = 0;
    const wizarr = fakeWizarr({
      async deleteInvitation() {
        deleted += 1;
        return "invite deleted";
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.deleteInvite, ctx);
    await run(deleteInviteButton(cat, 8), ctx);
    assert.equal(deleted, 0);
    await run(B.confirm, ctx);
    assert.equal(deleted, 1);
    assert.match(ctx.telegram.last().text, /invite deleted/);
    assert.equal(ctx.telegram.photos.length, 0);
  });

  it("Wizarr 失敗時保留可讀錯誤", async () => {
    const wizarr = fakeWizarr({
      async getStatus() {
        throw new WizarrError("Unauthorized", 401);
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.status, ctx);
    assert.match(ctx.telegram.last().text, /Unauthorized/);
  });
});
