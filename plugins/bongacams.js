/**
 * BongaCams 直播插件
 *
 * 协议：HLS
 * API：https://tools.bongacams.com/promo.php?c=2001&type=api&api_v=1
 */
const REFERER = "https://bongacams.com/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "application/json, text/plain, */*" };

export const manifest = {
  id: "bongacams",
  label: "BongaCams",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

export async function resolve(ctx, { roomId }) {
  const res = await ctx.fetch(
    `https://tools.bongacams.com/promo.php?c=2001&type=api&api_v=1&model=${encodeURIComponent(roomId)}`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) throw new Error(`BongaCams HTTP ${res.status}`);
  const data = await res.json();
  const models = Array.isArray(data) ? data : [];
  const model = models.find((m) => m.username?.toLowerCase() === roomId.toLowerCase());
  if (!model) throw new Error(`BongaCams 主播 ${roomId} 不在线`);
  const hlsUrl = model.direct_chat_url
    ? `https:${model.direct_chat_url}`
    : `https://edge-hls.bongacams.com/hls/stream_${roomId}/playlist.m3u8`;
  return ctx.protocols.hlsStream({ url: hlsUrl, referer: REFERER, ua: UA });
}

export async function getRecommend(ctx, { page, pageSize }) {
  const offset = (page - 1) * pageSize;
  const res = await ctx.fetch(
    `https://tools.bongacams.com/promo.php?c=2001&type=api&api_v=1&limit=${pageSize}&offset=${offset}`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (!res.ok) throw new Error(`BongaCams HTTP ${res.status}`);
  const data = await res.json();
  const models = Array.isArray(data) ? data : [];
  const list = models.map((m) => ({
    platform: "bongacams",
    roomId: m.username || "",
    title: m.topic || m.display_name || m.username || "",
    uname: m.display_name || m.username,
    cover: m.thumb_image ? `https:${m.thumb_image}` : undefined,
    online: m.members_count ?? 0,
    category: m.primary_tag,
    live: true,
    link: `https://bongacams.com/${m.username}`,
  })).filter((r) => r.roomId);
  return { list, hasMore: models.length >= pageSize };
}

export async function search(ctx, { keyword }) {
  const res = await ctx.fetch(
    `https://tools.bongacams.com/promo.php?c=2001&type=api&api_v=1&model=${encodeURIComponent(keyword)}&limit=30`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) return { list: [], hasMore: false };
  const data = await res.json();
  const models = Array.isArray(data) ? data : [];
  const list = models.map((m) => ({
    platform: "bongacams",
    roomId: m.username || "",
    title: m.topic || m.username || "",
    uname: m.display_name || m.username,
    cover: m.thumb_image ? `https:${m.thumb_image}` : undefined,
    online: m.members_count ?? 0,
    live: true,
    link: `https://bongacams.com/${m.username}`,
  })).filter((r) => r.roomId);
  return { list, hasMore: false };
}
