/**
 * Chaturbate 直播插件
 * 协议: HLS (从房间 HTML 提取 hls_source)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
const REFERER = "https://chaturbate.com/";
const API = "https://chaturbate.com/api/ts/roomlist/room-list/";
const HEADERS = {
  "User-Agent": UA,
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "application/json, text/plain, */*",
  Referer: REFERER,
  Origin: "https://chaturbate.com",
  "X-Requested-With": "XMLHttpRequest",
};

export const manifest = {
  id: "chaturbate",
  label: "Chaturbate",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function mapRoom(r) {
  if (!r.username) return undefined;
  return {
    platform: "chaturbate",
    roomId: r.username,
    title: r.room_subject || r.current_show || r.display_name || r.username,
    uname: r.display_name || r.username,
    cover: r.image_url_360x270 || r.image_url || r.img,
    online: r.num_users ?? 0,
    category: r.tags?.[0] || r.gender,
    introduction: r.spoken_languages ? `${r.gender ?? "—"} · ${r.location ?? "—"} · ${r.spoken_languages}` : undefined,
    live: true,
    link: `https://chaturbate.com/${r.username}/`,
  };
}

async function fetchList(ctx, params) {
  const url = new URL(API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await ctx.fetch(url.toString(), { headers: HEADERS, timeout: 25000, http2: true });
  if (!res.ok) {
    if (res.status === 403 || res.status === 503) throw new Error(`[LIST_UNSUPPORTED]Chaturbate Cloudflare HTTP ${res.status} 拦截,请配置代理`);
    throw new Error(`Chaturbate HTTP ${res.status}`);
  }
  const body = await res.json();
  return body.rooms ?? body.results ?? [];
}

export async function getRecommend(ctx, { page, pageSize }) {
  const limit = Math.max(pageSize, 30);
  const rooms = await fetchList(ctx, { limit, offset: (page - 1) * limit });
  return { list: rooms.map(mapRoom).filter(Boolean), hasMore: rooms.length >= limit };
}

export async function getCategories(ctx) {
  return [
    { id: "genders=f", name: "Female" },
    { id: "genders=m", name: "Male" },
    { id: "genders=c", name: "Couples" },
    { id: "genders=t", name: "Trans" },
    { id: "tags=asian", name: "Asian" },
    { id: "tags=latina", name: "Latina" },
    { id: "tags=ebony", name: "Ebony" },
    { id: "tags=teen18", name: "18+" },
    { id: "tags=milf", name: "MILF" },
    { id: "tags=mature", name: "Mature" },
    { id: "tags=bigboobs", name: "Big Boobs" },
    { id: "tags=anal", name: "Anal" },
    { id: "tags=squirt", name: "Squirt" },
    { id: "tags=dance", name: "Dance" },
  ];
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const [k, v] = categoryId.split("=");
  if (!k || !v) return { list: [], hasMore: false };
  const limit = 30;
  const rooms = await fetchList(ctx, { [k]: v, limit, offset: (page - 1) * limit });
  return { list: rooms.map(mapRoom).filter(Boolean), hasMore: rooms.length >= limit };
}

export async function search(ctx, { keyword }) {
  const rooms = await fetchList(ctx, { tags: keyword.toLowerCase().replace(/\s+/g, ""), limit: 30 });
  return { list: rooms.map(mapRoom).filter(Boolean), hasMore: false };
}

export async function getRoomDetail(ctx, { roomId }) {
  const rooms = await fetchList(ctx, { limit: 100 }).catch(() => []);
  const hit = rooms.find((r) => r.username === roomId);
  if (hit) return mapRoom(hit);
  return { platform: "chaturbate", roomId, title: roomId, uname: roomId, live: false, link: `https://chaturbate.com/${roomId}/` };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const rooms = await fetchList(ctx, { limit: 100 });
    return rooms.some((r) => r.username === roomId);
  } catch { return false; }
}

export async function resolve(ctx, { roomId }) {
  const res = await ctx.fetch(`https://chaturbate.com/${roomId}/`, {
    headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error(`Chaturbate HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/window\.initialRoomDossier\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("Chaturbate 未找到 initialRoomDossier");
  let dossier;
  try {
    dossier = JSON.parse(JSON.parse('"' + m[1] + '"'));
  } catch (e) {
    throw new Error(`Chaturbate dossier 解析失败: ${e.message}`);
  }
  if (dossier.room_status && dossier.room_status !== "public") throw new Error(`Chaturbate 房间状态 ${dossier.room_status}`);
  if (!dossier.hls_source) throw new Error("Chaturbate 未开播");
  return ctx.protocols.hlsStream({ url: dossier.hls_source, referer: REFERER, ua: UA });
}
