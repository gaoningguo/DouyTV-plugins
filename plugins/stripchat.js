/**
 * Stripchat 插件 —— 18+ 成人内容平台
 * 协议: HLS (Mouflon 加扰需在主应用配 pkey/pdkey,见设置 → Stripchat 解扰密钥)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://stripchat.com/";
const API = "https://stripchat.com/api/front/v2/models";
const HEADERS = { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Referer: REFERER };
const THUMB = "https://img.doppiocdn.org/thumbs";

export const manifest = {
  id: "stripchat",
  label: "Stripchat",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function buildCover(streamName, ts) {
  if (!streamName) return undefined;
  return `${THUMB}/${ts ?? Math.floor(Date.now() / 1000)}/${streamName}`;
}

function mapModel(m) {
  if (!m.username) return undefined;
  const st = (m.status ?? "").toLowerCase();
  if (st === "off" || st === "offline" || st === "private") return undefined;
  const tags = m.tags ?? [];
  return {
    platform: "stripchat",
    roomId: m.username,
    title: m.topic || m.modelDetails?.fullName || m.username,
    uname: m.modelDetails?.fullName || m.username,
    cover: buildCover(m.streamName, m.snapshotTimestamp),
    online: m.viewersCount ?? 0,
    category: tags[0]?.name ?? tags[0]?.slug ?? m.broadcastGender ?? m.primaryTag,
    live: m.isLive ?? true,
    link: `https://stripchat.com/${m.username}`,
  };
}

function flatten(data) {
  if (Array.isArray(data.models) && data.models.length > 0) return data.models;
  const out = [];
  const seen = new Set();
  for (const block of data.blocks ?? []) {
    for (const m of block.models ?? []) {
      if (!m.username || seen.has(m.username)) continue;
      seen.add(m.username);
      out.push(m);
    }
  }
  return out;
}

async function fetchList(ctx, params) {
  const url = new URL(API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await ctx.fetch(url.toString(), { method: "GET", headers: HEADERS, timeout: 25000, http2: true });
  if (!res.ok) throw new Error(`Stripchat HTTP ${res.status}`);
  return res.json();
}

export async function getRecommend(ctx, { page, pageSize }) {
  const limit = Math.max(pageSize, 30);
  const data = await fetchList(ctx, { primaryTag: "girls", limit, offset: (page - 1) * limit });
  const models = flatten(data);
  return { list: models.map(mapModel).filter(Boolean), hasMore: models.length >= limit };
}

export async function getCategories(ctx) {
  return [
    { id: "primaryTag=girls", name: "Girls" },
    { id: "primaryTag=men", name: "Men" },
    { id: "primaryTag=couples", name: "Couples" },
    { id: "primaryTag=trans", name: "Trans" },
    { id: "primaryTag=girls&tagSlugs=asian", name: "Asian" },
    { id: "primaryTag=girls&tagSlugs=latina", name: "Latina" },
    { id: "primaryTag=girls&tagSlugs=ebony", name: "Ebony" },
    { id: "primaryTag=girls&tagSlugs=teen-18", name: "Teen 18+" },
    { id: "primaryTag=girls&tagSlugs=milf", name: "MILF" },
    { id: "primaryTag=girls&tagSlugs=mature", name: "Mature" },
    { id: "primaryTag=girls&tagSlugs=big-tits", name: "Big Tits" },
    { id: "primaryTag=girls&tagSlugs=squirt", name: "Squirt" },
  ];
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const params = { limit: 30, offset: (page - 1) * 30 };
  for (const part of categoryId.split("&")) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq)] = part.slice(eq + 1);
  }
  if (!params.primaryTag) params.primaryTag = "girls";
  const data = await fetchList(ctx, params);
  const models = flatten(data);
  return { list: models.map(mapModel).filter(Boolean), hasMore: models.length >= 30 };
}

export async function search(ctx, { keyword }) {
  const data = await fetchList(ctx, { primaryTag: "girls", searchPhrase: keyword, limit: 30 });
  const models = flatten(data);
  return { list: models.map(mapModel).filter(Boolean), hasMore: false };
}

export async function getRoomDetail(ctx, { roomId }) {
  const url = `https://stripchat.com/api/front/v2/models/username/${encodeURIComponent(roomId)}/cam`;
  const res = await ctx.fetch(url, { headers: HEADERS, timeout: 25000, http2: true });
  if (!res.ok) throw new Error(`Stripchat HTTP ${res.status}`);
  const body = await res.json();
  if (!body.model) throw new Error(`Stripchat ${roomId} 未找到`);
  return mapModel(body.model) || { platform: "stripchat", roomId, title: roomId, live: false, link: `https://stripchat.com/${roomId}` };
}

export async function resolve(ctx, { roomId }) {
  const camUrl = `https://stripchat.com/api/front/v2/models/username/${encodeURIComponent(roomId)}/cam`;
  let streamName;
  try {
    const res = await ctx.fetch(camUrl, { headers: HEADERS, timeout: 20000, http2: true });
    if (res.ok) {
      const body = await res.json();
      streamName = body.cam?.userStreamName || body.cam?.streamName;
    }
  } catch {}
  if (!streamName) {
    const pageRes = await ctx.fetch(`https://stripchat.com/${roomId}`, {
      headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
      timeout: 25000,
      http2: true,
    });
    if (!pageRes.ok) throw new Error(`Stripchat HTTP ${pageRes.status}`);
    const html = await pageRes.text();
    const m = html.match(/"streamName"\s*:\s*"([^"]+)"/);
    if (!m) throw new Error("Stripchat 未提取到 streamName");
    streamName = m[1];
  }
  const hls = `https://edge-hls.doppiocdn.com/hls/${streamName}/master/${streamName}_auto.m3u8`;
  return ctx.protocols.hlsStream({
    url: hls,
    qnLabel: "自适应 (需在设置中配 Mouflon 解扰密钥)",
    referer: REFERER,
    ua: UA,
  });
}
