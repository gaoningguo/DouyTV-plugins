/**
 * 网易 CC 直播插件
 * 协议: HLS (m3u8 + CDN quality variants)
 * API: https://cc.163.com/api/...
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://cc.163.com/";
const HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Accept: "application/json, text/plain, */*",
};

const CDN_PRIORITY = ["hs", "ks", "ali", "fws", "wy"];

export const manifest = {
  id: "cc",
  label: "网易 CC",
  version: "1.0.0",
  defaultProxy: "direct",
  engine: { netliveApi: 1 },
};

function mapRoom(r) {
  if (!r.cuteid) return undefined;
  return {
    platform: "cc",
    roomId: String(r.cuteid),
    title: r.title || r.nickname || String(r.cuteid),
    uname: r.nickname || String(r.cuteid),
    avatar: r.portrait || r.purl,
    cover: r.cover || r.purl,
    online: r.vision_visitor ?? r.visitor ?? 0,
    category: r.game_name || r.gamename,
    live: true,
    link: `https://cc.163.com/${r.cuteid}`,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const size = Math.max(pageSize, 20);
  const offset = (page - 1) * size;
  const res = await ctx.fetch(
    `https://cc.163.com/api/category/live/?format=json&start=${offset}&size=${size}`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (!res.ok) throw new Error(`CC HTTP ${res.status}`);
  const data = await res.json();
  const lives = data.lives || [];
  return { list: lives.map(mapRoom).filter(Boolean), hasMore: lives.length >= size };
}

export async function getCategories(ctx) {
  const res = await ctx.fetch(
    `https://cc.163.com/category/?format=json`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (!res.ok) throw new Error(`CC HTTP ${res.status}`);
  const data = await res.json();
  const gameList = data.game_list || [];
  const categories = [];
  const parents = [
    { id: "all", name: "全部" },
    { id: "pc_game", name: "端游" },
    { id: "mobile_game", name: "手游" },
    { id: "other", name: "其他" },
  ];
  for (const p of parents) {
    categories.push({ id: p.id, name: p.name, children: [] });
  }
  for (const g of gameList) {
    categories.push({
      id: String(g.gametype),
      name: g.gamename || g.game_tag || String(g.gametype),
      cover: g.img,
    });
  }
  return categories;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const res = await ctx.fetch(
    `https://cc.163.com/_next/data/nextjs/category/${encodeURIComponent(categoryId)}.json`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (!res.ok) throw new Error(`CC HTTP ${res.status}`);
  const data = await res.json();
  const lives = data.pageProps?.gametypeData?.lives || [];
  return { list: lives.map(mapRoom).filter(Boolean), hasMore: false };
}

export async function search(ctx, { keyword, page }) {
  const p = page || 1;
  const res = await ctx.fetch(
    `https://cc.163.com/search/anchor?query=${encodeURIComponent(keyword)}&size=20&page=${p}`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (!res.ok) return { list: [], hasMore: false };
  const data = await res.json();
  const results = data.webcc_anchor?.result || [];
  const list = results.map((r) => ({
    platform: "cc",
    roomId: String(r.cuteid),
    title: r.title || r.nickname || String(r.cuteid),
    uname: r.nickname || String(r.cuteid),
    avatar: r.portrait,
    cover: r.portrait,
    online: r.follower_num ?? 0,
    category: r.game_name,
    live: r.status === 1 || r.status === "1",
    link: `https://cc.163.com/${r.cuteid}`,
  })).filter((r) => r.roomId);
  return { list, hasMore: results.length >= 20 };
}

async function fetchChannelInfo(ctx, roomId) {
  // Try multiple endpoints for room info
  const endpoints = [
    `https://cc.163.com/live/channel/?channelids=${encodeURIComponent(roomId)}`,
    `https://api.cc.163.com/v1/activitylives/anchor/lives?anchor_ccid=${encodeURIComponent(roomId)}`,
  ];

  // First try direct channel API
  try {
    const chRes = await ctx.fetch(
      `https://cc.163.com/live/channel/?channelids=${encodeURIComponent(roomId)}`,
      { headers: HEADERS, timeout: 25000 }
    );
    if (chRes.ok) {
      const chData = await chRes.json();
      const channel = chData.data?.[0] || chData.data?.[roomId];
      if (channel) return channel;
    }
  } catch {}

  // Fallback: fetch room page HTML and extract data
  try {
    const pageRes = await ctx.fetch(`https://cc.163.com/${roomId}`, {
      headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      timeout: 25000,
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const m = html.match(/window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/) ||
        html.match(/"props"\s*:\s*(\{[\s\S]*?"channelInfo"[\s\S]*?\})\s*[,}]/);
      if (m) {
        try {
          const nextData = JSON.parse(m[1]);
          const channelInfo = nextData?.props?.pageProps?.roomInfoInitData?.live?.channelInfo ||
            nextData?.props?.pageProps?.channelInfo;
          if (channelInfo) return channelInfo;
        } catch {}
      }
      // Try extracting m3u8 directly from page
      const m3u8Match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);
      if (m3u8Match) {
        return { m3u8: m3u8Match[1], title: roomId, nickname: roomId, status: 1 };
      }
    }
  } catch {}

  throw new Error(`CC 房间 ${roomId} 未找到或未开播`);
}

export async function getRoomDetail(ctx, { roomId }) {
  const ch = await fetchChannelInfo(ctx, roomId);
  return {
    platform: "cc",
    roomId,
    title: ch.title || ch.nickname || roomId,
    uname: ch.nickname || roomId,
    avatar: ch.purl,
    cover: ch.cover || ch.purl,
    online: ch.visitor ?? 0,
    category: ch.gamename || ch.game_name,
    live: ch.status === 1 || ch.status === "1",
    link: `https://cc.163.com/${roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const ch = await fetchChannelInfo(ctx, roomId);
    return ch.status === 1 || ch.status === "1";
  } catch {
    return false;
  }
}

export async function resolve(ctx, { roomId }) {
  const ch = await fetchChannelInfo(ctx, roomId);
  if (ch.status !== 1 && ch.status !== "1") throw new Error(`CC 主播 ${roomId} 未在直播`);

  const m3u8Base = ch.m3u8;
  if (!m3u8Base) throw new Error("CC 未返回 m3u8 地址");

  const quickplay = ch.quickplay || {};
  const streamList = ch.stream_list || quickplay;

  // Build alternatives from quality keys
  const qualityOrder = ["blueray", "original", "high", "medium"];
  const alternatives = [];

  for (const qName of qualityOrder) {
    const qData = streamList[qName] || quickplay[qName];
    if (!qData) continue;

    // Find best CDN line
    let tail = null;
    for (const cdn of CDN_PRIORITY) {
      if (qData[cdn]) {
        tail = qData[cdn];
        break;
      }
    }
    // Fallback: pick first available CDN
    if (!tail) {
      const keys = Object.keys(qData).filter((k) => typeof qData[k] === "string" && qData[k].length > 0);
      if (keys.length > 0) tail = qData[keys[0]];
    }
    if (!tail) continue;

    const url = m3u8Base + (tail.startsWith("&") ? tail : "&" + tail);
    const labelMap = { blueray: "蓝光", original: "原画", high: "高清", medium: "标清" };
    alternatives.push({
      qn: qName,
      label: labelMap[qName] || qName,
      url,
    });
  }

  // Use best available or fallback to raw m3u8
  const bestUrl = alternatives.length > 0 ? alternatives[0].url : m3u8Base;
  const bestLabel = alternatives.length > 0 ? alternatives[0].label : "原画";
  const bestQn = alternatives.length > 0 ? alternatives[0].qn : "original";

  return ctx.protocols.hlsStream({
    url: bestUrl,
    qn: bestQn,
    qnLabel: bestLabel,
    alternatives: alternatives.length > 1 ? alternatives : undefined,
    referer: REFERER,
    ua: UA,
  });
}
