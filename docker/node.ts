import http from "node:http";

import { createApp } from "../src/app.ts";
import { ConfigError, loadConfig } from "../src/config.ts";
import { routeRequest } from "../src/http.ts";
import { MemorySessionStore } from "../src/session.ts";

const config = loadConfigOrExit();
const app = createApp(config, new MemorySessionStore());
let stopping = false;
const pollAbort = new AbortController();

const server = http.createServer((req, res) => {
  void serve(req, res);
});

server.listen(config.port, () => {
  const origin = safeOrigin(config.wizarrPublicUrl);
  console.log(`[bot] mode=${config.mode} port=${config.port} wizarr=${origin} admins=${config.adminIds.size}`);
  if (config.adminIds.size === 0) {
    console.warn("[bot] TELEGRAM_ADMIN_IDS 是空的，機器人只會回覆 Telegram ID");
  }
});

if (config.mode === "polling") {
  void poll();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function serve(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const request = await toRequest(req);
    const response = await routeRequest(request, app);
    const headers = Object.fromEntries(response.headers.entries());
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("[bot] HTTP 失敗", error instanceof Error ? error.message : error);
    if (!res.headersSent) res.writeHead(500);
    res.end("error");
  }
}

async function toRequest(req: http.IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? `127.0.0.1:${config.port}`;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("payload too large");
    chunks.push(buffer);
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://${host}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: body ? new Uint8Array(body) : undefined,
  });
}

async function poll(): Promise<void> {
  try {
    await app.telegram.deleteWebhook();
  } catch (error) {
    console.error("[bot] 清除 webhook 失敗", error instanceof Error ? error.message : error);
  }

  let offset = 0;
  while (!stopping) {
    try {
      const updates = await app.telegram.getUpdates(offset, pollAbort.signal);
      for (const update of updates) {
        await app.handle(update);
        offset = update.update_id + 1;
      }
    } catch (error) {
      if (stopping || pollAbort.signal.aborted) break;
      console.error("[bot] polling 失敗", error instanceof Error ? error.message : error);
      await delay(3000);
    }
  }
}

function shutdown(): void {
  stopping = true;
  pollAbort.abort();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

function loadConfigOrExit() {
  try {
    return loadConfig(process.env);
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : error);
    process.exit(1);
  }
}

function safeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "invalid-url";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
