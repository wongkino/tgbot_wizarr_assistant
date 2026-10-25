import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  catalogFor,
  DEFAULT_LANG,
  LANG_LABELS,
  LANGS,
  langFromButton,
  loadLang,
  parseLang,
  saveLang,
} from "./i18n.ts";
import { MemorySessionStore } from "./session.ts";

describe("多語言", () => {
  it("預設語言是英文，四種語言都有目錄", () => {
    assert.equal(DEFAULT_LANG, "en");
    assert.deepEqual([...LANGS].sort(), ["en", "ja", "zh-CN", "zh-TW"]);
    for (const lang of LANGS) {
      assert.ok(catalogFor(lang).buttons.quickInvite);
    }
  });

  it("每個目錄的按鈕都填滿且結構一致", () => {
    const reference = Object.keys(catalogFor("en").buttons).sort();
    for (const lang of LANGS) {
      const buttons = catalogFor(lang).buttons;
      assert.deepEqual(Object.keys(buttons).sort(), reference, lang);
      for (const [key, label] of Object.entries(buttons)) {
        assert.ok(label.trim(), `${lang}.${key} 是空的`);
      }
    }
  });

  it("語言按鈕標籤可解析回語言", () => {
    for (const lang of LANGS) {
      assert.equal(langFromButton(LANG_LABELS[lang]), lang);
    }
    assert.equal(langFromButton("Français"), null);
    assert.equal(new Set(Object.values(LANG_LABELS)).size, LANGS.length);
  });

  it("parseLang 只接受已知語言", () => {
    assert.equal(parseLang("zh-TW"), "zh-TW");
    assert.equal(parseLang("fr"), null);
    assert.equal(parseLang(null), null);
  });

  it("語言偏好可保存並讀回", async () => {
    const store = new MemorySessionStore();
    assert.equal(await loadLang(store, 7), null);
    await saveLang(store, 7, "ja");
    assert.equal(await loadLang(store, 7), "ja");
    await store.setText("lang:8", "fr", 60);
    assert.equal(await loadLang(store, 8), null);
  });
});
