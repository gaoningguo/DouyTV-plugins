/**
 * Bigo Live 直播 plugin —— 全球热门社交/热舞直播平台（新加坡，YY 旗下）。
 */

export const manifest = {
  id: "bigo",
  label: "Bigo Live",
  version: "1.0.0",
  engine: { netliveApi: 1 },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const REFERER = "https://www.bigo.tv/";

const COMMON_HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Origin: "https://www.bigo.tv",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

const HTML_HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

function mapRoom(r) {
  const id =
    r.bigo_id ??
    r.uid ??
    r.alias ??
    r.room_id;

  if (id === undefined || id === null) {
    return undefined;
  }

  const slug = String(id);

  return {
    platform: "bigo",
    roomId: slug,
    title:
      r.room_topic ??
      r.nick_name ??
      r.user_name ??
      r.alias ??
      slug,
    uname:
      r.nick_name ??
      r.user_name ??
      r.alias ??
      slug,
    avatar:
      r.avatar_url ??
      r.avatar ??
      r.data1,
    cover:
      r.cover_l ??
      r.cover_m ??
      r.big_url ??
      r.cover_url ??
      r.pic ??
      r.data2?.bigUrl,
    online:
      r.user_count ??
      r.audience ??
      0,
    category:
      r.tag ??
      r.country ??
      r.language,
    live: true,
    link: `https://www.bigo.tv/${slug}`,
  };
}

async function postJson(ctx, url, body) {
  const res = await ctx.fetch(url, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "application/json",
    },
    json: body,
    timeout: 25000,
    http2: true,
  });

  if (!res.ok) {
    throw new Error(`Bigo HTTP ${res.status}`);
  }

  return res.json();
}

async function getJson(ctx, url) {
  const res = await ctx.fetch(url, {
    method: "GET",
    headers: COMMON_HEADERS,
    timeout: 25000,
    http2: true,
  });

  if (!res.ok) {
    throw new Error(`Bigo HTTP ${res.status}`);
  }

  return res.json();
}

async function fetchHtml(ctx, url) {
  const res = await ctx.fetch(url, {
    method: "GET",
    headers: HTML_HEADERS,
    timeout: 25000,
    http2: true,
  });

  if (!res.ok) {
    throw new Error(`Bigo HTTP ${res.status}`);
  }

  return res.text();
}

function extractInitState(html) {
  const m =
    html.match(
      /window\.__INIT_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/
    ) ||
    html.match(
      /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/
    );

  if (!m) {
    return null;
  }

  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/* ─────────────── 推荐 ─────────────── */

export async function getRecommend(ctx, { page, pageSize }) {
  const limit = Math.max(pageSize, 24);

  const candidates = [
    `https://ta.bigo.tv/official_website/OInterfaceWeb/vedioList/5?fetchNum=${limit}`,
  ];

  const reasons = [];

  for (const url of candidates) {
    try {
      const data = await getJson(ctx, url);

      const arr =
        data?.data?.data ??
        data?.data?.list ??
        data?.data?.rooms ??
        [];

      if (!Array.isArray(arr)) {
        reasons.push(`${url}: data 不是数组`);
        continue;
      }

      const list = arr
        .map(mapRoom)
        .filter((r) => !!r);

      if (list.length > 0) {
        return {
          list,
          hasMore: arr.length >= limit,
        };
      }

      reasons.push(`${url}: 返回 0 条`);
    } catch (e) {
      reasons.push(`${url}: ${e?.message ?? String(e)}`);
    }
  }

  throw new Error("Bigo Live: " + reasons.join(" | "));
}

/* ─────────────── 分类 ─────────────── */

const PRESET_CATEGORIES = [
  { id: "0", name: "热门" },
  { id: "1", name: "热舞" },
  { id: "2", name: "颜值" },
  { id: "3", name: "唱见" },
  { id: "4", name: "脱口秀" },
  { id: "5", name: "派对" },
  { id: "6", name: "户外" },
  { id: "7", name: "游戏" },
];

export async function getCategories(ctx) {
  return PRESET_CATEGORIES;
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

      const arr =
        data?.data?.data ??
        data?.data?.list ??
        data?.data?.rooms ??
        [];

      if (Array.isArray(arr) && arr.length > 0) {
        const list = arr
          .map(mapRoom)
          .filter((r) => !!r);

        return {
          list,
          hasMore: arr.length >= limit,
        };
      }
    } catch {
      // try next
    }
  }

  if (page === 1) {
    return getRecommend(ctx, { page: 1, pageSize: limit });
  }

  return { list: [], hasMore: false };
}

/* ─────────────── 搜索 ─────────────── */

export async function search(ctx, { keyword, page }) {
  try {
    const data = await postJson(
      ctx,
      "https://ta.bigo.tv/official_website/studio/getSearchInfo",
      {
        keyword,
        page: 1,
        size: 30,
      }
    );

    const arr =
      data.data?.list ??
      data.data?.users ??
      [];

    const list = arr
      .map(mapRoom)
      .filter((r) => !!r);

    return { list, hasMore: false };
  } catch {
    return { list: [], hasMore: false };
  }
}

/* ─────────────── 房间详情 ─────────────── */

async function fetchPlayInfo(ctx, roomId) {
  const url =
    `https://ta.bigo.tv/official_website/studio/getInternalStudioInfo?siteId=${encodeURIComponent(roomId)}&verify=`;

  try {
    const res = await ctx.fetch(url, {
      method: "POST",
      headers: {
        ...COMMON_HEADERS,
        "Content-Length": "0",
      },
      timeout: 25000,
      http2: true,
    });

    if (!res.ok) {
      throw new Error(`Bigo HTTP ${res.status}`);
    }

    return res.json();
  } catch {
    const html = await fetchHtml(ctx, `https://www.bigo.tv/${roomId}`);

    const state = extractInitState(html);

    const ui = state?.pageStore?.userInfoStore?.userInfo;

    if (!ui) {
      throw new Error("Bigo 房间数据缺失");
    }

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

  if (!d) {
    throw new Error(`Bigo 房间 ${roomId} 未找到`);
  }

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
  } catch {
    return false;
  }
}

export async function resolve(ctx, { roomId }) {
  const info = await fetchPlayInfo(ctx, roomId);
  const d = info.data;

  if (!d) {
    throw new Error(`Bigo 房间 ${roomId} 未找到`);
  }

  const url =
    d.hls_src ??
    d.hls_url ??
    d.flv_url ??
    d.rtmp_url;

  if (!url) {
    throw new Error("Bigo 未开播");
  }

  return ctx.protocols.hlsStream({
    url,
    qn: "auto",
    qnLabel: "原画",
  });
}
