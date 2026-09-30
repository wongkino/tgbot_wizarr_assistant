import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleUpdate } from "./handler.ts";
import { B, deleteInviteButton, libraryButton, serverButton, userButton } from "./keyboard.ts";
import { MemorySessionStore } from "./session.ts";
import type {
  AppConfig,
  CreateInvitationInput,
  ReplyMarkup,
  Update,
  UserInfo,
  WizarrApi,
} from "./types.ts";
import { WizarrError } from "./wizarr.ts";

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

  async sendMessage(_chatId: number, text: string, markup?: ReplyMarkup): Promise<void> {
    this.messages.push({ text, markup });
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
    await handleUpdate(message("/start", 99), {
      config,
      wizarr: fakeWizarr({
        async getStatus() {
          called = true;
          return { users: 0, invites: 0, pending: 0, expired: 0 };
        },
      }),
      telegram,
      sessions: new MemorySessionStore(),
    });
    assert.equal(called, false);
    assert.match(telegram.last().text, /99/);
    assert.match(telegram.last().text, /未獲授權/);
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
    await run(userButton(12), ctx);
    assert.match(ctx.telegram.last().text, /改為刪除/);
    assert.deepEqual(wizarr.disabled, []);
    await run(B.cancel, ctx);
    assert.deepEqual(wizarr.disabled, []);
    await run(B.disableUser, ctx);
    await run(userButton(12), ctx);
    await run(B.confirm, ctx);
    assert.deepEqual(wizarr.disabled, [12]);
  });

  it("快速邀請只用 Emby，並只保留已勾選的媒體庫", async () => {
    const wizarr = fakeWizarr({
      async listServers() {
        return [server(1, "Emby", "emby"), server(2, "Plex", "plex")];
      },
      async listLibraries() {
        return [
          library(3, "電影", "4"),
          library(8, "收藏集", "4746"),
          library(9, "JAV", "620168"),
          library(10, "選輯", "4756"),
          library(11, "泡麵番", "190001"),
          library(12, "動畫-已完結", "611380"),
        ];
      },
    });
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.quickInvite, ctx);
    assert.equal(ctx.telegram.buttons().includes(serverButton(2)), false);
    assert.equal(ctx.telegram.buttons().includes(B.allLibraries), false);
    assert.ok(ctx.telegram.buttons().includes(libraryButton(3, true)));
    assert.ok(ctx.telegram.buttons().includes(libraryButton(12, true)));
    assert.ok(ctx.telegram.buttons().includes(libraryButton(9, false)));
    assert.ok(ctx.telegram.buttons().includes(libraryButton(11, false)));
    assert.equal(ctx.telegram.buttons().includes(libraryButton(8, false)), false);
    assert.match(ctx.telegram.last().text, /電影/);
    assert.doesNotMatch(ctx.telegram.last().text, /收藏集/);
    await run(B.librariesDone, ctx);
    assert.match(ctx.telegram.last().text, /媒體庫：電影、動畫-已完結/);
    assert.doesNotMatch(ctx.telegram.last().text, /媒體庫：.*JAV/);
    assert.equal(wizarr.created.length, 0);
    await run(B.confirm, ctx);
    assert.deepEqual(wizarr.created, [
      {
        serverIds: [1],
        expiresInDays: 7,
        duration: "unlimited",
        unlimited: true,
        libraryIds: [3, 12],
        allowDownloads: false,
        allowLiveTv: false,
        allowMobileUploads: false,
      },
    ]);
  });

  it("沒有 Emby 時不會建立快速邀請", async () => {
    const wizarr = fakeWizarr();
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.quickInvite, ctx);
    assert.match(ctx.telegram.last().text, /沒有已驗證的 Emby/);
    assert.equal(wizarr.created.length, 0);
  });

  it("可逐步建立邀請並限制媒體庫", async () => {
    const wizarr = fakeWizarr();
    const ctx = { wizarr, telegram: new Recorder(), sessions: new MemorySessionStore() };
    await run(B.createInvite, ctx);
    await run(serverButton(1), ctx);
    await run(B.expiry7, ctx);
    await run(B.durUnlimited, ctx);
    await run(B.pickLibraries, ctx);
    await run(libraryButton(3, false), ctx);
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
    await run(deleteInviteButton(8), ctx);
    assert.equal(deleted, 0);
    await run(B.confirm, ctx);
    assert.equal(deleted, 1);
    assert.match(ctx.telegram.last().text, /invite deleted/);
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
