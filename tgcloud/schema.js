import { integer, table, text } from "sdk/db";

/** 對話畫面、語言與快速邀請代碼。到期由讀取時檢查，平台不會自動刪列。 */
export const records = table("records", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
