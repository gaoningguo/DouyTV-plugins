/**
 * SexChat HU 直播插件 —— 匈牙利成人 cam 平台
 * 协议: HLS
 * API: https://sexchat.hu/ajax/api/roomList/babes
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://sexchat.hu/";
const API_BASE = "https://sexchat.hu/ajax/api/roomList/babes";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "application/json, text/plain, */*" };

export const manifest = {
  id: "sexchathu",
  label: "SexChat HU",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

let roomCache = [];

function statusLabel(s) {
  if (!s) return "offline";
  const lower = s.toLowerCase();
  if (lower === "free") return "free";
  if (lower === "offline") return "offline";
  return "private";
}

function mapRoom(r) {
  if (!r.perfid || !r.screenname) return undefined;
  const st = statusLabel(r.onlinestatus);
  if (st === "offline") return undefined;
  const cover = r.snapshotid_big
    ? `https://m1.nsimg.net/bigsnapshots/${r.snapshotid_big}`
    : r.snapshotid
      ? `https://m1.nsimg.net/snapshots/${r.snapshotid}`
      : undefined;
  return {
    platform: "sexchathu",
    roomId: r.screenname,
    title: r.screenname,
    uname: r.screenname,
    cover,
    online: 0,
    category: st === "free" ? "Free Chat" : "Private",
    live: st === "free",
    link: `https://sexchat.hu/${r.screenname}`,
    _perfid: r.perfid,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const [res1, res2] = await Promise.all([
    ctx.fetch(API_BASE, { headers: HEADERS, timeout: 25000 }),
    ctx.fetch(`${API_BASE}/all`, { headers: HEADERS, timeout: 25000 }),
  ]);
  const arr1 = res1.ok ? await res1.json() : [];
  const arr2 = res2.ok ? await res2.json() : [];
  const seen = new Set();
  const merged = [];
  for (const r of [...(Array.isArray(arr1) ? arr1 : []), ...(Array.isArray(arr2) ? arr2 : [])]) {
    if (!r.perfid || seen.has(r.perfid)) continue;
    seen.add(r.perfid);
    merged.push(r);
  }
  // Sort: free first, then private
  merged.sort((a, b) => {
    const aFree = (a.onlinestatus || "").toLowerCase() === "free" ? 0 : 1;
    const bFree = (b.onlinestatus || "").toLowerCase() === "free" ? 0 : 1;
    return aFree - bFree;
  });
  roomCache = merged;
  const offset = (page - 1) * pageSize;
  const slice = merged.slice(offset, offset + pageSize);
  const list = slice.map(mapRoom).filter(Boolean);
  return { list, hasMore: offset + pageSize < merged.length };
}

export async function search(ctx, { keyword }) {
  const kw = keyword.toLowerCase();
  // Try from cache first, fallback to fresh fetch
  let rooms = roomCache;
  if (!rooms.length) {
    const [res1, res2] = await Promise.all([
      ctx.fetch(API_BASE, { headers: HEADERS, timeout: 25000 }),
      ctx.fetch(`${API_BASE}/all`, { headers: HEADERS, timeout: 25000 }),
    ]);
    const arr1 = res1.ok ? await res1.json() : [];
    const arr2 = res2.ok ? await res2.json() : [];
    const seen = new Set();
    rooms = [];
    for (const r of [...(Array.isArray(arr1) ? arr1 : []), ...(Array.isArray(arr2) ? arr2 : [])]) {
      if (!r.perfid || seen.has(r.perfid)) continue;
      seen.add(r.perfid);
      rooms.push(r);
    }
    roomCache = rooms;
  }
  const filtered = rooms.filter((r) => (r.screenname || "").toLowerCase().includes(kw));
  const list = filtered.map(mapRoom).filter(Boolean);
  return { list, hasMore: false };
}

export async function resolve(ctx, { roomId }) {
  // Find perfid from cache or search
  let perfid;
  const cached = roomCache.find((r) => (r.screenname || "").toLowerCase() === roomId.toLowerCase());
  if (cached) {
    perfid = cached.perfid;
  } else {
    // Fetch fresh to find perfid
    const res = await ctx.fetch(API_BASE, { headers: HEADERS, timeout: 20000 });
    if (res.ok) {
      const arr = await res.json();
      const found = (Array.isArray(arr) ? arr : []).find(
        (r) => (r.screenname || "").toLowerCase() === roomId.toLowerCase()
      );
      if (found) perfid = found.perfid;
    }
  }
  if (!perfid) throw new Error(`SexChatHU: ${roomId} 未找到或不在线`);

  // Fetch fresh room data for live HLS URL
  const res = await ctx.fetch(`${API_BASE}/${perfid}`, { headers: HEADERS, timeout: 20000 });
  if (!res.ok) throw new Error(`SexChatHU HTTP ${res.status}`);
  const data = await res.json();
  const rooms = Array.isArray(data) ? data : [];
  const room = rooms.find((r) => r.perfid === perfid);
  if (!room) throw new Error(`SexChatHU: ${roomId} 房间数据为空`);

  const hlsAddr = room.onlineparams?.modeSpecific?.main?.hls?.address;
  if (!hlsAddr) throw new Error(`SexChatHU: ${roomId} 无 HLS 地址 (可能不在线)`);

  const hlsUrl = hlsAddr.startsWith("//") ? `https:${hlsAddr}` : hlsAddr;
  return ctx.protocols.hlsStream({ url: hlsUrl, referer: REFERER, ua: UA });
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const cached = roomCache.find((r) => (r.screenname || "").toLowerCase() === roomId.toLowerCase());
    if (cached) {
      return (cached.onlinestatus || "").toLowerCase() === "free";
    }
    const res = await ctx.fetch(API_BASE, { headers: HEADERS, timeout: 15000 });
    if (!res.ok) return false;
    const arr = await res.json();
    const room = (Array.isArray(arr) ? arr : []).find(
      (r) => (r.screenname || "").toLowerCase() === roomId.toLowerCase()
    );
    return room ? (room.onlinestatus || "").toLowerCase() === "free" : false;
  } catch {
    return false;
  }
}
