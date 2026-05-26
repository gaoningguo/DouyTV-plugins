/**
 * Pandalive 直播插件 —— 韩国 BJ 平台
 * 协议: HLS (AWS IVS)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.pandalive.co.kr/";
const API = "https://api.pandalive.co.kr";
const HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Origin: "https://www.pandalive.co.kr",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  Accept: "application/json, text/plain, */*",
  "X-Device-Info": JSON.stringify({ t: "webPc", v: "1.0", ui: "0", ck: { sessKeyAsp: "" } }),
};

export const manifest = {
  id: "pandalive",
  label: "PandaTV (韩国 BJ)",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function mapRoom(r) {
  if (!r.userId) return undefined;
  return {
    platform: "pandalive",
    roomId: r.userId,
    title: r.title || r.userNick || r.userId,
    uname: r.userNick || r.userId,
    avatar: r.userImg,
    cover: r.thumbUrl,
    online: r.user ?? 0,
    category: r.isAdult ? "19+" : r.category,
    live: r.isLive ?? true,
    link: `https://www.pandalive.co.kr/live/play/${r.userId}`,
  };
}

async function getJson(ctx, path, params) {
  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
  const res = await ctx.fetch(`${API}${path}?${qs}`, { headers: HEADERS, timeout: 25000, http2: true });
  if (!res.ok) {
    if (res.status === 403 || res.status === 503) throw new Error(`[LIST_UNSUPPORTED]Pandalive HTTP ${res.status},需配置代理`);
    throw new Error(`Pandalive HTTP ${res.status}`);
  }
  return res.json();
}

async function postForm(ctx, path, body) {
  const form = Object.entries(body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const res = await ctx.fetch(`${API}${path}`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error(`Pandalive HTTP ${res.status}`);
  return res.json();
}

export async function getRecommend(ctx, { page, pageSize }) {
  const limit = Math.max(pageSize, 24);
  const offset = (page - 1) * limit;
  const data = await getJson(ctx, "/v1/live/index", { orderBy: "user", onlyNewBj: "N", limit, offset });
  if (data.result === false) throw new Error(`[LIST_UNSUPPORTED]Pandalive: ${data.errorData?.message || "代理 IP 被风控"}`);
  const arr = data.list ?? [];
  const pg = data.page;
  const hasMore = pg ? (pg.page ?? page) < (pg.lastPage ?? 0) : arr.length >= limit;
  return { list: arr.map(mapRoom).filter(Boolean), hasMore };
}

export async function getCategories(ctx) {
  return [
    { id: "user", name: "人气" },
    { id: "newBj", name: "新人" },
    { id: "bookmark", name: "收藏多" },
    { id: "adult", name: "19+" },
  ];
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const isAdult = categoryId === "adult";
  const orderBy = isAdult ? "user" : categoryId;
  const params = { orderBy, onlyNewBj: "N", limit: 24, offset: (page - 1) * 24 };
  if (isAdult) params.isAdult = true;
  const data = await getJson(ctx, "/v1/live/index", params);
  if (data.result === false) throw new Error(`[LIST_UNSUPPORTED]Pandalive: ${data.errorData?.message || "风控"}`);
  const arr = data.list ?? [];
  return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length >= 24 };
}

export async function search(ctx, { keyword }) {
  try {
    const res = await ctx.fetch(`${API}/v1/live/bj_list`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, orderBy: "user", onlyNewBj: "N", limit: 30, offset: 0 }),
      timeout: 25000,
      http2: true,
    });
    if (!res.ok) return { list: [], hasMore: false };
    const data = await res.json();
    return { list: (data.list ?? []).map(mapRoom).filter(Boolean), hasMore: false };
  } catch { return { list: [], hasMore: false }; }
}

export async function getRoomDetail(ctx, { roomId }) {
  const data = await postForm(ctx, "/v1/live/play", { userId: roomId, action: "watch", password: "", shareLinkType: "" });
  if (!data.media) throw new Error(`Pandalive ${roomId} 未找到`);
  const m = data.media;
  return {
    platform: "pandalive",
    roomId,
    title: m.title || m.userNick || roomId,
    uname: m.userNick,
    avatar: m.userImg,
    cover: m.thumbUrl,
    online: m.user ?? 0,
    category: m.isAdult ? "19+" : m.category,
    live: m.isLive ?? true,
    link: `https://www.pandalive.co.kr/live/play/${roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const data = await postForm(ctx, "/v1/live/play", { userId: roomId, action: "watch", password: "", shareLinkType: "" });
    return !!data.media?.isLive;
  } catch { return false; }
}

export async function resolve(ctx, { roomId }) {
  const data = await postForm(ctx, "/v1/live/play", { userId: roomId, action: "watch", password: "", shareLinkType: "" });
  if (data.errorData?.code) {
    const c = data.errorData.code;
    if (c === "needAdult" || c === "needLogin") throw new Error("Pandalive 该房间需登录 + 19+ 年龄验证");
    if (c === "needPw") throw new Error("Pandalive 该房间已加密");
    throw new Error(`Pandalive 拉流失败: ${data.errorData.message ?? c}`);
  }
  const pl = data.PlayList;
  const url = pl?.hls3?.[0]?.url || pl?.hls2?.[0]?.url || pl?.hls?.[0]?.url;
  if (!url) throw new Error("Pandalive 未返回 hls URL");
  const alts = [
    ...(pl?.hls3 ?? []).map((x, i) => ({ qn: `hls3_${i}`, label: x.name ?? "原画", url: x.url })),
    ...(pl?.hls2 ?? []).map((x, i) => ({ qn: `hls2_${i}`, label: x.name ?? "标清", url: x.url })),
    ...(pl?.hls ?? []).map((x, i) => ({ qn: `hls_${i}`, label: x.name ?? "兼容", url: x.url })),
  ].filter((a) => a.url);
  return ctx.protocols.hlsStream({
    url,
    qnLabel: "原画",
    alternatives: alts.length > 1 ? alts : undefined,
    referer: REFERER,
    ua: UA,
  });
}
