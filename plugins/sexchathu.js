/**
 * SexChatHU (sexchat.hu) plugin —— 匈牙利 AdultPerformerNetwork 旗下成人 cam。
 */

export const manifest = {
  id: "sexchathu",
  label: "SexChat.hu",
  version: "1.0.0",
  adult: true,
  engine: { netliveApi: 1 },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://sexchat.hu/";

const COMMON_HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Accept: "application/json, text/plain, */*",
};

const LIST_ENDPOINTS = [
  "https://sexchat.hu/ajax/api/roomList/babes",
  "https://sexchat.hu/ajax/api/roomList/babes/all",
];

function ensureHttps(url) {
  if (!url) return undefined;
  if (url.startsWith("//")) return "https:" + url;
  return url;
}

async function fetchEndpoint(ctx, url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ctx.fetch(url, {
        method: "GET",
        headers: COMMON_HEADERS,
        timeout: 30000,
        http2: true,
      });
      if (res.ok) return await res.json();
      if (res.status < 500) return [];
    } catch {
      /* retry */
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
  }
  return [];
}

async function fetchAll(ctx) {
  const lists = await Promise.all(LIST_ENDPOINTS.map((u) => fetchEndpoint(ctx, u)));
  if (lists.every((l) => l.length === 0)) {
    const res = await ctx.fetch(LIST_ENDPOINTS[0], {
      method: "GET",
      headers: COMMON_HEADERS,
      timeout: 30000,
      http2: true,
    });
    if (!res.ok) throw new Error("SexChatHU HTTP " + res.status);
    return await res.json();
  }
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const room of list) {
      const key = String(room.perfid ?? room.screenname ?? "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(room);
    }
  }
  return merged;
}

function statusKind(status) {
  const s = (status ?? "").toLowerCase();
  if (s === "free") return "free";
  if (s === "offline") return "offline";
  return "private";
}

function mapRoom(r) {
  const screen = r.screenname || r.onlineparams?.screenName;
  if (!screen) return undefined;
  const kind = statusKind(r.onlinestatus);
  const primaryCat = r.onlineparams?.publicData?.primaryCat || r.primarycat;
  const category =
    kind === "private" ? "🔒 私密直播中" : primaryCat;
  return {
    platform: "sexchathu",
    roomId: screen,
    title: screen,
    uname: screen,
    cover: ensureHttps(r.snapshotid_big || r.snapshotid),
    online: 0,
    category,
    live: kind === "free",
    link: r.perfid
      ? "https://sexchat.hu/mypage/" + r.perfid + "/" + encodeURIComponent(screen) + "/chat"
      : "https://sexchat.hu/",
  };
}

function statusOrder(status) {
  switch (statusKind(status)) {
    case "free":
      return 0;
    case "private":
      return 1;
    default:
      return 2;
  }
}

let pagedCache = null;

const PAGED_CACHE_TTL_MS = 5 * 60 * 1000;
const PAGED_SOFT_LIMIT = 15;

function roomKey(r) {
  return String(r.perfid ?? r.screenname ?? "");
}

function findCachedRoom(roomId) {
  if (!pagedCache) return undefined;
  if (/^\d+$/.test(roomId)) {
    const direct = pagedCache.rooms.get(roomId);
    if (direct) return direct;
  }
  const lower = roomId.toLowerCase();
  for (const r of pagedCache.rooms.values()) {
    if ((r.screenname ?? "").toLowerCase() === lower) return r;
  }
  return undefined;
}

async function fetchRoomByPerfid(ctx, perfid) {
  const arr = await fetchEndpoint(ctx,
    "https://sexchat.hu/ajax/api/roomList/babes/" + perfid
  );
  const target = String(perfid);
  return arr.find((r) => String(r.perfid) === target);
}

export async function getRecommend(ctx, { page, pageSize }) {
  const now = Date.now();
  const stale = !pagedCache || now - pagedCache.lastUpdate > PAGED_CACHE_TTL_MS;
  if (page === 1 || stale) {
    pagedCache = { rooms: new Map(), exhausted: false, lastUpdate: now };
  }
  if (pagedCache.exhausted) {
    return { list: [], hasMore: false };
  }

  const fresh = await fetchAll(ctx);
  const newRooms = [];
  for (const r of fresh) {
    const key = roomKey(r);
    if (!key) continue;
    if (!pagedCache.rooms.has(key)) {
      pagedCache.rooms.set(key, r);
      newRooms.push(r);
    }
  }
  pagedCache.lastUpdate = now;

  if (newRooms.length === 0) {
    pagedCache.exhausted = true;
    return { list: [], hasMore: false };
  }

  const sorted = newRooms.sort(
    (a, b) => statusOrder(a.onlinestatus) - statusOrder(b.onlinestatus),
  );
  const list = sorted.map(mapRoom).filter((r) => !!r);

  const hasMore = page < PAGED_SOFT_LIMIT;
  return { list, hasMore };
}

export async function search(ctx, { keyword, page }) {
  const arr = await fetchAll(ctx);
  const kw = keyword.toLowerCase();
  const list = arr
    .filter((r) => (r.screenname ?? "").toLowerCase().includes(kw))
    .sort((a, b) => statusOrder(a.onlinestatus) - statusOrder(b.onlinestatus))
    .map(mapRoom)
    .filter((r) => !!r);
  return { list, hasMore: false };
}

export async function resolve(ctx, { roomId }) {
  let cached = findCachedRoom(roomId);
  if (!cached) {
    const arr = await fetchAll(ctx);
    cached = arr.find(
      (r) => (r.screenname ?? "").toLowerCase() === roomId.toLowerCase(),
    );
    if (!cached) {
      throw new Error("SexChatHU 未找到主播 " + roomId + "（可能已离线）");
    }
  }
  if (!cached.perfid) {
    throw new Error("SexChatHU " + roomId + " 缺 perfid，无法 resolve");
  }

  const fresh = await fetchRoomByPerfid(ctx, cached.perfid);
  if (!fresh) {
    throw new Error("SexChatHU 主播 " + roomId + " 已下线");
  }

  const status = (fresh.onlinestatus ?? "").toLowerCase();
  if (status !== "free") {
    throw new Error(
      "SexChatHU 主播 " + roomId + " 状态 " + status + "（私密/离线，匿名无画面）"
    );
  }
  const hls = ensureHttps(fresh.onlineparams?.modeSpecific?.main?.hls?.address);
  if (!hls) throw new Error("SexChatHU " + roomId + " 无 HLS URL（状态 free 但无流）");
  return ctx.protocols.hlsStream({
    url: hls,
    qn: "auto",
    qnLabel: "自适应",
    referer: REFERER,
    ua: UA,
  });
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const cached = findCachedRoom(roomId);
    if (cached?.perfid) {
      const fresh = await fetchRoomByPerfid(ctx, cached.perfid);
      return (fresh?.onlinestatus ?? "").toLowerCase() === "free";
    }
    const arr = await fetchAll(ctx);
    const found = arr.find(
      (r) => (r.screenname ?? "").toLowerCase() === roomId.toLowerCase(),
    );
    return (found?.onlinestatus ?? "").toLowerCase() === "free";
  } catch {
    return false;
  }
}
