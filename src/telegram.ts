const MESSAGE_LIMIT = 3900;

export function splitText(text: string): string[] {
  if (text.length <= MESSAGE_LIMIT) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > MESSAGE_LIMIT) {
    const slice = rest.slice(0, MESSAGE_LIMIT);
    const breakAt = slice.lastIndexOf("\n");
    let cut = breakAt > 200 ? breakAt : MESSAGE_LIMIT;
    // 避免切在 <...> 標籤中間：切點落在標籤內時退到標籤之前。
    const head = rest.slice(0, cut);
    const tagStart = head.lastIndexOf("<");
    if (tagStart > head.lastIndexOf(">") && tagStart > 0) cut = tagStart;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest) chunks.push(rest);
  return rebalanceHtmlTags(chunks);
}

const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;

/**
 * 訊息以 parse_mode=HTML 送出，切塊若把成對標籤（如 <b>…</b>）拆到不同塊，
 * Telegram 會拒絕解析。這裡在每塊結尾補上未關閉標籤的結尾、下一塊開頭補上開頭。
 */
function rebalanceHtmlTags(chunks: string[]): string[] {
  if (chunks.length < 2) return chunks;
  const stack: { name: string; open: string }[] = [];
  const result: string[] = [];
  for (const [index, raw] of chunks.entries()) {
    let chunk = index > 0 && stack.length ? stack.map((tag) => tag.open).join("") + raw : raw;
    for (const match of raw.matchAll(HTML_TAG)) {
      const text = match[0];
      const name = (/^<\/?([a-zA-Z]+)/.exec(text)?.[1] ?? "").toLowerCase();
      if (!name || name === "br") continue;
      if (text.startsWith("</")) {
        const at = stack.map((tag) => tag.name).lastIndexOf(name);
        if (at >= 0) stack.splice(at);
      } else if (!text.endsWith("/>")) {
        stack.push({ name, open: text });
      }
    }
    if (index < chunks.length - 1 && stack.length) {
      chunk += [...stack].reverse().map((tag) => `</${tag.name}>`).join("");
    }
    result.push(chunk);
  }
  return result;
}
