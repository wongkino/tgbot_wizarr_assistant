import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApp } from "./app.ts";
import { handleWebhook } from "./http.ts";
import { MemorySessionStore } from "./session.ts";
import type { AppConfig } from "./types.ts";

const config: AppConfig = {
  telegramToken: "token",
  webhookSecret: "top-secret",
  adminIds: new Set([7]),
  wizarrApiBase: "https://wizarr.example/api",
  wizarrApiKey: "key",
  wizarrPublicUrl: "https://wizarr.example",
  mode: "webhook",
  port: 8080,
};

describe("webhook", () => {
  const app = createApp(config, new MemorySessionStore(), async (input) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org/")) {
      return new Response(JSON.stringify({ ok: true, result: {} }));
    }
    throw new Error(`不應連到 ${url}`);
  });

  it("密鑰不符時拒絕", async () => {
    const response = await handleWebhook(
      new Request("http://local/telegram", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "nope" },
        body: "{}",
      }),
      app,
    );
    assert.equal(response.status, 401);
  });

  it("接受已授權的私訊更新", async () => {
    const response = await handleWebhook(
      new Request("http://local/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "top-secret" },
        body: JSON.stringify({
          update_id: 1,
          message: { message_id: 1, text: "/start", chat: { id: 7, type: "private" }, from: { id: 7 } },
        }),
      }),
      app,
    );
    assert.equal(response.status, 200);
  });

  it("回覆失敗時仍回應 200，避免 Telegram 重送同一則更新", async () => {
    const failing = createApp(config, new MemorySessionStore(), async () => Response.json({ ok: false, description: "boom" }));
    const response = await handleWebhook(
      new Request("http://local/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "top-secret" },
        body: JSON.stringify({
          update_id: 2,
          message: { message_id: 2, text: "/start", chat: { id: 7, type: "private" }, from: { id: 7 } },
        }),
      }),
      failing,
    );
    assert.equal(response.status, 200);
  });
});
