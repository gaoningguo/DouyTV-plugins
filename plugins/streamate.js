/**
 * Streamate 直播插件 —— 美国成人 cam 平台
 * 协议: HLS
 * API: https://member.naiadsystems.com/search/v3/performers
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://streamate.com/";
const SEARCH_API = "https://member.naiadsystems.com/search/v3/performers";
const MANIFEST_API = "https://manifest-server.naiadsystems.com/live";
const DUMMY_ID = "ffffffff-ffff-ffff-ffff-ffffffffffffG0000000000000";
const HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Accept: "application/json, text/plain, */*",
  platform: "SCP",
  smtid: DUMMY_ID,
  smeid: DUMMY_ID,
  smvid: DUMMY_ID,
};

export const manifest = {
  id: "streamate",
  label: "Streamate",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

const CATEGORIES = [
  { id: "anal", name: "Anal" },
  { id: "bigboobs", name: "Big Boobs" },
  { id: "bigbutt", name: "Big Butt" },
  { id: "milf", name: "MILF" },
  { id: "teen", name: "Teen" },
  { id: "asian", name: "Asian" },
  { id: "ebony", name: "Ebony" },
  { id: "latina", name: "Latina" },
  { id: "blonde", name: "Blonde" },
  { id: "brunette", name: "Brunette" },
  { id: "redhead", name: "Redhead" },
  { id: "lesbian", name: "Lesbian" },
  { id: "couples", name: "Couples" },
  { id: "feet", name: "Feet" },
  { id: "smoking", name: "Smoking" },
];

let listCache = [];

function mapPerformer(p) {
  if (!p.nickname) return undefined;
  return {
    platform: "streamate",
    roomId: p.nickname,
    title: p.nickname + (p.age ? ` (${p.age})` : ""),
    uname: p.nickname,
    cover: p.thumbnail || undefined,
    online: 0,
    category: (p.categoryName || []).join(", ") || undefined,
    live: p.online ?? true,
    link: `https://streamate.com/cam/${p.nickname}`,
    _hd: p.highDefinition,
    _country: p.country,
  };
}

async function fetchPerformers(ctx, { from = 0, size = 48, category } = {}) {
  let filters = "gender:f,ff,mf,tm2f,g;online:true";
  if (category) filters += `;category:${category}`;
  const params = new URLSearchParams({
    domain: "streamate.com",
    from: String(from),
    size: String(size),
    filters,
    genderSetting: "f",
  });
  const res = await ctx.fetch(`${SEARCH_API}?${params.toString()}`, {
    headers: HEADERS,
    timeout: 25000,
  });
  if (!res.ok) throw new Error(`Streamate HTTP ${res.status}`);
  const data = await res.json();
  return {
    performers: data.performers || [],
    total: data.totalResultCount || 0,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const size = Math.max(pageSize, 48);
  const from = (page - 1) * size;
  const { performers, total } = await fetchPerformers(ctx, { from, size });
  listCache = performers;
  const list = performers.map(mapPerformer).filter(Boolean);
  return { list, hasMore: from + size < total };
}

export async function search(ctx, { keyword }) {
  const kw = keyword.toLowerCase();
  // Fetch a large batch and filter locally
  let performers = listCache;
  if (!performers.length) {
    const result = await fetchPerformers(ctx, { from: 0, size: 200 });
    performers = result.performers;
    listCache = performers;
  }
  const filtered = performers.filter(
    (p) => (p.nickname || "").toLowerCase().includes(kw)
  );
  const list = filtered.map(mapPerformer).filter(Boolean);
  return { list, hasMore: false };
}

export async function getCategories(ctx) {
  return CATEGORIES;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const size = 48;
  const from = (page - 1) * size;
  const { performers, total } = await fetchPerformers(ctx, { from, size, category: categoryId });
  const list = performers.map(mapPerformer).filter(Boolean);
  return { list, hasMore: from + size < total };
}

export async function resolve(ctx, { roomId }) {
  const url = `${MANIFEST_API}/s:${encodeURIComponent(roomId)}.json?last=load&format=mp4-hls`;
  const res = await ctx.fetch(url, {
    headers: { "User-Agent": UA, Referer: REFERER },
    timeout: 20000,
  });
  if (!res.ok) throw new Error(`Streamate manifest HTTP ${res.status}`);
  const data = await res.json();
  const mp4hls = data.formats?.["mp4-hls"];
  if (!mp4hls || !mp4hls.encodings || mp4hls.encodings.length === 0) {
    throw new Error(`Streamate: ${roomId} 无可用 HLS 流`);
  }
  // Pick highest resolution
  const sorted = [...mp4hls.encodings].sort(
    (a, b) => (b.videoWidth || 0) - (a.videoWidth || 0)
  );
  const best = sorted[0];
  if (!best.location) throw new Error(`Streamate: ${roomId} HLS location 为空`);

  const alternatives = sorted
    .filter((e) => e.location)
    .map((e, i) => ({
      qn: `enc_${i}`,
      label: e.videoWidth && e.videoHeight ? `${e.videoWidth}x${e.videoHeight}` : `Stream ${i + 1}`,
      url: e.location,
    }));

  return ctx.protocols.hlsStream({
    url: best.location,
    qnLabel: alternatives[0]?.label || "Auto",
    alternatives: alternatives.length > 1 ? alternatives : undefined,
    referer: REFERER,
    ua: UA,
  });
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const url = `${MANIFEST_API}/s:${encodeURIComponent(roomId)}.json?last=load&format=mp4-hls`;
    const res = await ctx.fetch(url, {
      headers: { "User-Agent": UA, Referer: REFERER },
      timeout: 15000,
    });
    if (!res.ok) return false;
    const data = await res.json();
    const encodings = data.formats?.["mp4-hls"]?.encodings;
    return Array.isArray(encodings) && encodings.length > 0;
  } catch {
    return false;
  }
}
