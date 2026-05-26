/**
 * BongaCams 直播 plugin —— 18+ 成人 cam 平台。
 */

export const manifest = {
  id: "bongacams",
  label: "BongaCams",
  version: "1.0.0",
  adult: true,
  engine: { netliveApi: 1 },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://bongacams.com/";

const COMMON_HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "X-Requested-With": "XMLHttpRequest",
};

function buildThumbUrl(thumb) {
  if (!thumb) return undefined;
  let url = thumb.replace("{ext}", "webp");
  if (url.startsWith("//")) url = "https:" + url;
  return url;
}

function mapRoom(r) {
  if (!r.username) return undefined;
  if (r.room && r.room !== "public") return undefined;
  return {
    platform: "bongacams",
    roomId: r.username,
    title: r.topic || r.display_name || r.username,
    uname: r.display_name || r.username,
    avatar: r.profile_image ?? r.profile_images?.thumbnail_image_medium,
    cover: buildThumbUrl(r.thumb_image),
    online: r.viewers ?? r.members_count ?? 0,
    category: r.gender ?? (r.tags && r.tags.length > 0 ? r.tags[0] : undefined) ?? r.country,
    live: true,
    link: "https://bongacams.com/" + r.username,
  };
}

async function fetchList(ctx, params) {
  const url = new URL("https://bongacams.com/tools/listing_v3.php");
  url.searchParams.set("livetab", "female");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await ctx.fetch(url.toString(), {
    method: "GET",
    headers: COMMON_HEADERS,
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error("BongaCams HTTP " + res.status);
  const body = await res.json();
  return body.models ?? [];
}

export async function getRecommend(ctx, { page, pageSize }) {
  const limit = Math.max(pageSize, 24);
  const arr = await fetchList(ctx, { limit, offset: (page - 1) * limit });
  const list = arr.map(mapRoom).filter((r) => !!r);
  return { list, hasMore: arr.length >= limit };
}

const PRESET_CATEGORIES = [
  { id: "livetab=female", name: "Female" },
  { id: "livetab=male", name: "Male" },
  { id: "livetab=couples", name: "Couples" },
  { id: "livetab=transsexual", name: "Trans" },
  { id: "tag=asian", name: "Asian" },
  { id: "tag=latin", name: "Latin" },
  { id: "tag=ebony", name: "Ebony" },
  { id: "tag=18-19", name: "Teen 18+" },
  { id: "tag=milf", name: "MILF" },
  { id: "tag=mature", name: "Mature" },
  { id: "tag=big-boobs", name: "Big Boobs" },
  { id: "tag=dance", name: "Dance" },
];

export async function getCategories(ctx) {
  return PRESET_CATEGORIES;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const [k, v] = categoryId.split("=");
  if (!k || !v) return { list: [], hasMore: false };
  const limit = 24;
  const arr = await fetchList(ctx, { [k]: v, limit, offset: (page - 1) * limit });
  const list = arr.map(mapRoom).filter((r) => !!r);
  return { list, hasMore: arr.length >= limit };
}

export async function search(ctx, { keyword, page }) {
  const arr = await fetchList(ctx, {
    tag: keyword.toLowerCase().replace(/\s+/g, "-"),
    limit: 30,
  });
  const list = arr.map(mapRoom).filter((r) => !!r);
  return { list, hasMore: false };
}

async function findRoomInListing(ctx, roomId) {
  try {
    const arr = await fetchList(ctx, { limit: 100 });
    return arr.find((r) => r.username === roomId) ?? null;
  } catch {
    return null;
  }
}

export async function getRoomDetail(ctx, { roomId }) {
  const r = await findRoomInListing(ctx, roomId);
  if (r) {
    const mapped = mapRoom(r);
    if (mapped) return mapped;
  }
  return {
    platform: "bongacams",
    roomId,
    title: roomId,
    uname: roomId,
    live: false,
    link: "https://bongacams.com/" + roomId,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  return !!(await findRoomInListing(ctx, roomId));
}

export async function resolve(ctx, { roomId }) {
  const amfUrl = "https://bongacams.com/tools/amf.php?method=getRoomData&args%5B%5D=" + encodeURIComponent(roomId) + "&args%5B%5D=false";
  const res = await ctx.fetch(amfUrl, {
    method: "GET",
    headers: COMMON_HEADERS,
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error("BongaCams HTTP " + res.status);
  const body = await res.json();
  if (body.status !== "success") {
    throw new Error("BongaCams 房间 " + roomId + " 不可访问 (status=" + body.status + ")");
  }
  if (!body.performerData?.isOnline) {
    throw new Error("BongaCams 房间 " + roomId + " 未开播");
  }
  if (body.performerData.showType && body.performerData.showType !== "public") {
    throw new Error("BongaCams " + roomId + " 当前为 " + body.performerData.showType + "（非公开）");
  }
  let videoHost = body.localData?.videoServerUrl ?? "";
  if (videoHost.startsWith("//")) videoHost = "https:" + videoHost;
  if (!videoHost) throw new Error("BongaCams 未返回 videoServerUrl");
  const url = videoHost.replace(/\/$/, "") + "/hls/stream_" + encodeURIComponent(roomId) + "/playlist.m3u8";
  return ctx.protocols.hlsStream({
    url,
    qn: "auto",
    qnLabel: "自适应",
    referer: REFERER,
    ua: UA,
  });
}
