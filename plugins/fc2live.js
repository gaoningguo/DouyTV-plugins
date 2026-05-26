/**
 * FC2 Live 插件 —— 日本成人 BJ 平台
 * 列表: HTTP POST allchannellist.php
 * 拉流: 通过 ctx.invoke 调 Rust fc2_resolve_hls 命令 (WebSocket 握手)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://live.fc2.com/";
const LIST_URL = "https://live.fc2.com/adult/contents/allchannellist.php";
const HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Origin: "https://live.fc2.com",
  "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
  Accept: "application/json, text/plain, */*",
};
const SEX_LABEL = { w: "♀ Female", m: "♂ Male", c: "Couple", t: "Trans" };

let cachedList = null;
const TTL = 60_000;

export const manifest = {
  id: "fc2live",
  label: "FC2 Live (日本 BJ)",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

async function fetchAll(ctx) {
  if (cachedList && cachedList.expiry > Date.now()) return cachedList.data;
  const res = await ctx.fetch(LIST_URL, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body: "",
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error(`FC2 HTTP ${res.status}`);
  const data = await res.json();
  const channels = data.channel ?? [];
  cachedList = { data: channels, expiry: Date.now() + TTL };
  return channels;
}

function isOpen(c) { return !c.pay && !c.login; }

function mapRoom(c) {
  if (!c.id) return undefined;
  const cat = [
    c.sex ? SEX_LABEL[c.sex] || c.sex : null,
    c.pay ? "💰 付费房" : null,
    !c.pay && c.login ? "🔒 会员房" : null,
    isOpen(c) ? null : "⚠ 匿名无法播放",
  ].filter(Boolean).join(" · ");
  return {
    platform: "fc2live",
    roomId: c.id,
    title: c.title || c.name || c.id,
    uname: c.name || c.id,
    cover: c.image,
    online: c.count ?? 0,
    category: cat || undefined,
    live: true,
    link: `https://live.fc2.com/${c.id}/`,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const all = await fetchAll(ctx);
  const sorted = all.filter(isOpen).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  const start = (page - 1) * pageSize;
  const slice = sorted.slice(start, start + pageSize);
  return { list: slice.map(mapRoom).filter(Boolean), hasMore: start + pageSize < sorted.length };
}

export async function getCategories(ctx) {
  return [
    { id: "popular", name: "人气" },
    { id: "new", name: "新人" },
    { id: "female", name: "♀ Female" },
    { id: "male", name: "♂ Male" },
    { id: "couple", name: "Couple" },
    { id: "all", name: "全部 (含付费)" },
  ];
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const all = await fetchAll(ctx);
  const pool = categoryId === "all" ? all : all.filter(isOpen);
  let filtered;
  switch (categoryId) {
    case "new": filtered = [...pool].sort((a, b) => (b.start_time ?? 0) - (a.start_time ?? 0)); break;
    case "female": filtered = pool.filter((c) => c.sex === "w"); break;
    case "male": filtered = pool.filter((c) => c.sex === "m"); break;
    case "couple": filtered = pool.filter((c) => c.sex === "c"); break;
    default: filtered = [...pool].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  }
  const ps = 24;
  const start = (page - 1) * ps;
  const slice = filtered.slice(start, start + ps);
  return { list: slice.map(mapRoom).filter(Boolean), hasMore: start + ps < filtered.length };
}

export async function search(ctx, { keyword }) {
  if (!keyword.trim()) return { list: [], hasMore: false };
  const all = await fetchAll(ctx);
  const kw = keyword.toLowerCase();
  const hits = all.filter((c) =>
    (c.title ?? "").toLowerCase().includes(kw) ||
    (c.name ?? "").toLowerCase().includes(kw) ||
    (c.id ?? "").toLowerCase().includes(kw)
  );
  return { list: hits.map(mapRoom).filter(Boolean), hasMore: false };
}

export async function resolve(ctx, { roomId }) {
  if (cachedList?.expiry > Date.now()) {
    const ch = cachedList.data.find((c) => c.id === roomId);
    if (ch?.pay) throw new Error(`FC2 Live: 该房间是付费房,匿名无法播放`);
    if (ch?.login) throw new Error(`FC2 Live: 该房间限会员观看`);
  }
  const hlsUrl = await ctx.invoke("fc2_resolve_hls", { channelId: roomId, proxyUrl: null });
  return ctx.protocols.hlsStream({ url: hlsUrl, qnLabel: "原画", referer: REFERER, ua: UA });
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const all = await fetchAll(ctx);
    return all.some((c) => c.id === roomId);
  } catch { return false; }
}
