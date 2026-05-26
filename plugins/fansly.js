/**
 * Fansly Live 直播插件
 * 协议: HLS (AWS IVS)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://fansly.com/";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://fansly.com", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };

const accountById = new Map();
const usernameToId = new Map();

export const manifest = {
  id: "fansly",
  label: "Fansly Live",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function pickAvatar(acc) {
  const variants = acc.avatar?.variants ?? [];
  const sorted = [...variants].filter((v) => v.locations?.[0]?.location).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  for (const v of sorted) if ((v.width ?? 0) >= 200) return v.locations?.[0]?.location;
  return sorted[0]?.locations?.[0]?.location;
}

function pickBanner(acc) {
  const variants = acc.banner?.variants ?? [];
  const sorted = [...variants].filter((v) => v.locations?.[0]?.location).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  for (const v of sorted) if ((v.width ?? 0) >= 480) return v.locations?.[0]?.location;
  return sorted[sorted.length - 1]?.locations?.[0]?.location;
}

function toRoom(acc) {
  if (!acc.id || !acc.username) return undefined;
  const ch = acc.streaming?.channel;
  const st = ch?.stream;
  const avatar = pickAvatar(acc);
  const banner = pickBanner(acc);
  return {
    platform: "fansly",
    roomId: acc.id,
    title: st?.title || acc.displayName || acc.username,
    uname: acc.displayName || acc.username,
    avatar,
    cover: banner || avatar,
    online: st?.viewerCount ?? 0,
    category: "live",
    live: ch?.status === 2 && st?.status === 2,
    link: `https://fansly.com/${encodeURIComponent(acc.username)}`,
    introduction: acc.about,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const ps = Math.max(1, Math.min(pageSize, 50));
  const offset = (page - 1) * ps;
  const url = `https://apiv3.fansly.com/api/v1/contentdiscovery/livesuggestions?limit=${ps}&offset=${offset}&ngsw-bypass=true`;
  const res = await ctx.fetch(url, { headers: HEADERS, timeout: 25000 });
  if (!res.ok) throw new Error(`Fansly HTTP ${res.status}`);
  const data = await res.json();
  if (data.success !== true) throw new Error("Fansly success!=true");
  const accounts = data.response?.accounts ?? [];
  for (const a of accounts) {
    if (a.id) accountById.set(a.id, { at: Date.now(), acc: a });
    if (a.username && a.id) usernameToId.set(a.username.toLowerCase(), a.id);
  }
  return { list: accounts.map(toRoom).filter(Boolean), hasMore: accounts.length === ps };
}

export async function search(ctx, { keyword }) {
  const kw = keyword.trim();
  if (!kw) return { list: [], hasMore: false };
  const url = `https://apiv3.fansly.com/api/v1/account?usernames=${encodeURIComponent(kw)}&ngsw-bypass=true`;
  const res = await ctx.fetch(url, { headers: HEADERS, timeout: 15000 });
  if (!res.ok) return { list: [], hasMore: false };
  const data = await res.json();
  const rooms = [];
  for (const a of data.response ?? []) {
    if (!a.id || !a.username) continue;
    usernameToId.set(a.username.toLowerCase(), a.id);
    accountById.set(a.id, { at: Date.now(), acc: a });
    const r = toRoom(a);
    if (r) rooms.push(r);
  }
  return { list: rooms, hasMore: false };
}

async function getRoomId(ctx, username) {
  const cached = usernameToId.get(username.toLowerCase());
  if (cached) return cached;
  const res = await ctx.fetch(`https://apiv3.fansly.com/api/v1/account?usernames=${encodeURIComponent(username)}&ngsw-bypass=true`, { headers: HEADERS, timeout: 20000 });
  if (!res.ok) return null;
  const data = await res.json();
  for (const a of data.response ?? []) {
    if (a.username?.toLowerCase() === username.toLowerCase() && a.id) {
      usernameToId.set(a.username.toLowerCase(), a.id);
      accountById.set(a.id, { at: Date.now(), acc: a });
      return a.id;
    }
  }
  return null;
}

async function fetchChannel(ctx, roomId) {
  const res = await ctx.fetch(`https://apiv3.fansly.com/api/v1/streaming/channel/${encodeURIComponent(roomId)}?ngsw-bypass=true`, { headers: HEADERS, timeout: 20000 });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.success !== true) return null;
  return data.response?.stream ?? null;
}

export async function resolve(ctx, { roomId }) {
  let chId = roomId;
  if (!/^\d+$/.test(roomId)) {
    const found = await getRoomId(ctx, roomId);
    if (!found) throw new Error(`Fansly ${roomId} 不存在`);
    chId = found;
  }
  const stream = await fetchChannel(ctx, chId);
  if (!stream) throw new Error(`Fansly ${roomId} 拉不到 stream`);
  if (stream.status !== 2) throw new Error(`Fansly ${roomId} 不在线`);
  if (stream.access !== true || !stream.playbackUrl) throw new Error(`Fansly ${roomId} 需订阅`);
  return ctx.protocols.hlsStream({ url: stream.playbackUrl, referer: REFERER, ua: UA });
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    let chId = roomId;
    if (!/^\d+$/.test(roomId)) {
      const found = await getRoomId(ctx, roomId);
      if (!found) return false;
      chId = found;
    }
    const cached = accountById.get(chId);
    if (cached && Date.now() - cached.at < 60000) return cached.acc.streaming?.channel?.status === 2;
    const s = await fetchChannel(ctx, chId);
    return s?.status === 2 && s?.access === true;
  } catch { return false; }
}

export async function getRoomDetail(ctx, { roomId }) {
  let chId = roomId;
  if (!/^\d+$/.test(roomId)) {
    const found = await getRoomId(ctx, roomId);
    if (found) chId = found;
  }
  const cached = accountById.get(chId);
  if (cached && Date.now() - cached.at < 60000) return toRoom(cached.acc);
  const res = await ctx.fetch(`https://apiv3.fansly.com/api/v1/account?ids=${encodeURIComponent(chId)}&ngsw-bypass=true`, { headers: HEADERS, timeout: 15000 });
  if (res.ok) {
    const data = await res.json();
    for (const a of data.response ?? []) {
      if (a.id) {
        accountById.set(a.id, { at: Date.now(), acc: a });
        const r = toRoom(a);
        if (r) return r;
      }
    }
  }
  return { platform: "fansly", roomId, title: roomId, uname: roomId, live: false, link: `https://fansly.com/${encodeURIComponent(roomId)}` };
}
