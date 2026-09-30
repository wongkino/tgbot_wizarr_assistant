import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createWizarrClient, extractError, invitationBody, WizarrError } from "./wizarr.ts";

describe("invitationBody", () => {
  it("不過期且使用全部媒體庫時省略對應欄位", () => {
    assert.deepEqual(
      invitationBody({
        serverIds: [1],
        expiresInDays: null,
        duration: "unlimited",
        unlimited: true,
        libraryIds: [],
        allowDownloads: false,
        allowLiveTv: true,
        allowMobileUploads: false,
      }),
      {
        server_ids: [1],
        duration: "unlimited",
        unlimited: true,
        allow_downloads: false,
        allow_live_tv: true,
        allow_mobile_uploads: false,
      },
    );
  });
});

describe("createWizarrClient", () => {
  it("帶 API key 建立邀請，並把相對連結補成公開網址", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createWizarrClient({
      apiBase: "https://wizarr.example/api/",
      apiKey: "secret-key",
      publicBase: "https://invite.example",
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });
        return new Response(
          JSON.stringify({
            message: "ok",
            invitation: {
              id: 9,
              code: "ABCD",
              url: "/j/ABCD",
              status: "pending",
              unlimited: true,
              specific_libraries: [3, 12],
            },
          }),
          { status: 201 },
        );
      },
    });

    const invitation = await client.createInvitation({
      serverIds: [2],
      expiresInDays: 7,
      duration: "30",
      unlimited: false,
      libraryIds: [3],
      allowDownloads: true,
      allowLiveTv: false,
      allowMobileUploads: false,
    });

    assert.equal(invitation.url, "https://invite.example/j/ABCD");
    assert.equal(invitation.unlimited, true);
    assert.deepEqual(invitation.libraryIds, [3, 12]);
    assert.equal(calls[0]?.url, "https://wizarr.example/api/invitations");
    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("X-API-Key"), "secret-key");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
      server_ids: [2],
      expires_in_days: 7,
      duration: "30",
      unlimited: false,
      library_ids: [3],
      allow_downloads: true,
      allow_live_tv: false,
      allow_mobile_uploads: false,
    });
  });

  it("帳號是否無限制以 unlimited 欄位為準", async () => {
    const client = createWizarrClient({
      apiBase: "https://wizarr.example/api",
      apiKey: "k",
      publicBase: "https://wizarr.example",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            invitation: { id: 1, code: "LIMIT", url: "/j/LIMIT", unlimited: false, duration: "unlimited" },
          }),
          { status: 201 },
        ),
    });
    const invitation = await client.createInvitation({
      serverIds: [1],
      expiresInDays: 7,
      duration: "30",
      unlimited: false,
      libraryIds: [],
      allowDownloads: false,
      allowLiveTv: false,
      allowMobileUploads: false,
    });
    assert.equal(invitation.unlimited, false);
  });

  it("把 Wizarr 錯誤訊息傳回", async () => {
    const client = createWizarrClient({
      apiBase: "https://wizarr.example/api",
      apiKey: "k",
      publicBase: "https://wizarr.example",
      fetchImpl: async () => new Response(JSON.stringify({ message: "Server IDs [9] not found" }), { status: 400 }),
    });
    await assert.rejects(() => client.listServers(), (error: unknown) => {
      assert.ok(error instanceof WizarrError);
      assert.equal(error.message, "Server IDs [9] not found");
      assert.equal(error.status, 400);
      return true;
    });
  });
});

describe("extractError", () => {
  it("讀取巢狀錯誤", () => {
    assert.equal(extractError({ message: { error: "Unauthorized" } }), "Unauthorized");
  });
});
