import { readFileSync } from "node:fs";

import { build } from "esbuild";

await build({
  entryPoints: ["src/serverless.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile: "tgcloud/lib/bot.js",
  legalComments: "eof",
});

const source = readFileSync("tgcloud/lib/bot.js", "utf8");
const specifiers = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
const unexpected = specifiers.filter((item) => item !== "sdk" && !item.startsWith("sdk/"));
if (unexpected.length > 0 || source.includes("require(") || source.includes("node:") || source.includes("process.")) {
  const detail = unexpected.length > 0 ? unexpected.join(", ") : "node API 或 require";
  console.error(`打包結果含平台無法載入的模組：${detail}`);
  process.exit(1);
}
if (!source.includes("handleServerlessMessage")) {
  console.error("打包結果沒有匯出 handleServerlessMessage");
  process.exit(1);
}
