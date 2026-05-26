/**
 * Trovo 直播插件 —— GraphQL API
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://trovo.live/";
const HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Origin: "https://trovo.live",
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "identity",
};

export const manifest = {
  id: "trovo",
  label: "Trovo",
  version: "1.0.0",
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function qid() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function gql(ctx, body, qidStr) {
  const url = `https://api-web.trovo.live/graphql?qid=${qidStr || qid()}`;
  const res = await ctx.fetch(url, { method: "POST", headers: HEADERS, body: JSON.stringify(body), timeout: 25000, http2: true });
  if (!res.ok) throw new Error(`Trovo HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error("Trovo 空响应");
  return JSON.parse(text);
}

function mapFeed(item) {
  const live = item.liveInfo;
  if (!live) return undefined;
  const slug = live.userInfo?.userName;
  if (!slug) return undefined;
  return {
    platform: "trovo",
    roomId: slug,
    title: live.channelInfo?.title || live.programInfo?.title || live.userInfo?.nickName || slug,
    uname: live.userInfo?.nickName || slug,
    avatar: live.userInfo?.faceUrl,
    cover: live.programInfo?.coverUrl,
    online: live.channelInfo?.viewers ?? 0,
    category: live.categoryInfo?.shortName || live.categoryInfo?.name,
    live: true,
    link: `https://trovo.live/s/${slug}`,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const limit = Math.max(pageSize, 20);
  const offset = Math.max(0, (page - 1) * limit);
  const arr = await gql(ctx, [{
    operationName: "live_PcHomePageV2Service_GetPcMoreFeeds",
    variables: { params: { pageSize: limit, currPage: page, offset } },
  }]);
  const feeds = arr?.[0]?.data?.live_PcHomePageV2Service_GetPcMoreFeeds?.feeds?.feeds ?? [];
  return { list: feeds.map(mapFeed).filter(Boolean), hasMore: feeds.length >= limit };
}

export async function getCategories(ctx) {
  return [
    { id: "Just Chatting", name: "聊天" },
    { id: "Music", name: "音乐" },
    { id: "PUBG", name: "PUBG" },
    { id: "VALORANT", name: "Valorant" },
    { id: "Minecraft", name: "Minecraft" },
    { id: "League of Legends", name: "LoL" },
    { id: "CS2", name: "CS2" },
    { id: "GTA V", name: "GTA V" },
  ];
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  return search(ctx, { keyword: categoryId, page });
}

export async function search(ctx, { keyword, page }) {
  const pageSize = 20;
  const offset = Math.max(0, (page - 1) * pageSize);
  const arr = await gql(ctx, [{
    operationName: "search_SearchService_Search",
    variables: { params: { query: keyword, limit: pageSize, offset } },
  }]);
  const streamers = arr?.[0]?.data?.search_SearchService_Search?.streamerData?.streamerInfos ?? [];
  const list = [];
  const seen = new Set();
  for (const s of streamers) {
    const slug = s.userInfo?.userName;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    list.push({
      platform: "trovo",
      roomId: slug,
      title: s.programInfo?.title || s.userInfo?.nickName || slug,
      uname: s.userInfo?.nickName || slug,
      avatar: s.userInfo?.faceUrl,
      cover: s.programInfo?.coverUrl,
      online: s.channelInfo?.viewers ?? 0,
      category: s.categoryInfo?.shortName || s.categoryInfo?.name,
      live: s.isLive === 1,
      link: `https://trovo.live/s/${slug}`,
    });
  }
  return { list, hasMore: streamers.length >= pageSize };
}

async function fetchLive(ctx, userName) {
  const arr = await gql(ctx, [{ operationName: "live_LiveReaderService_GetLiveInfo", variables: { params: { userName } } }]);
  const env = arr?.[0];
  if (env?.errors?.length) throw new Error(env.errors.map((e) => e.message).join("; "));
  return env?.data?.live_LiveReaderService_GetLiveInfo ?? null;
}

export async function getRoomDetail(ctx, { roomId }) {
  const g = await fetchLive(ctx, roomId);
  if (!g) throw new Error(`Trovo 房间 ${roomId} 未找到`);
  return {
    platform: "trovo",
    roomId,
    title: g.programInfo?.title || roomId,
    uname: g.streamerInfo?.nickName || roomId,
    avatar: g.streamerInfo?.faceUrl,
    cover: g.programInfo?.coverUrl,
    online: g.watchedNum ?? 0,
    category: g.categoryInfo?.shortName || g.categoryInfo?.name,
    live: g.isLive === 1,
    link: `https://trovo.live/s/${roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try { const g = await fetchLive(ctx, roomId); return g?.isLive === 1; } catch { return false; }
}

export async function resolve(ctx, { roomId }) {
  const g = await fetchLive(ctx, roomId);
  if (!g) throw new Error(`Trovo 房间 ${roomId} 未找到`);
  if (g.isLive !== 1) throw new Error("Trovo 未开播");
  const streams = g.programInfo?.streamInfo ?? [];
  const variants = streams
    .filter((s) => !!s.playUrl)
    .map((s) => {
      let url = s.playUrl;
      if (url.startsWith("//")) url = `https:${url}`;
      url = url.replace(".flv?", ".m3u8?");
      return { qn: s.desc || String(s.bitrate ?? 0), label: s.desc || `${s.bitrate ?? 0}kbps`, bitrate: s.bitrate ?? 0, url };
    })
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  if (variants.length === 0) throw new Error("Trovo 无可用流");
  const best = variants[0];
  return ctx.protocols.hlsStream({
    url: best.url,
    qn: best.qn,
    qnLabel: best.label,
    alternatives: variants.length > 1 ? variants.map((v) => ({ qn: v.qn, label: v.label, url: v.url })) : undefined,
    referer: REFERER,
    ua: UA,
  });
}
