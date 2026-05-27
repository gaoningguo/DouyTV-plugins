/**
 * 网易 CC 直播 plugin —— 移植自 pure_live。
 */

export const manifest = {
  id: "cc",
  label: "网易CC直播",
  version: "1.0.0",
  engine: { netliveApi: 1 },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const HEADERS_BASE = {
  "User-Agent": UA,
  Referer: "https://cc.163.com/",
};

async function fetchJson(ctx, url) {
  const res = await ctx.fetch(url, {
    method: "GET",
    headers: HEADERS_BASE,
    timeout: 20000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

/* ─────────────── 推荐 ─────────────── */

function parseWatching(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return v;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}

function mapLive(item, watchKey) {
  if (item.cuteid === undefined || item.cuteid === null) return undefined;
  const rid = String(item.cuteid);
  return {
    platform: "cc",
    roomId: rid,
    title: item.title ?? "",
    cover: item.cover,
    uname: item.nickname,
    avatar: item.purl,
    online: parseWatching(item[watchKey]),
    category: item.game_name ?? "",
    live: true,
    link: `https://cc.163.com/${rid}`,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const start = (page - 1) * 20;
  const data = await fetchJson(ctx,
    `https://cc.163.com/api/category/live/?format=json&start=${start}&size=20`
  );
  const items = data.lives ?? [];
  const list = items
    .map((i) => mapLive(i, "vision_visitor"))
    .filter((r) => !!r);
  return { list, hasMore: items.length >= 20 };
}

/* ─────────────── 分类 ─────────────── */

const PARENT_CATS = [
  { id: "1", name: "全部" },
  { id: "2", name: "端游", tag: "pc_game" },
  { id: "4", name: "手游", tag: "mobile_game" },
  { id: "5", name: "其他", tag: "other" },
];

export async function getCategories(ctx) {
  const data = await fetchJson(ctx,
    "https://cc.163.com/category/?format=json"
  );
  const all = data.game_list ?? [];
  const out = [];
  for (const parent of PARENT_CATS) {
    const filtered = parent.tag
      ? all.filter((g) => g.game_tag === parent.tag)
      : all;
    for (const g of filtered) {
      if (g.gametype === undefined || g.gametype === null) continue;
      out.push({
        id: String(g.gametype),
        name: g.gamename ?? "",
        cover: g.img,
        parent: parent.name,
      });
    }
  }
  return out;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const data = await fetchJson(ctx,
    `https://cc.163.com/_next/data/nextjs/category/${encodeURIComponent(categoryId)}.json?game=${encodeURIComponent(categoryId)}`
  );
  const items = data.pageProps?.gametypeData?.lives ?? [];
  const list = items
    .map((i) => mapLive(i, "webcc_visitor"))
    .filter((r) => !!r);
  return { list, hasMore: false };
}

/* ─────────────── 搜索 ─────────────── */

export async function search(ctx, { keyword, page }) {
  const data = await fetchJson(ctx,
    `https://cc.163.com/search/anchor?query=${encodeURIComponent(keyword)}&size=20&page=${page}`
  );
  const items = data.webcc_anchor?.result ?? [];
  const list = [];
  for (const item of items) {
    if (item.cuteid === undefined || item.cuteid === null) continue;
    const rid = String(item.cuteid);
    list.push({
      platform: "cc",
      roomId: rid,
      title: item.title ?? "",
      cover: item.portrait,
      uname: item.nickname,
      avatar: item.portrait,
      online: parseWatching(item.follower_num),
      category: item.game_name ?? "",
      live: item.status === 1,
      link: `https://cc.163.com/${rid}`,
    });
  }
  return { list, hasMore: items.length > 0 };
}

/* ─────────────── 房间详情 + resolve ─────────────── */

async function fetchChannelInfo(ctx, roomId) {
  const anchorResp = await fetchJson(ctx,
    `https://api.cc.163.com/v1/activitylives/anchor/lives?anchor_ccid=${encodeURIComponent(roomId)}`
  );
  const channelId = anchorResp.data?.[roomId]?.channel_id;
  if (channelId === undefined || channelId === null) {
    throw new Error("CC 未返回 channel_id（房间可能未开播）");
  }
  const channelResp = await fetchJson(ctx,
    `https://cc.163.com/live/channel/?channelids=${encodeURIComponent(String(channelId))}`
  );
  return channelResp.data;
}

export async function getRoomDetail(ctx, { roomId }) {
  const data = await fetchChannelInfo(ctx, roomId);
  const r = data?.[0];
  if (!r) throw new Error("CC 未返回房间数据");
  return {
    platform: "cc",
    roomId: String(r.ccid ?? roomId),
    title: r.title ?? "",
    cover: r.cover,
    uname: r.nickname,
    avatar: r.purl,
    online: parseWatching(r.follower_num),
    category: r.gamename,
    live: r.status === 1,
    link: `https://cc.163.com/${roomId}`,
  };
}

/* ─────────────── 选流 ─────────────── */

const QUALITY_LABELS = {
  blueray: "原画",
  original: "原画",
  high: "高清",
  medium: "标准",
  standard: "标准",
  low: "低清",
  ultra: "蓝光",
};

const LINE_PRIORITY = ["hs", "ks", "ali", "fws", "wy"];

function pickCcStream(detail) {
  const dataSource = detail.quickplay ?? detail.stream_list;
  if (!dataSource) return { primary: "", alts: [] };
  const link = detail.m3u8;

  const dataObj = dataSource;
  const isLiveStream = dataObj.resolution === undefined || dataObj.resolution === null;
  const qualityMap = isLiveStream
    ? dataObj
    : (dataObj.resolution ?? {});

  const alts = [];
  for (const [key, q] of Object.entries(qualityMap)) {
    if (!q || typeof q !== "object") continue;
    const label = QUALITY_LABELS[key] ?? key;
    const vbr = q.vbr ?? 0;
    const lineMap = isLiveStream
      ? (q.CDN_FMT ?? {})
      : (q.cdn ?? {});
    let chosen;
    for (const line of LINE_PRIORITY) {
      const lineVal = lineMap[line];
      if (!lineVal) continue;
      if (isLiveStream) {
        if (!link) continue;
        chosen = `${link}&${lineVal}`;
      } else {
        chosen = lineVal;
      }
      break;
    }
    if (chosen) {
      alts.push({ qn: String(vbr), label, url: chosen });
    }
  }
  alts.sort((a, b) => parseInt(b.qn, 10) - parseInt(a.qn, 10));
  return { primary: alts[0]?.url ?? "", alts };
}

export async function resolve(ctx, { roomId }) {
  const data = await fetchChannelInfo(ctx, roomId);
  const r = data?.[0];
  if (!r) throw new Error("CC 未返回房间数据");
  if (r.status !== 1) throw new Error("CC 直播间未开播");
  const picked = pickCcStream(r);
  if (!picked.primary) throw new Error("CC 未匹配到可播流");
  const isFlv = !picked.primary.includes(".m3u8");
  if (isFlv) {
    return ctx.protocols.flvStream({
      url: picked.primary,
      qn: picked.alts[0]?.qn,
      qnLabel: picked.alts[0]?.label,
      alternatives: picked.alts.length > 0 ? picked.alts : undefined,
      referer: "https://cc.163.com/",
      ua: UA,
    });
  }
  return ctx.protocols.hlsStream({
    url: picked.primary,
    qn: picked.alts[0]?.qn,
    qnLabel: picked.alts[0]?.label,
    alternatives: picked.alts.length > 0 ? picked.alts : undefined,
    referer: "https://cc.163.com/",
    ua: UA,
  });
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const detail = await getRoomDetail(ctx, { roomId });
    return detail.live;
  } catch {
    return false;
  }
}
