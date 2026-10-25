import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { KvLike } from "./session.ts";
import { createSdkTelegram, handleServerlessMessage, type ServerlessBotApi, type ServerlessInputFile } from "./serverless.ts";
import type { TelegramMessage } from "./types.ts";

const config = {
  adminIds: "7",
  wizarrUrl: "https://wizarr.example",
  wizarrApiKey: "key",
  wizarrPublicUrl: "https://wizarr.example",
};

function message(text: string, userId = 7): TelegramMessage {
  return {
    message_id: 1,
    text,
    chat: { id: userId, type: "private" },
    from: { id: userId },
  };
}

function memoryKv(): KvLike {
  const rows = new Map<string, string>();
  return {
    async get(key) {
      return rows.get(key) ?? null;
    },
    async put(key, value) {
      rows.set(key, value);
    },
    async delete(key) {
      rows.delete(key);
    },
  };
}

class InputFile {
  bytes: Uint8Array;
  name: string;
  options?: { type?: string };

  constructor(bytes: Uint8Array, name: string, options?: { type?: string }) {
    this.bytes = bytes;
    this.name = name;
    this.options = options;
  }
}

describe("createSdkTelegram", () => {
  it("回覆鍵盤只加在最後一塊，圖片用 InputFile 上傳", async () => {
    const sent: Record<string, unknown>[] = [];
    const photos: Record<string, unknown>[] = [];
    const api: ServerlessBotApi = {
      async sendMessage(params) {
        sent.push(params);
      },
      async sendPhoto(params) {
        photos.push(params);
      },
    };
    const telegram = createSdkTelegram(api, InputFile as ServerlessInputFile);
    const markup = { keyboard: [[{ text: "狀態" }]], resize_keyboard: true as const, is_persistent: true as const };
    await telegram.sendMessage(7, `${"a".repeat(4000)}\n<b>end</b>`, markup);
    assert.equal(sent.length, 2);
    assert.equal("reply_markup" in (sent[0] ?? {}), false);
    assert.deepEqual(sent[1]?.reply_markup, markup);
    assert.equal(sent[1]?.parse_mode, "HTML");

    await telegram.sendPhoto(7, Uint8Array.from([1, 2, 3]), "代碼：<code>ABCD</code>");
    const photo = photos[0]?.photo;
    assert.ok(photo instanceof InputFile);
    assert.equal(photo.name, "invite-qr.png");
    assert.equal(photo.options?.type, "image/png");
    assert.equal(photos[0]?.parse_mode, "HTML");
    assert.match(String(photos[0]?.caption), /ABCD/);
  });
});

describe("handleServerlessMessage", () => {
  it("第一次私訊要求選擇語言，而且不會呼叫 Wizarr", async () => {
    const sent: Record<string, unknown>[] = [];
    const api: ServerlessBotApi = {
      async sendMessage(params) {
        sent.push(params);
      },
      async sendPhoto() {},
    };
    const fetchImpl: typeof fetch = async () => {
      throw new Error("不應呼叫 Wizarr");
    };
    await handleServerlessMessage(message("/start"), {
      config,
      kv: memoryKv(),
      fetchImpl,
      api,
      InputFile: InputFile as ServerlessInputFile,
    });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.chat_id, 7);
    assert.match(String(sent[0]?.text), /Please choose your language/);
    const markup = sent[0]?.reply_markup as { keyboard?: { text: string }[][] };
    assert.ok(markup.keyboard?.some((row) => row.some((button) => button.text === "繁體中文")));
  });

  it("設定無效時回覆原因，不丟出例外", async () => {
    const sent: Record<string, unknown>[] = [];
    await handleServerlessMessage(message("/start"), {
      config: { wizarrUrl: "not-a-url", wizarrApiKey: "key" },
      kv: memoryKv(),
      fetchImpl: fetch,
      api: {
        async sendMessage(params) {
          sent.push(params);
        },
        async sendPhoto() {},
      },
      InputFile: InputFile as ServerlessInputFile,
    });
    assert.equal(sent.length, 1);
    assert.match(String(sent[0]?.text), /WIZARR_URL/);
  });
});
