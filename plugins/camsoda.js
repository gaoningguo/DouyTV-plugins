/**
 * CamSoda 直播插件
 *
 * 协议：HLS
 * API：https://www.camsoda.com/api/v1/browse/online
 */
const REFERER = "https://www.camsoda.com/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://www.camsoda.com", Accept: "application/json" };

export const manifest = {
  id: "camsoda",
  label: "CamSoda",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

export async function resolve(ctx, { roomId }) {
  const res = await ctx.fetch(
    `https://www.camsoda.com/api/v1/video/vtoken/${encodeURIComponent(roomId)}?username=guest`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) throw new Error(`CamSoda HTTP ${res.status}`);
  const data = await res.json();
  if (!data.token) throw new Error(`CamSoda 主播 ${roomId} 不在线或需登录`);
  const server = data.edge_servers?.[0] || data.stream_name;
  if (!server) throw new Error("CamSoda 未返回 edge server");
  const hlsUrl = `https://${server}/${data.stream_name}_v1/index.m3u8?token=${data.token}`;
  return ctx.protocols.hlsStream({ url: hlsUrl, referer: REFERER, ua: UA });
}

export async function getRecommend(ctx, { page, pageSize }) {
  const limit = Math.max(pageSize, 24);
  const offset = (page - 1) * limit;
  const res = await ctx.fetch(
    `https://www.camsoda.com/api/v1/browse/online?limit=${limit}&offset=${offset}`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (!res.ok) throw new Error(`CamSoda HTTP ${res.status}`);
  const data = await res.json();
  const users = data.results || [];
  const list = users.map((u) => ({
    platform: "camsoda",
    roomId: u.username || u.tpl_username || "",
    title: u.subject_html || u.display_name || u.username || "",
    uname: u.display_name || u.username,
    cover: u.thumb || u.thumb_hq,
    online: u.connection_count ?? 0,
    category: u.tags?.[0],
    live: u.status === "online",
    link: `https://www.camsoda.com/${u.username}`,
  })).filter((r) => r.roomId);
  return { list, hasMore: users.length >= limit };
}

export async function search(ctx, { keyword }) {
  const res = await ctx.fetch(
    `https://www.camsoda.com/api/v1/browse/online?limit=30&q=${encodeURIComponent(keyword)}`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) return { list: [], hasMore: false };
  const data = await res.json();
  const users = data.results || [];
  const list = users.map((u) => ({
    platform: "camsoda",
    roomId: u.username || "",
    title: u.subject_html || u.username || "",
    uname: u.display_name || u.username,
    cover: u.thumb,
    online: u.connection_count ?? 0,
    live: u.status === "online",
    link: `https://www.camsoda.com/${u.username}`,
  })).filter((r) => r.roomId);
  return { list, hasMore: false };
}
