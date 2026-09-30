import { markup } from "./keyboard.ts";
import type { ReplyMarkup, SessionStore } from "./types.ts";
import type { Catalog } from "./i18n/catalog.ts";
import { catalog as en } from "./i18n/en.ts";
import { catalog as ja } from "./i18n/ja.ts";
import { catalog as zhCN } from "./i18n/zh-CN.ts";
import { catalog as zhTW } from "./i18n/zh-TW.ts";

export type { Catalog } from "./i18n/catalog.ts";

export const LANGS = ["en", "zh-TW", "zh-CN", "ja"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";

const CATALOGS: Record<Lang, Catalog> = {
  en,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  ja,
};

/** 語言選擇按鈕上的標籤，固定用各語言自己的寫法。 */
export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  "zh-TW": "繁體中文",
  "zh-CN": "简体中文",
  ja: "日本語",
};

export function catalogFor(lang: Lang): Catalog {
  return CATALOGS[lang];
}

export function parseLang(value: string | null): Lang | null {
  return LANGS.includes(value as Lang) ? (value as Lang) : null;
}

export function langFromButton(text: string): Lang | null {
  for (const lang of LANGS) {
    if (LANG_LABELS[lang] === text) return lang;
  }
  return null;
}

const LANG_TTL_SECONDS = 365 * 24 * 60 * 60;

function langKey(userId: number): string {
  return `lang:${userId}`;
}

/** 讀取使用者選過的語言；從未選過回傳 null。 */
export async function loadLang(store: SessionStore, userId: number): Promise<Lang | null> {
  return parseLang(await store.getText(langKey(userId)));
}

export async function saveLang(store: SessionStore, userId: number, lang: Lang): Promise<void> {
  await store.setText(langKey(userId), lang, LANG_TTL_SECONDS);
}

export function languageKeyboard(): ReplyMarkup {
  return markup(
    [
      [LANG_LABELS.en, LANG_LABELS["zh-TW"]],
      [LANG_LABELS["zh-CN"], LANG_LABELS.ja],
    ],
    "Language / 語言",
  );
}

/** 初次使用的語言選擇提示，固定四語並列。 */
export function languagePrompt(): string {
  return [
    "Please choose your language.",
    "請選擇你的語言。",
    "请选择你的语言。",
    "言語を選択してください。",
  ].join("\n");
}
