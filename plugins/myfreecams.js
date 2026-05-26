/**
 * MyFreeCams (myfreecams.com, MFC) plugin —— WebSocket 流推送架构。
 *
 * 列表 + resolve 都走 ctx.invoke("mfc_list_online")，由 Rust 端 WS 握手实现。
 */

export const manifest = {
  id: "myfreecams",
  label: "MyFreeCams",
  version: "1.0.0",
  adult: true,
  engine: { netliveApi: 1 },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.myfreecams.com/";

let listingCache = null;
const LISTING_TTL_MS = 5 * 60 * 1000;

async function fetchListing(ctx) {
  const now = Date.now();
  if (listingCache && now - listingCache.at < LISTING_TTL_MS) {
    return listingCache.items;
  }
  const proxyUrl = null;
  try {
    const items = await ctx.invoke("mfc_list_online", { proxyUrl });
    if (items.length === 0) {
      try {
        const report = await ctx.invoke("mfc_diagnose", { proxyUrl });
        console.warn("[mfc diagnose report]\n" + report);
      } catch (de) {
        console.error("[mfc] diagnose itself failed:", de);
      }
    } else {
      listingCache = { items, at: now };
    }
    return items;
  } catch (e) {
    console.error("[mfc] mfc_list_online invoke failed:", e);
    throw e;
  }
}

function listItemToRoom(m) {
  return {
    platform: "myfreecams",
    roomId: m.nm,
    title: m.topic || m.nm,
    uname: m.nm,
    online: m.rc ?? 0,
    category: m.country,
    cover: m.thumb_url,
    live: m.vs === 0,
    link: "https://www.myfreecams.com/#" + encodeURIComponent(m.nm),
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const all = await fetchListing(ctx);
  const p = Math.max(1, page);
  const ps = Math.max(1, pageSize);
  const start = (p - 1) * ps;
  const slice = all.slice(start, start + ps);
  return {
    list: slice.map(listItemToRoom),
    hasMore: start + ps < all.length,
  };
}

export async function search(ctx, { keyword, page }) {
  const all = await fetchListing(ctx);
  const kw = keyword.trim().toLowerCase();
  if (!kw) return { list: [], hasMore: false };
  const filtered = all.filter(
    (m) =>
      m.nm.toLowerCase().includes(kw) ||
      (m.topic ?? "").toLowerCase().includes(kw),
  );
  return { list: filtered.map(listItemToRoom), hasMore: false };
}

export async function resolve(ctx, { roomId }) {
  const cache = listingCache?.items.find(
    (m) => m.nm.toLowerCase() === roomId.toLowerCase(),
  );
  if (cache?.hls_url) {
    return ctx.protocols.hlsStream({
      url: cache.hls_url,
      qn: "auto",
      qnLabel: "自适应",
      referer: REFERER,
      ua: UA,
    });
  }
  if (!cache) {
    const items = await fetchListing(ctx);
    const hit = items.find(
      (m) => m.nm.toLowerCase() === roomId.toLowerCase(),
    );
    if (hit?.hls_url) {
      return ctx.protocols.hlsStream({
        url: hit.hls_url,
        qn: "auto",
        qnLabel: "自适应",
        referer: REFERER,
        ua: UA,
      });
    }
    if (hit) throw new Error("MyFreeCams 主播 " + roomId + " 未在公开列表（可能私聊/离线）");
    throw new Error("MyFreeCams 主播 " + roomId + " 当前 listing 中不存在");
  }
  throw new Error("MyFreeCams 主播 " + roomId + " 当前不在线或非公开聊天");
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const items = await fetchListing(ctx);
    const hit = items.find(
      (m) => m.nm.toLowerCase() === roomId.toLowerCase(),
    );
    return !!hit && hit.vs === 0;
  } catch {
    return false;
  }
}
