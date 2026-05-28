/**
 * 17 Live (17.live) plugin
 *
 * 新版真实接口：
 *   GET https://wap-api.17app.co/api/v1/cells
 *
 * roomId = userID
 */

export const manifest = {
  id: "live17",
  label: "17 Live",
  version: "1.0.1",
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const REFERER = "https://17.live/";

const COMMON_HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Origin: "https://17.live",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

function normalizeImage(url) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `https://cdn.17app.co/${url}`;
}

function mapStream(stream) {
  const user = stream.userInfo;
  const roomId = user?.roomID ?? stream.liveStreamID;
  if (!roomId) return undefined;

  return {
    platform: "live17",
    roomId,
    title:
      stream.caption ??
      user?.displayName ??
      user?.openID ??
      roomId,
    uname:
      user?.displayName ??
      user?.openID ??
      roomId,
    avatar: normalizeImage(user?.picture),
    cover:
      normalizeImage(stream.thumbnail) ??
      stream.coverPhoto,
    online:
      stream.liveViewerCount ??
      stream.viewerCount ??
      0,
    category: "17Live",
    live: stream.status === 2,
    link: `https://17.live/live/${roomId}`,
  };
}

async function getJsonHelper(ctx, url) {
  const res = await ctx.fetch(url, {
    method: "GET",
    headers: COMMON_HEADERS,
    timeout: 25000,
    http2: true,
  });

  if (!res.ok) {
    throw new Error(`17Live HTTP ${res.status}`);
  }

  return res.json();
}

/* ─────────────── 推荐 ─────────────── */

async function fetchCells(ctx, params) {
  const qs = new URLSearchParams({
    count: String(params.count ?? 20),
    cursor: params.cursor ?? "",
    paging: "1",
    region: "SG",
    tab: params.tab ?? "hot_opt",
  });

  const data = await getJsonHelper(ctx,
    `https://wap-api.17app.co/api/v1/cells?${qs.toString()}`
  );

  const list = [];

  for (const cell of data.cells ?? []) {
    if (cell.type !== 0) continue;
    if (!cell.stream) continue;
    const room = mapStream(cell.stream);
    if (room) {
      list.push(room);
    }
  }

  return {
    list,
    cursor: data.cursor,
    hasMore: !!data.cursor,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  if (page > 1) {
    return { list: [], hasMore: false };
  }

  const data = await fetchCells(ctx, {
    tab: "hot_opt",
    count: Math.max(pageSize, 20),
  });

  return {
    list: data.list,
    hasMore: data.hasMore,
  };
}

/* ─────────────── 分类 ─────────────── */

const PRESET_CATEGORIES = [
  { id: "hot_opt", name: "热门" },
  { id: "nearby_opt", name: "附近" },
  { id: "follow_opt", name: "关注" },
];

export async function getCategories(ctx) {
  return PRESET_CATEGORIES;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  if (page > 1) {
    return { list: [], hasMore: false };
  }

  const data = await fetchCells(ctx, {
    tab: categoryId,
    count: 20,
  });

  return {
    list: data.list,
    hasMore: data.hasMore,
  };
}

/* ─────────────── 搜索 ─────────────── */

export async function search(ctx, { keyword, page }) {
  const data = await fetchCells(ctx, {
    tab: "hot_opt",
    count: 50,
  });

  const kw = keyword.toLowerCase();

  const list = data.list.filter((r) => {
    return (
      r.title?.toLowerCase().includes(kw) ||
      r.uname?.toLowerCase().includes(kw)
    );
  });

  return { list, hasMore: false };
}

/* ─────────────── detail ─────────────── */

async function fetchRoom(ctx, roomId) {
  // 优先使用直接获取单个直播间的 API
  try {
    const res = await ctx.fetch(
      `https://wap-api.17app.co/api/v1/lives/${roomId}/info`,
      { method: "GET", headers: COMMON_HEADERS, timeout: 15000, http2: true }
    );
    if (res.ok) {
      const data = await res.json();
      if (data) return data;
    }
  } catch {}

  return null;
}

export async function getRoomDetail(ctx, { roomId }) {
  const stream = await fetchRoom(ctx, roomId);

  if (!stream) {
    throw new Error(`17Live 房间 ${roomId} 未找到`);
  }

  const room = mapStream(stream);

  if (!room) {
    throw new Error(`17Live 房间 ${roomId} 解析失败`);
  }

  return room;
}

export async function getLiveStatus(ctx, { roomId }) {
  const stream = await fetchRoom(ctx, roomId);
  return stream?.status === 2;
}

/* ─────────────── resolve ─────────────── */

function flvToHls(url) {
  if (url.includes("wansu")) {
    return url.replace(".flv", "/playlist.m3u8");
  }

  return url
    .replace("pull-rtmp", "pull-hls")
    .replace(".flv", ".m3u8");
}

export async function resolve(ctx, { roomId }) {
  const stream = await fetchRoom(ctx, roomId);

  if (!stream) {
    throw new Error(`17Live 房间 ${roomId} 未找到`);
  }

  if (stream.status !== 2) {
    throw new Error("17Live 未开播");
  }

  const urls =
    stream.pullURLsInfo?.rtmpURLs ??
    stream.rtmpUrls ??
    [];

  if (urls.length === 0) {
    throw new Error("17Live 未返回流地址");
  }

  const best =
    urls.find((v) => !!v.urlQualityEnhancedHD) ??
    urls[0];

  // 优先 H.264 FLV（MSE 兼容），回退到普通质量
  const flvUrl =
    best.url264 ??
    best.urlHighQuality ??
    best.url ??
    best.urlLowQuality;

  if (!flvUrl) {
    throw new Error("17Live FLV 地址为空");
  }

  const hlsUrl = flvToHls(flvUrl);

  const alternatives = urls
    .map((v) => {
      const u = v.url264 ?? v.urlHighQuality ?? v.url;
      if (!u) return null;
      return {
        qn: String(v.provider ?? "auto"),
        label: `线路 ${v.provider ?? "auto"}`,
        url: flvToHls(u),
      };
    })
    .filter((v) => !!v);

  return ctx.protocols.hlsStream({
    url: hlsUrl,
    qn: "origin",
    qnLabel: "原画",
    alternatives,
    referer: REFERER,
    ua: UA,
  });
}
