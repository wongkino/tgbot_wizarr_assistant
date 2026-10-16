import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const required = ["WIZARR_URL", "WIZARR_API_KEY"];
for (const name of required) {
  if (!process.env[name]?.trim()) {
    console.error(`缺少環境變數：${name}`);
    process.exit(1);
  }
}

const config = {
  adminIds: process.env.TELEGRAM_ADMIN_IDS?.trim() ?? "",
  wizarrUrl: process.env.WIZARR_URL.trim(),
  wizarrApiKey: process.env.WIZARR_API_KEY.trim(),
  wizarrPublicUrl: process.env.WIZARR_PUBLIC_URL?.trim() ?? "",
  timeZone: process.env.TIMEZONE?.trim() || "Asia/Hong_Kong",
};

const target = join(dirname(fileURLToPath(import.meta.url)), "..", "tgcloud", "lib", "config.js");
const body = `// 由 scripts/write-tg-config.mjs 產生。含 Wizarr API key，不要提交。
export const config = ${JSON.stringify(config, null, 2)};
`;
writeFileSync(target, body);
console.log(`已寫入 ${target}`);
