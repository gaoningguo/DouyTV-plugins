/**
 * MyFreeCams 直播插件 —— WebSocket 信令通过 Rust 命令实现
 * 列表 + resolve 都走 ctx.invoke("mfc_list_online")
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.myfreecams.com/";

let listingCache = null;
const TTL = 5 * 60 * 1000;

export const manifest = {
  id: "myfreecams",
  label: "MyFreeCams",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

async function fetchListing(ctx) {
  const now = Date.now();
  if (listingCache && now - listingCache.at < TTL) return listingCache.items;
  const items = await ctx.invoke("mfc_list_online", { proxyUrl: null });
  if (items.length > 0) listingCache = { items, at: now };
  return items;
}

function toRoom(m) {
  return {
    platform: "myfreecams",
    roomId: m.nm,
    title: m.topic || m.nm,
    uname: m.nm,
    online: m.rc ?? 0,
    category: m.country,
    cover: m.thumb_url,
    live: m.vs === 0,
    link: `https://www.myfreecams.com/#${encodeURIComponent(m.nm)}`,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const all = await fetchListing(ctx);
  const start = (page - 1) * pageSize;
  return { list: all.slice(start, start + pageSize).map(toRoom), hasMore: start + pageSize < all.length };
}

export async function search(ctx, { keyword }) {
  const all = await fetchListing(ctx);
  const kw = keyword.trim().toLowerCase();
  if (!kw) return { list: [], hasMore: false };
  return { list: all.filter((m) => m.nm.toLowerCase().includes(kw) || (m.topic ?? "").toLowerCase().includes(kw)).map(toRoom), hasMore: false };
}

export async function resolve(ctx, { roomId }) {
  const cached = listingCache?.items.find((m) => m.nm.toLowerCase() === roomId.toLowerCase());
  if (cached?.hls_url) return ctx.protocols.hlsStream({ url: cached.hls_url, referer: REFERER, ua: UA });
  const items = await fetchListing(ctx);
  const hit = items.find((m) => m.nm.toLowerCase() === roomId.toLowerCase());
  if (hit?.hls_url) return ctx.protocols.hlsStream({ url: hit.hls_url, referer: REFERER, ua: UA });
  if (hit) throw new Error(`MyFreeCams ${roomId} 非公开聊天`);
  throw new Error(`MyFreeCams ${roomId} 不在 listing 中`);
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const items = await fetchListing(ctx);
    const hit = items.find((m) => m.nm.toLowerCase() === roomId.toLowerCase());
    return !!hit && hit.vs === 0;
  } catch { return false; }
}
