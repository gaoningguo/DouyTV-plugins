/**
 * AmateurTV 直播插件 (a0s.net 系)
 * 协议: sample-aes-mp4 (Rust 端 SAMPLE-AES 解密代理)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const STREAM_UA = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const REFERER = "https://www.amateur.tv/";
const HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Origin: "https://www.amateur.tv",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

export const manifest = {
  id: "amateurtv",
  label: "AmateurTV",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function absUrl(u) {
  if (!u) return undefined;
  if (u.startsWith("http")) return u;
  return `https://www.amateur.tv${u}`;
}

function mapCam(c) {
  if (!c.username) return undefined;
  return {
    platform: "amateurtv",
    roomId: c.username,
    title: c.topic || c.username,
    uname: c.username,
    avatar: absUrl(c.optimized?.avatar) || absUrl(c.avatar),
    cover: absUrl(c.optimized?.fullCapture) || absUrl(c.optimized?.capture) || absUrl(c.fullCapture) || absUrl(c.capture),
    online: c.viewers ?? 0,
    category: c.tags?.slice(0, 5).join(", ") || c.countryName,
    live: c.online ?? true,
    link: `https://www.amateur.tv/${c.username}`,
  };
}

async function fetchList(ctx) {
  const res = await ctx.fetch("https://www.amateur.tv/v3/readmodel/cache/onlinecamlist-cam-score", {
    headers: HEADERS,
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error(`AmateurTV HTTP ${res.status}`);
  return res.json();
}

async function fetchShow(ctx, username) {
  const res = await ctx.fetch(`https://www.amateur.tv/v3/readmodel/show/${encodeURIComponent(username)}/en`, {
    headers: HEADERS,
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error(`AmateurTV HTTP ${res.status}`);
  return res.json();
}

export async function getRecommend(ctx, { page, pageSize }) {
  const data = await fetchList(ctx);
  const all = (data.cams ?? []).map(mapCam).filter(Boolean);
  const start = (page - 1) * pageSize;
  return { list: all.slice(start, start + pageSize), hasMore: start + pageSize < all.length };
}

export async function search(ctx, { keyword, page }) {
  const data = await fetchList(ctx);
  const lower = keyword.toLowerCase();
  const matched = (data.cams ?? []).filter((c) =>
    c.username?.toLowerCase().includes(lower) ||
    c.topic?.toLowerCase().includes(lower) ||
    c.tags?.some((t) => t.toLowerCase().includes(lower))
  ).map(mapCam).filter(Boolean);
  const ps = 20;
  const start = (page - 1) * ps;
  return { list: matched.slice(start, start + ps), hasMore: start + ps < matched.length };
}

export async function getRoomDetail(ctx, { roomId }) {
  const list = await fetchList(ctx);
  const found = list.cams?.find((x) => x.username?.toLowerCase() === roomId.toLowerCase());
  if (found) return mapCam(found);
  const show = await fetchShow(ctx, roomId);
  return {
    platform: "amateurtv",
    roomId,
    title: roomId,
    uname: roomId,
    live: show.status === "online",
    category: show.privateChatStatus ? "private" : "public",
    link: `https://www.amateur.tv/${roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const data = await fetchShow(ctx, roomId);
    return data.status === "online" && !data.privateChatStatus;
  } catch { return false; }
}

export async function resolve(ctx, { roomId }) {
  const data = await fetchShow(ctx, roomId);
  if (data.message === "NOT_FOUND") throw new Error(`AmateurTV ${roomId} 不存在`);
  if (data.status !== "online") throw new Error(`AmateurTV ${roomId} 不在线`);
  if (data.privateChatStatus) throw new Error(`AmateurTV ${roomId} 私密模式`);
  const m3u8Url = data.videoTechnologies?.["fmp4-hls"];
  if (!m3u8Url) throw new Error("AmateurTV 未返回 fmp4-hls");
  return ctx.protocols.sampleAesMp4Stream({
    url: m3u8Url,
    qnLabel: data.qualities?.[0] ?? "auto",
    referer: REFERER,
    ua: STREAM_UA,
  });
}
