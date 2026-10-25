import { db } from "sdk";
import { eq } from "sdk/db";

import { records } from "../schema.js";

export function createKv() {
  return {
    async get(key) {
      const row = await db.select().from(records).where(eq(records.key, key)).get();
      if (!row) return null;
      if (row.expiresAt <= Date.now()) {
        await db.delete(records).where(eq(records.key, key)).run();
        return null;
      }
      return row.value;
    },
    async put(key, value, options) {
      const ttlSeconds = options?.expirationTtl ?? 60;
      const expiresAt = Date.now() + ttlSeconds * 1000;
      await db
        .insert(records)
        .values({ key, value, expiresAt })
        .onConflictDoUpdate({
          target: records.key,
          set: { value, expiresAt },
        })
        .run();
    },
    async delete(key) {
      await db.delete(records).where(eq(records.key, key)).run();
    },
  };
}
