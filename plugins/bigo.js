/**
 * Bigo Live (www.bigo.tv) 直播插件
 * 协议: HLS / FLV
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.bigo.tv/";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://www.bigo.tv", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };
const HTML_HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" };

export const manifest = {
  id: "bigo",
  label: "Bigo Live",
  version: "1.0.0",
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function mapRoom(r) {
  const id = r.bigo_id ?? r.uid ?? r.alias ?? r.room_id;
  if (id === undefined || id === null) return undefined;
  const slug = String(id);
  return {
    platform: "bigo",
    roomId: slug,
    title: r.room_topic ?? r.nick_name ?? r.user_name ?? r.alias ?? slug,
    uname: r.nick_name ?? r.user_name ?? r.alias ?? slug,
    avatar: r.avatar_url ?? r.avatar ?? r.data1,
    cover: r.cover_l ?? r.cover_m ?? r.big_url ?? r.cover_url ?? r.pic ?? r.data2?.bigUrl,
    online: r.user_count ?? r.audience ?? 0,
    category: r.tag ?? r.country ?? r.language,
    live: true,
    link: `https://www.bigo.tv/${slug}`,
  };
}

async function getJson(ctx, url) {
  const res = await ctx.fetch(url, { headers: HEADERS, timeout: 25000 });
  if (!res.ok) throw new Error(`Bigo HTTP ${res.status}`);
  return res.json();
}

async function postJson(ctx, url, body) {
  const res = await ctx.fetch(url, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeout: 25000,
    
  });
  if (!res.ok) throw new Error(`Bigo HTTP ${res.status}`);
  return res.json();
}

export async function getRecommend(ctx, { pageSize }) {
  const limit = Math.max(pageSize, 24);
  const url = `https://ta.bigo.tv/official_website/OInterfaceWeb/vedioList/5?fetchNum=${limit}`;
  try {
    const data = await getJson(ctx, url);
    const arr = data?.data?.data ?? data?.data?.list ?? data?.data?.rooms ?? [];
    if (!Array.isArray(arr)) throw new Error("[LIST_UNSUPPORTED]Bigo 返回 data 不是数组");
    return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length >= limit };
  } catch (e) {
    throw new Error(`[LIST_UNSUPPORTED]Bigo: ${e.message}`);
  }
}

export async function getCategories(ctx) {
  return [
    { id: "0", name: "热门" },
    { id: "1", name: "热舞" },
    { id: "2", name: "颜值" },
    { id: "3", name: "唱见" },
    { id: "4", name: "脱口秀" },
    { id: "5", name: "派对" },
    { id: "6", name: "户外" },
    { id: "7", name: "游戏" },
  ];
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const limit = 24;
  const candidates = [
    `https://www.bigo.tv/oapi/v3/getNewListV2?page=${page}&size=${limit}&tabId=${encodeURIComponent(categoryId)}`,
    `https://ta.bigo.tv/official_website/studio/getNewListV3?page=${page}&pageSize=${limit}&tabId=${encodeURIComponent(categoryId)}`,
  ];
  for (const url of candidates) {
    try {
      const data = await getJson(ctx, url);
      const arr = data?.data?.data ?? data?.data?.list ?? data?.data?.rooms ?? [];
      if (Array.isArray(arr) && arr.length > 0) {
        return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length >= limit };
      }
    } catch {}
  }
  if (page === 1) return getRecommend(ctx, { pageSize: limit });
  return { list: [], hasMore: false };
}

export async function search(ctx, { keyword }) {
  try {
    const data = await postJson(ctx, "https://ta.bigo.tv/official_website/studio/getSearchInfo", {
      keyword, page: 1, size: 30,
    });
    const arr = data.data?.list ?? data.data?.users ?? [];
    return { list: arr.map(mapRoom).filter(Boolean), hasMore: false };
  } catch { return { list: [], hasMore: false }; }
}

function extractInitState(html) {
  const m = html.match(/window\.__INIT_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/) ||
    html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

async function fetchPlayInfo(ctx, roomId) {
  const url = `https://ta.bigo.tv/official_website/studio/getInternalStudioInfo?siteId=${encodeURIComponent(roomId)}&verify=`;
  try {
    const res = await ctx.fetch(url, {
      method: "POST",
      headers: { ...HEADERS, "Content-Length": "0" },
      timeout: 25000,
      
    });
    if (!res.ok) throw new Error(`Bigo HTTP ${res.status}`);
    return res.json();
  } catch {
    const r = await ctx.fetch(`https://www.bigo.tv/${roomId}`, { headers: HTML_HEADERS, timeout: 25000 });
    if (!r.ok) throw new Error(`Bigo HTTP ${r.status}`);
    const html = await r.text();
    const state = extractInitState(html);
    const ui = state?.pageStore?.userInfoStore?.userInfo;
    if (!ui) throw new Error("Bigo 房间数据缺失");
    return {
      data: {
        hls_src: ui.live?.hls,
        big_url: ui.big_url ?? ui.cover_url,
        room_topic: ui.room_topic,
        nick_name: ui.nick_name,
        user_count: ui.user_count,
        avatar: ui.avatar_url,
      },
    };
  }
}

export async function getRoomDetail(ctx, { roomId }) {
  const info = await fetchPlayInfo(ctx, roomId);
  const d = info.data;
  if (!d) throw new Error(`Bigo 房间 ${roomId} 未找到`);
  return {
    platform: "bigo",
    roomId,
    title: d.roomTopic ?? d.room_topic ?? d.nick_name ?? roomId,
    uname: d.nick_name,
    avatar: d.avatar,
    cover: d.big_url,
    online: d.user_count ?? 0,
    category: d.gameTitle,
    live: !!(d.hls_src ?? d.hls_url),
    link: `https://www.bigo.tv/${roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const info = await fetchPlayInfo(ctx, roomId);
    return !!(info.data?.hls_src ?? info.data?.hls_url);
  } catch { return false; }
}

export async function resolve(ctx, { roomId }) {
  const info = await fetchPlayInfo(ctx, roomId);
  const d = info.data;
  if (!d) throw new Error(`Bigo 房间 ${roomId} 未找到`);
  const url = d.hls_src ?? d.hls_url ?? d.flv_url ?? d.rtmp_url;
  if (!url) throw new Error("Bigo 未开播");
  if (url.includes(".flv")) return ctx.protocols.flvStream({ url, qn: "auto", qnLabel: "原画", referer: REFERER, ua: UA });
  return ctx.protocols.hlsStream({ url, qn: "auto", qnLabel: "原画", referer: REFERER, ua: UA });
}
