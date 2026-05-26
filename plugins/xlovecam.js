/**
 * XLoveCam (xlovecam.com) 直播插件 —— 匈牙利 AdultPerformerNetwork 旗下 cam
 * 协议: HLS (wlresources.com CDN)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.xlovecam.com/";
const API_BASE = "https://www.xlovecam.com/hu";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://www.xlovecam.com", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };

const nicknameToId = new Map();

export const manifest = {
  id: "xlovecam",
  label: "XLoveCam",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

async function postForm(ctx, path, body) {
  const form = Object.entries(body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const res = await ctx.fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error(`XLoveCam HTTP ${res.status}`);
  return res.json();
}

function mapRoom(p) {
  if (!p.nickname) return undefined;
  if (typeof p.id === "number") nicknameToId.set(p.nickname, p.id);
  return {
    platform: "xlovecam",
    roomId: p.nickname,
    title: p.nickname,
    uname: p.nickname,
    avatar: p.profileImg,
    cover: p.snapshot || p.profileImg,
    online: 0,
    live: true,
    link: `https://www.xlovecam.com/hu/profile/${encodeURIComponent(p.nickname)}`,
  };
}

function listBody(nickname, from, length) {
  return {
    "config[nickname]": nickname,
    "config[favorite]": "0",
    "config[recent]": "0",
    "config[vip]": "0",
    "config[sort][id]": "35",
    "offset[from]": String(from),
    "offset[length]": String(length),
    origin: "filter-chg",
    stat: "0",
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const length = Math.max(pageSize, 20);
  const from = Math.max(0, (page - 1) * length);
  const data = await postForm(ctx, "/performerAction/onlineList", listBody("", from, length));
  const arr = data.content?.performerList ?? [];
  return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length >= length };
}

export async function search(ctx, { keyword }) {
  const data = await postForm(ctx, "/performerAction/onlineList", listBody(keyword, 0, 50));
  const arr = data.content?.performerList ?? [];
  return { list: arr.map(mapRoom).filter(Boolean), hasMore: false };
}

async function resolveId(ctx, nickname) {
  const cached = nicknameToId.get(nickname);
  if (cached) return cached;
  const data = await postForm(ctx, "/performerAction/onlineList", listBody(nickname, 0, 10));
  for (const p of data.content?.performerList ?? []) {
    if (p.nickname?.toLowerCase() === nickname.toLowerCase() && typeof p.id === "number") {
      nicknameToId.set(nickname, p.id);
      return p.id;
    }
  }
  return null;
}

export async function resolve(ctx, { roomId }) {
  const id = await resolveId(ctx, roomId);
  if (!id) throw new Error(`XLoveCam 未找到主播 ${roomId}`);
  const data = await postForm(ctx, "/performerAction/getPerformerRoom", { performerId: String(id) });
  const perf = data.content?.performer;
  if (!perf) throw new Error("XLoveCam 拿不到房间数据");
  if (perf.online !== 1) throw new Error(`XLoveCam 主播 ${roomId} 不在线`);
  if (!perf.hlsPlaylistFree) throw new Error(`XLoveCam 主播 ${roomId} 私密模式`);
  return ctx.protocols.hlsStream({ url: perf.hlsPlaylistFree, referer: REFERER, ua: UA });
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const id = await resolveId(ctx, roomId);
    if (!id) return false;
    const data = await postForm(ctx, "/performerAction/getPerformerRoom", { performerId: String(id) });
    return data.content?.performer?.online === 1;
  } catch { return false; }
}
