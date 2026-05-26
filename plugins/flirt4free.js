/**
 * Flirt4Free (flirt4free.com) 直播插件 —— 美国老牌成人 cam
 * 协议: HLS (vscdns.com)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.flirt4free.com/";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" };

const modelIdCache = new Map();
let homepageCache = null;
const HOMEPAGE_TTL = 60_000;

export const manifest = {
  id: "flirt4free",
  label: "Flirt4Free",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function parseModels(html) {
  const needle = "window.__homePageData__ = ";
  const start = html.indexOf(needle);
  if (start === -1) return [];
  const after = html.slice(start + needle.length);
  const arrStart = after.indexOf("[");
  if (arrStart === -1) return [];
  const arrEnd = after.indexOf("],\n", arrStart);
  if (arrEnd === -1) return [];
  const slice = after.slice(arrStart, arrEnd + 1).replace(/,\s*]\s*$/, "]");
  try { return JSON.parse(slice); } catch { return []; }
}

function thumb(m) {
  if (!m.sample_long_id) return undefined;
  return `https://cdn5.vscdns.com/images/models/webp/s/640x480/imgid/${m.sample_long_id}.webp`;
}

function mapRoom(m) {
  const slug = m.model_seo_name;
  if (!slug) return undefined;
  if (m.model_id) modelIdCache.set(slug, m.model_id);
  return {
    platform: "flirt4free",
    roomId: slug,
    title: m.display || m.model_name || slug,
    uname: m.display || m.model_name || slug,
    cover: thumb(m),
    online: 0,
    category: m.category_name,
    live: m.room_status_char === "O",
    link: `https://www.flirt4free.com/?model=${encodeURIComponent(slug)}`,
  };
}

async function fetchHomepage(ctx) {
  const now = Date.now();
  if (homepageCache && now - homepageCache.ts < HOMEPAGE_TTL) return homepageCache.models;
  const res = await ctx.fetch("https://www.flirt4free.com/", { headers: HEADERS, timeout: 30000, http2: true });
  if (!res.ok) throw new Error(`Flirt4Free HTTP ${res.status}`);
  const html = await res.text();
  const arr = parseModels(html);
  homepageCache = { models: arr, ts: now };
  return arr;
}

export async function getRecommend(ctx, { page, pageSize }) {
  const arr = await fetchHomepage(ctx);
  const mapped = arr.map(mapRoom).filter(Boolean);
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize;
  return { list: mapped.slice(from, to), hasMore: to < mapped.length };
}

export async function search(ctx, { keyword, page }) {
  const arr = await fetchHomepage(ctx);
  const kw = keyword.toLowerCase();
  const matched = arr.filter((m) =>
    (m.model_seo_name ?? "").toLowerCase().includes(kw) ||
    (m.display ?? "").toLowerCase().includes(kw) ||
    (m.model_name ?? "").toLowerCase().includes(kw) ||
    (m.category_name ?? "").toLowerCase().includes(kw)
  ).map(mapRoom).filter(Boolean);
  const ps = 30;
  const from = Math.max(0, (page - 1) * ps);
  return { list: matched.slice(from, from + ps), hasMore: from + ps < matched.length };
}

async function resolveModelId(ctx, slug) {
  const cached = modelIdCache.get(slug);
  if (cached) return cached;
  try {
    const res = await ctx.fetch(`https://ws.vs3.com/rooms/check-model-status.php?model_name=${encodeURIComponent(slug)}`, {
      headers: { ...HEADERS, Accept: "application/json, text/plain, */*" },
      timeout: 10000,
      http2: true,
    });
    if (res.ok) {
      const j = await res.json();
      if (j.model_id) {
        const id = String(j.model_id);
        modelIdCache.set(slug, id);
        return id;
      }
    }
  } catch {}
  const arr = await fetchHomepage(ctx);
  for (const m of arr) {
    if (m.model_seo_name === slug && m.model_id) {
      modelIdCache.set(slug, m.model_id);
      return m.model_id;
    }
  }
  return null;
}

export async function resolve(ctx, { roomId }) {
  const modelId = await resolveModelId(ctx, roomId);
  if (!modelId) throw new Error(`Flirt4Free 未找到主播 ${roomId}`);
  const res = await ctx.fetch(`https://www.flirt4free.com/ws/chat/get-stream-urls.php?model_id=${modelId}`, {
    headers: { ...HEADERS, Accept: "application/json, text/plain, */*", Referer: `https://www.flirt4free.com/?model=${encodeURIComponent(roomId)}` },
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error(`Flirt4Free stream HTTP ${res.status}`);
  const data = await res.json();
  if (data.code === 44) throw new Error(`Flirt4Free 主播 ${roomId} 不存在`);
  if (data.code !== 0) throw new Error(`Flirt4Free 拉流失败 code=${data.code}`);
  const hls = data.data?.hls?.[0]?.url;
  if (!hls) throw new Error("Flirt4Free 无 HLS 流");
  const fullUrl = hls.startsWith("//") ? `https:${hls}` : hls;
  return ctx.protocols.hlsStream({ url: fullUrl, qnLabel: "自适应", referer: REFERER, ua: UA });
}
