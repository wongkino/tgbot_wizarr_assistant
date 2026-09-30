import type { App } from "./app.ts";
import type { Update } from "./types.ts";

export async function routeRequest(request: Request, app: App): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return Response.json({ ok: true, mode: app.config.mode });
  }
  // 只在 webhook 模式接受更新；polling 模式下此端點沒有密鑰保護，必須關閉。
  if (app.config.mode === "webhook" && request.method === "POST" && (url.pathname === "/telegram" || url.pathname === "/")) {
    return handleWebhook(request, app);
  }
  return new Response("not found", { status: 404 });
}

export async function handleWebhook(request: Request, app: App): Promise<Response> {
  const secret = app.config.webhookSecret;
  if (secret) {
    const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (got !== secret) return new Response("unauthorized", { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!update || typeof update !== "object" || !("update_id" in update)) {
    return new Response("bad request", { status: 400 });
  }

  try {
    await app.handle(update as Update);
  } catch (error) {
    console.error("[bot] 處理更新失敗", error instanceof Error ? error.message : error);
    return new Response("error", { status: 500 });
  }
  return new Response("ok");
}
