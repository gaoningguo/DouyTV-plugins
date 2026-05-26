/**
 * CamSoda 直播 plugin —— 18+ 成人 cam 平台。
 */

export const manifest = {
  id: "camsoda",
  label: "CamSoda",
  version: "1.0.0",
  adult: true,
  engine: { netliveApi: 1 },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.camsoda.com/";

const COMMON_HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Origin: REFERER.replace(/\/$/, ""),
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

const TPL = {
  USER_ID: "0",
  USERNAME: "1",
  DISPLAY_NAME: "2",
  STATUS: "3",
  CONNECTIONS: "4",
  SUBJECT_HTML: "6",
  STREAM_NAME: "7",
  GENDER: "8",
  THUMB: "10",
  BITRATE: "12",
  STANDBY: "14",
};

function tplStr(tpl, idx) {
  const v = tpl?.[idx];
  return typeof v === "string" ? v : undefined;
}

function tplNum(tpl, idx) {
  const v = tpl?.[idx];
  return typeof v === "number" ? v : undefined;
}

function mapRoom(raw) {
  const tpl = raw.tpl;
  if (!tpl) return undefined;

  const username = tplStr(tpl, TPL.USERNAME);
  if (!username) return undefined;

  const standby = tplNum(tpl, TPL.STANDBY);
  if (standby === 1) return undefined;

  const displayName = tplStr(tpl, TPL.DISPLAY_NAME);
  const topic = tplStr(tpl, TPL.SUBJECT_HTML);
  const cover = tplStr(tpl, TPL.THUMB);
  const viewers = tplNum(tpl, TPL.CONNECTIONS) ?? 0;
  const gender = tplStr(tpl, TPL.GENDER);

  return {
    platform: "camsoda",
    roomId: username,
    title: topic || displayName || username,
    uname: displayName || username,
    cover,
    online: viewers,
    category: gender,
    live: true,
    link: "https://www.camsoda.com/" + username,
  };
}

async function fetchBrowse(ctx, params) {
  const url = new URL("https://www.camsoda.com/api/v1/browse/online");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await ctx.fetch(url.toString(), {
    method: "GET",
    headers: COMMON_HEADERS,
    timeout: 30000,
    http2: true,
  });
  if (!res.ok) throw new Error("CamSoda HTTP " + res.status);
  const data = await res.json();
  return data.results ?? [];
}

export async function getRecommend(ctx, { page, pageSize }) {
  const arr = await fetchBrowse(ctx, { page, gender: "f", showType: "all" });
  const list = arr.map(mapRoom).filter((v) => !!v);
  return { list, hasMore: arr.length > 0 };
}

const PRESET_CATEGORIES = [
  { id: "gender=f", name: "Female" },
  { id: "gender=m", name: "Male" },
  { id: "gender=t", name: "Trans" },
  { id: "gender=c", name: "Couple" },
];

export async function getCategories(ctx) {
  return PRESET_CATEGORIES;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const [k, v] = categoryId.split("=");
  if (!k || !v) return { list: [], hasMore: false };
  const arr = await fetchBrowse(ctx, { [k]: v, page, showType: "all" });
  const list = arr.map(mapRoom).filter((r) => !!r);
  return { list, hasMore: arr.length > 0 };
}

export async function search(ctx, { keyword, page }) {
  const arr = await fetchBrowse(ctx, { find: keyword, page: 1, showType: "all" });
  const list = arr.map(mapRoom).filter((r) => !!r);
  return { list, hasMore: false };
}

async function fetchVtoken(ctx, roomId) {
  const url = "https://www.camsoda.com/api/v1/video/vtoken/" + encodeURIComponent(roomId) + "?username=guest_";
  const res = await ctx.fetch(url, {
    method: "GET",
    headers: { ...COMMON_HEADERS, Referer: "https://www.camsoda.com/" + roomId },
    timeout: 30000,
    http2: true,
  });
  if (!res.ok) throw new Error("CamSoda vtoken HTTP " + res.status);
  return res.json();
}

export async function getRoomDetail(ctx, { roomId }) {
  try {
    const v = await fetchVtoken(ctx, roomId);
    return {
      platform: "camsoda",
      roomId,
      title: roomId,
      uname: roomId,
      live: v.status === "online",
      link: "https://www.camsoda.com/" + roomId,
    };
  } catch {
    return {
      platform: "camsoda",
      roomId,
      title: roomId,
      uname: roomId,
      live: false,
      link: "https://www.camsoda.com/" + roomId,
    };
  }
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const v = await fetchVtoken(ctx, roomId);
    return v.status === "online";
  } catch {
    return false;
  }
}

export async function resolve(ctx, { roomId }) {
  const v = await fetchVtoken(ctx, roomId);

  if (v.status && v.status !== "online") {
    throw new Error("CamSoda 房间 " + roomId + " 状态 " + v.status + "（未公开播放）");
  }
  if (!v.stream_name) {
    throw new Error("CamSoda vtoken 未返回 stream_name（房间可能未开播）");
  }
  const edges = v.edge_servers ?? [];
  if (edges.length === 0) {
    throw new Error("CamSoda vtoken 未返回 edge_servers");
  }

  const urlFor = (edge) => "https://" + edge + "/" + v.stream_name + "_v1/index.m3u8";

  const primary = urlFor(edges[0]);
  const alternatives = edges.slice(1).map((edge, i) => ({
    qn: "edge" + (i + 2),
    label: "备用线路 " + (i + 2),
    url: urlFor(edge),
  }));

  return ctx.protocols.hlsStream({
    url: primary,
    qn: "auto",
    qnLabel: "自适应 (" + (v.width ?? "?") + "x" + (v.height ?? "?") + ")",
    alternatives: alternatives.length > 0 ? alternatives : undefined,
    referer: REFERER,
    ua: UA,
  });
}
