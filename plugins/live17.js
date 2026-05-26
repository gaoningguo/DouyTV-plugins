/**
 * 17 Live (17.live) 直播插件
 * 协议: HLS (CDN flv → m3u8 重写)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://17.live/";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://17.live", Accept: "application/json, text/plain, */*", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" };

export const manifest = {
  id: "live17",
  label: "17 Live",
  version: "1.0.0",
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function normalizeImage(url) {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `https://cdn.17app.co/${url}`;
}

function mapStream(s) {
  const user = s.userInfo;
  const roomId = user?.userID ?? s.userID;
  if (!roomId) return undefined;
  return {
    platform: "live17",
    roomId,
    title: s.caption ?? user?.displayName ?? user?.openID ?? roomId,
    uname: user?.displayName ?? user?.openID ?? roomId,
    avatar: normalizeImage(user?.picture),
    cover: normalizeImage(s.thumbnail) ?? s.coverPhoto,
    online: s.liveViewerCount ?? s.viewerCount ?? 0,
    category: "17Live",
    live: s.status === 2,
    link: `https://17.live/live/${roomId}`,
  };
}

async function fetchCells(ctx, tab, count) {
  const qs = new URLSearchParams({ count: String(count ?? 20), cursor: "", paging: "1", region: "SG", tab: tab ?? "hot_opt" });
  const res = await ctx.fetch(`https://wap-api.17app.co/api/v1/cells?${qs.toString()}`, {
    headers: HEADERS, timeout: 25000, http2: true,
  });
  if (!res.ok) throw new Error(`17Live HTTP ${res.status}`);
  const data = await res.json();
  const list = [];
  for (const cell of data.cells ?? []) {
    if (cell.type !== 0 || !cell.stream) continue;
    const r = mapStream(cell.stream);
    if (r) list.push(r);
  }
  return { list, cursor: data.cursor, raw: data.cells ?? [] };
}

export async function getRecommend(ctx, { page, pageSize }) {
  if (page > 1) return { list: [], hasMore: false };
  const data = await fetchCells(ctx, "hot_opt", Math.max(pageSize, 20));
  return { list: data.list, hasMore: !!data.cursor };
}

export async function getCategories(ctx) {
  return [
    { id: "hot_opt", name: "热门" },
    { id: "nearby_opt", name: "附近" },
    { id: "follow_opt", name: "关注" },
  ];
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  if (page > 1) return { list: [], hasMore: false };
  const data = await fetchCells(ctx, categoryId, 20);
  return { list: data.list, hasMore: !!data.cursor };
}

export async function search(ctx, { keyword }) {
  const data = await fetchCells(ctx, "hot_opt", 50);
  const kw = keyword.toLowerCase();
  return {
    list: data.list.filter((r) => r.title?.toLowerCase().includes(kw) || r.uname?.toLowerCase().includes(kw)),
    hasMore: false,
  };
}

async function fetchRoom(ctx, roomId) {
  const res = await ctx.fetch("https://wap-api.17app.co/api/v1/cells?count=50&cursor=&paging=1&region=SG&tab=hot_opt", {
    headers: HEADERS, timeout: 25000, http2: true,
  });
  if (!res.ok) return null;
  const data = await res.json();
  for (const cell of data.cells ?? []) {
    if (cell.stream?.userInfo?.userID === roomId) return cell.stream;
  }
  return null;
}

export async function getRoomDetail(ctx, { roomId }) {
  const stream = await fetchRoom(ctx, roomId);
  if (!stream) throw new Error(`17Live 房间 ${roomId} 未找到`);
  const r = mapStream(stream);
  if (!r) throw new Error(`17Live 房间 ${roomId} 解析失败`);
  return r;
}

export async function getLiveStatus(ctx, { roomId }) {
  const stream = await fetchRoom(ctx, roomId);
  return stream?.status === 2;
}

function flvToHls(url) {
  if (url.includes("wansu")) return url.replace(".flv", "/playlist.m3u8");
  return url.replace("pull-rtmp", "pull-hls").replace(".flv", ".m3u8");
}

export async function resolve(ctx, { roomId }) {
  const stream = await fetchRoom(ctx, roomId);
  if (!stream) throw new Error(`17Live 房间 ${roomId} 未找到`);
  if (stream.status !== 2) throw new Error("17Live 未开播");
  const urls = stream.pullURLsInfo?.rtmpURLs ?? stream.rtmpUrls ?? [];
  if (urls.length === 0) throw new Error("17Live 未返回流地址");
  const best = urls.find((v) => !!v.urlQualityEnhancedHD) ?? urls[0];
  const flvUrl = best.urlQualityEnhancedHD ?? best.urlHighQuality ?? best.url ?? best.urlLowQuality;
  if (!flvUrl) throw new Error("17Live FLV 地址为空");
  const alternatives = urls.map((v) => {
    const u = v.urlQualityEnhancedHD ?? v.urlHighQuality ?? v.url;
    if (!u) return null;
    return { qn: String(v.provider ?? "auto"), label: `线路 ${v.provider ?? "auto"}`, url: flvToHls(u) };
  }).filter(Boolean);
  return ctx.protocols.hlsStream({
    url: flvToHls(flvUrl),
    qn: "origin",
    qnLabel: "原画",
    alternatives,
    referer: REFERER,
    ua: UA,
  });
}
