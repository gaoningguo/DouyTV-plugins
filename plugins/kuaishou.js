/**
 * 快手直播插件
 * 协议: HLS / FLV (H.264 adaptationSet)
 * API: https://live.kuaishou.com/live_api/...
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://live.kuaishou.com/";
const COOKIE = `did=web_${randomHex(36)};clientid=3;kpf=PC_WEB;kpn=GAME_ZONE`;

const HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Accept: "application/json, text/plain, */*",
  Cookie: COOKIE,
};

const HTML_HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  Cookie: COOKIE,
};

function randomHex(len) {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function normalizeImage(url) {
  if (!url) return url;
  if (/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url)) return url;
  return url + ".jpg";
}

export const manifest = {
  id: "kuaishou",
  label: "快手",
  version: "1.0.0",
  defaultProxy: "direct",
  engine: { netliveApi: 1 },
};

function mapRoom(info) {
  const author = info.author || {};
  const game = info.gameInfo || {};
  return {
    platform: "kuaishou",
    roomId: author.id || "",
    title: author.description || author.name || "",
    uname: author.name || "",
    avatar: normalizeImage(author.avatar),
    cover: normalizeImage(game.poster || info.cover),
    online: info.watchingCount ?? 0,
    category: game.name,
    live: true,
    link: `https://live.kuaishou.com/u/${author.id}`,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const res = await ctx.fetch(
    `https://live.kuaishou.com/live_api/home/list`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (!res.ok) throw new Error(`快手 HTTP ${res.status}`);
  const data = await res.json();
  const items = data.data?.list || [];
  const rooms = [];
  for (const item of items) {
    const infos = item.gameLiveInfo || [];
    for (const gi of infos) {
      const lives = gi.liveInfo || [];
      for (const li of lives) {
        const r = mapRoom(li);
        if (r && r.roomId) rooms.push(r);
      }
    }
  }
  return { list: rooms, hasMore: false };
}

export async function getCategories(ctx) {
  return [
    { id: "1", name: "热门" },
    { id: "2", name: "网游" },
    { id: "3", name: "单机" },
    { id: "4", name: "手游" },
    { id: "5", name: "棋牌" },
    { id: "6", name: "娱乐" },
    { id: "7", name: "综合" },
    { id: "8", name: "文化" },
  ];
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  let url;
  // Short numeric IDs (1-8) use category/data, longer IDs use gameboard/list
  if (/^\d{1,2}$/.test(categoryId)) {
    url = `https://live.kuaishou.com/live_api/category/data?type=${categoryId}&page=${page}&size=30`;
  } else if (categoryId.length <= 10) {
    url = `https://live.kuaishou.com/live_api/gameboard/list?filterType=0&pageSize=20&gameId=${encodeURIComponent(categoryId)}&page=${page}`;
  } else {
    url = `https://live.kuaishou.com/live_api/non-gameboard/list?filterType=0&pageSize=20&gameId=${encodeURIComponent(categoryId)}&page=${page}`;
  }
  const res = await ctx.fetch(url, { headers: HEADERS, timeout: 25000 });
  if (!res.ok) throw new Error(`快手 HTTP ${res.status}`);
  const data = await res.json();
  const items = data.data?.list || data.data || [];
  const rooms = [];
  for (const item of items) {
    if (item.author) {
      const r = mapRoom(item);
      if (r && r.roomId) rooms.push(r);
    } else if (item.gameLiveInfo) {
      for (const gi of (Array.isArray(item.gameLiveInfo) ? item.gameLiveInfo : [item.gameLiveInfo])) {
        const lives = gi.liveInfo || [];
        for (const li of lives) {
          const r = mapRoom(li);
          if (r && r.roomId) rooms.push(r);
        }
      }
    }
  }
  return { list: rooms, hasMore: items.length >= 20 };
}

function extractInitialState(html) {
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|window\.)/,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/,
    /__INITIAL_STATE__\s*=\s*JSON\.parse\('([\s\S]*?)'\)/,
    /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (!m) continue;
    try {
      const raw = m[1].startsWith("{") ? m[1] : m[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
      return JSON.parse(raw);
    } catch { continue; }
  }
  return null;
}

async function fetchRoomHtml(ctx, roomId) {
  const res = await ctx.fetch(`https://live.kuaishou.com/u/${encodeURIComponent(roomId)}`, {
    headers: HTML_HEADERS,
    timeout: 25000,
  });
  if (!res.ok) throw new Error(`快手 HTTP ${res.status}`);
  const html = await res.text();
  const state = extractInitialState(html);
  if (!state) throw new Error("快手 未找到 __INITIAL_STATE__");
  return state;
}

export async function getRoomDetail(ctx, { roomId }) {
  const state = await fetchRoomHtml(ctx, roomId);
  const liveroom = state.liveroom || state.liveRoom || {};
  const playList = liveroom.playList || [];
  const stream = playList[0]?.liveStream || {};
  const author = stream.user || liveroom.author || {};
  return {
    platform: "kuaishou",
    roomId,
    title: stream.caption || liveroom.title || author.user_name || roomId,
    uname: author.user_name || author.name || roomId,
    avatar: normalizeImage(author.headurl || author.avatar),
    cover: normalizeImage(stream.coverUrl || liveroom.cover),
    online: stream.watchingCount ?? liveroom.watchingCount ?? 0,
    category: stream.gameInfo?.name || liveroom.gameName,
    live: !!stream.playUrls,
    link: `https://live.kuaishou.com/u/${roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const state = await fetchRoomHtml(ctx, roomId);
    const liveroom = state.liveroom || state.liveRoom || {};
    const playList = liveroom.playList || [];
    const stream = playList[0]?.liveStream || {};
    return !!stream.playUrls;
  } catch {
    return false;
  }
}

export async function resolve(ctx, { roomId }) {
  const state = await fetchRoomHtml(ctx, roomId);
  const liveroom = state.liveroom || state.liveRoom || {};
  const playList = liveroom.playList || [];
  const stream = playList[0]?.liveStream || {};
  const playUrls = stream.playUrls;
  if (!playUrls) throw new Error(`快手 主播 ${roomId} 未在直播`);

  // Parse h264 adaptationSet representations
  const h264 = playUrls.h264 || playUrls.H264 || {};
  const adaptationSet = h264.adaptationSet || {};
  const representations = adaptationSet.representation || [];

  if (representations.length === 0) throw new Error("快手 未返回可用流");

  // Sort by level descending (higher = better quality)
  const sorted = [...representations].sort((a, b) => (b.level || 0) - (a.level || 0));
  const best = sorted[0];

  const alternatives = sorted.map((r) => ({
    qn: r.name || String(r.level || 0),
    label: r.name || `${r.level}`,
    url: r.url,
  }));

  // Determine protocol from URL
  const bestUrl = best.url || "";
  if (bestUrl.includes(".flv") || bestUrl.includes("/flv/")) {
    return ctx.protocols.flvStream({
      url: bestUrl,
      qn: best.name || "original",
      qnLabel: best.name || "原画",
      alternatives: alternatives.length > 1 ? alternatives : undefined,
      referer: REFERER,
      ua: UA,
    });
  }

  return ctx.protocols.hlsStream({
    url: bestUrl,
    qn: best.name || "original",
    qnLabel: best.name || "原画",
    alternatives: alternatives.length > 1 ? alternatives : undefined,
    referer: REFERER,
    ua: UA,
  });
}
