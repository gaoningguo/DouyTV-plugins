/**
 * ManyVids 直播插件 —— Agora WebRTC SFU
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.manyvids.com/live/online";
const AGORA_APP_ID = "07af9cc5c9cd4cf7bf0b730a72997902";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://www.manyvids.com", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };

let listCache = null;
const TTL = 30_000;

export const manifest = {
  id: "manyvids",
  label: "ManyVids",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

async function fetchAll(ctx) {
  if (listCache && listCache.expiry > Date.now()) return listCache.data;
  const url = "https://api.manyvids.com/live/creators?sortBy=rank&limit=300&blockedCountry=Hong%20Kong&status=online";
  const res = await ctx.fetch(url, { headers: HEADERS, timeout: 30000, http2: true });
  if (!res.ok) throw new Error(`ManyVids HTTP ${res.status}`);
  const data = await res.json();
  const creators = data.creators ?? [];
  listCache = { data: creators, expiry: Date.now() + TTL };
  return creators;
}

function mapRoom(c) {
  const handle = c.url_handle;
  if (!handle) return undefined;
  const name = c.display_name || handle;
  return {
    platform: "manyvids",
    roomId: handle,
    title: name,
    uname: name,
    avatar: c.avatar || c.portrait,
    cover: c.live_cover || c.portrait,
    live: (c.live_status || "").toUpperCase() === "ONLINE",
    link: c.session_url || `https://www.manyvids.com/live/cam/${encodeURIComponent(handle)}`,
  };
}

async function findCreator(ctx, handle) {
  const all = await fetchAll(ctx);
  const key = handle.toLowerCase();
  return all.find((c) => (c.url_handle || "").toLowerCase() === key || (c.display_name || "").toLowerCase() === key);
}

async function joinChannel(ctx, userId) {
  const res = await ctx.fetch(`https://api.manyvids.com/live/room/${encodeURIComponent(userId)}/joinChannel`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ visibility: "PUBLIC" }),
    timeout: 20000,
    http2: true,
  });
  if (!res.ok) throw new Error(`ManyVids joinChannel HTTP ${res.status}`);
  return res.json();
}

export async function getRecommend(ctx, { page, pageSize }) {
  const all = await fetchAll(ctx);
  const start = (page - 1) * pageSize;
  return { list: all.slice(start, start + pageSize).map(mapRoom).filter(Boolean), hasMore: start + pageSize < all.length };
}

export async function getRoomDetail(ctx, { roomId }) {
  const c = await findCreator(ctx, roomId);
  if (!c) throw new Error(`ManyVids ${roomId} 不在线或不存在`);
  const base = mapRoom(c);
  if (!base) throw new Error(`ManyVids ${roomId} 数据异常`);
  return base;
}

export async function getLiveStatus(ctx, { roomId }) {
  const c = await findCreator(ctx, roomId);
  return (c?.live_status || "").toUpperCase() === "ONLINE";
}

export async function resolve(ctx, { roomId }) {
  const c = await findCreator(ctx, roomId);
  if (!c) throw new Error(`ManyVids ${roomId} 当前不在线或不存在`);
  if ((c.live_status || "").toUpperCase() !== "ONLINE") throw new Error(`ManyVids ${roomId} 状态 ${c.live_status}`);
  if (!c.user_id) throw new Error(`ManyVids ${roomId} 缺少 user_id`);
  const jc = await joinChannel(ctx, c.user_id);
  const info = jc.meetingInfo;
  if (!info?.channelId || !info?.rtc || typeof info?.uid !== "number") {
    throw new Error(`ManyVids joinChannel 异常: ${jc.message || ""}`);
  }
  return ctx.protocols.agoraStream({
    appId: AGORA_APP_ID,
    channelId: info.channelId,
    token: info.rtc,
    uid: info.uid,
    refresh: async () => {
      const fresh = await joinChannel(ctx, c.user_id);
      const m = fresh.meetingInfo;
      if (!m?.channelId || !m?.rtc || typeof m?.uid !== "number") throw new Error(`ManyVids refresh 异常`);
      return { channelId: m.channelId, token: m.rtc, uid: m.uid };
    },
    referer: REFERER,
    ua: UA,
  });
}
