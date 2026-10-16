import { api, fetch, InputFile } from "sdk";

import { handleServerlessMessage } from "../lib/bot.js";
import { config } from "../lib/config.js";
import { createKv } from "../lib/records.js";

export default async function (message) {
  await handleServerlessMessage(message, {
    config,
    kv: createKv(),
    fetchImpl: fetch,
    api,
    InputFile,
  });
}
