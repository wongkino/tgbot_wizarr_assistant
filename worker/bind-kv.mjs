import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const configPath = join(directory, "wrangler.jsonc");
const namespaceTitle = "tgbot-wizarr-assistant-SESSIONS";
const placeholderId = "0123456789abcdef0123456789abcdef";

const id = ensureNamespace();
const config = readFileSync(configPath, "utf8");
if (!config.includes(placeholderId)) {
  throw new Error("worker/wrangler.jsonc 裡找不到可替換的 KV id");
}
writeFileSync(configPath, config.replaceAll(placeholderId, id));
console.log(`已綁定 SESSIONS KV：${id}`);

function ensureNamespace() {
  const existing = listNamespaces().find((item) => item.title === namespaceTitle);
  if (existing?.id) return existing.id;

  wrangler(["kv", "namespace", "create", namespaceTitle]);
  const created = listNamespaces().find((item) => item.title === namespaceTitle);
  if (!created?.id) {
    throw new Error(`建立 KV namespace「${namespaceTitle}」後仍找不到 id`);
  }
  return created.id;
}

function listNamespaces() {
  const output = wrangler(["kv", "namespace", "list"]);
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start === -1 || end < start) {
    throw new Error(`無法解析 KV 清單：${output}`);
  }
  const parsed = JSON.parse(output.slice(start, end + 1));
  if (!Array.isArray(parsed)) {
    throw new Error("KV 清單不是陣列");
  }
  return parsed;
}

function wrangler(args) {
  const result = spawnSync("npx", ["wrangler", "--config", configPath, ...args], {
    cwd: directory,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${result.stdout ?? ""}${result.stderr ?? ""}`.trim() || `wrangler ${args.join(" ")} 失敗`);
  }
  return result.stdout ?? "";
}
