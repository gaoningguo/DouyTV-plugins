/**
 * Kick 直播 plugin —— Twitch 替代平台，公开 REST API（无需 token）。
 *
 * roomId = channel slug (lowercase username)。
 */

export const manifest = {
  id: "kick",
  label: "Kick",
  version: "1.0.0",
  engine: { netliveApi: 1 },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://kick.com/";

const COMMON_HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Origin: "https://kick.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Sec-Ch-Ua":
    '"Chromium";v="130", "Not(A:Brand";v="99", "Google Chrome";v="130"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
};

function pickThumb(t) {
  if (!t) return undefined;
  if (typeof t === "string") return t;
  return t.src ?? t.url ?? undefined;
}

function mapStreamToRoom(s) {
  const slug = s.channel?.slug ?? s.slug;
  if (!slug) return undefined;
  return {
    platform: "kick",
    roomId: slug,
    title: s.session_title ?? slug,
    uname: s.channel?.user?.username ?? slug,
    avatar: s.channel?.user?.profile_pic,
    cover: pickThumb(s.thumbnail),
    online: s.viewer_count ?? 0,
    category: s.categories?.[0]?.name,
    live: !!s.is_live,
    link: `https://kick.com/${slug}`,
  };
}

async function getJson(ctx, url) {
  const res = await ctx.fetch(url, {
    method: "GET",
    headers: COMMON_HEADERS,
    timeout: 25000,
    http2: true,
  });
  if (!res.ok) throw new Error(`Kick HTTP ${res.status}`);
  return res.json();
}

/* ─────────────── 推荐 ─────────────── */

export async function getRecommend(ctx, { page, pageSize }) {
  const candidates = [
    `https://kick.com/api/v2/featured-livestreams/en?page=${page}`,
    `https://kick.com/featured-livestreams/en?page=${page}`,
    `https://kick.com/stream/livestreams/en?page=${page}&limit=24`,
  ];
  for (const url of candidates) {
    try {
      const data = await getJson(ctx, url);
      const arr = Array.isArray(data) ? data : data?.data ?? [];
      if (arr.length > 0) {
        const list = arr.map(mapStreamToRoom).filter((r) => !!r);
        return { list, hasMore: arr.length >= 20 };
      }
    } catch {
      /* try next */
    }
  }
  return { list: [], hasMore: false };
}

/* ─────────────── 分类 ─────────────── */

export async function getCategories(ctx) {
  try {
    const data = await getJson(ctx, "https://kick.com/api/v1/categories");
    const arr = Array.isArray(data) ? data : data?.data ?? [];
    return arr.slice(0, 40).map((c) => ({
      id: c.slug,
      name: c.name,
      cover: c.banner?.url ?? undefined,
    }));
  } catch {
    return [];
  }
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const candidates = [
    `https://kick.com/api/v2/categories/${encodeURIComponent(categoryId)}/livestreams?page=${page}`,
    `https://kick.com/api/v2/categories/${encodeURIComponent(categoryId)}/streams?page=${page}`,
    `https://kick.com/api/v1/categories/${encodeURIComponent(categoryId)}/livestreams?page=${page}`,
    `https://kick.com/stream/livestreams/en?category=${encodeURIComponent(categoryId)}&page=${page}&limit=24`,
  ];
  for (const url of candidates) {
    try {
      const data = await getJson(ctx, url);
      const arr = Array.isArray(data) ? data : data?.data ?? [];
      if (arr.length > 0) {
        const list = arr.map(mapStreamToRoom).filter((r) => !!r);
        return { list, hasMore: arr.length >= 20 };
      }
    } catch {
      /* try next */
    }
  }
  return { list: [], hasMore: false };
}

/* ─────────────── 搜索 ─────────────── */

export async function search(ctx, { keyword, page }) {
  const url = `https://kick.com/api/v2/channels/search?searched_word=${encodeURIComponent(keyword)}`;
  const data = await getJson(ctx, url);
  const arr = Array.isArray(data) ? data : data?.data ?? [];
  const list = arr.map((c) => ({
    platform: "kick",
    roomId: c.slug,
    title: c.livestream?.session_title ?? c.user?.username ?? c.slug,
    uname: c.user?.username ?? c.slug,
    avatar: c.user?.profile_pic,
    cover: pickThumb(c.livestream?.thumbnail),
    online: c.livestream?.viewer_count ?? 0,
    live: !!c.is_live || !!c.livestream,
    link: `https://kick.com/${c.slug}`,
  }));
  return { list, hasMore: false };
}

/* ─────────────── 房间详情 + resolve ─────────────── */

async function fetchChannel(ctx, slug) {
  return getJson(ctx,
    `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`
  );
}

export async function getRoomDetail(ctx, { roomId }) {
  const ch = await fetchChannel(ctx, roomId);
  const ls = ch.livestream;
  return {
    platform: "kick",
    roomId: ch.slug ?? roomId,
    title: ls?.session_title ?? ch.user?.username ?? ch.slug ?? roomId,
    uname: ch.user?.username ?? ch.slug,
    avatar: ch.user?.profile_pic,
    cover: pickThumb(ls?.thumbnail),
    online: ls?.viewer_count ?? 0,
    category: ls?.categories?.[0]?.name ?? ch.recent_categories?.[0]?.name,
    live: !!ls?.is_live,
    link: `https://kick.com/${ch.slug ?? roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const ch = await fetchChannel(ctx, roomId);
    return !!ch.livestream?.is_live;
  } catch {
    return false;
  }
}

export async function resolve(ctx, { roomId }) {
  const ch = await fetchChannel(ctx, roomId);
  const url = ch.playback_url ?? ch.livestream?.playback_url;
  if (!url) throw new Error("Kick 未返回 playback_url（房间未开播）");
  const alternatives = await fetchMasterAlternatives(ctx, url).catch(() => []);
  const top = alternatives[0];
  const defaultUrl = top?.url ?? url;
  const alts = alternatives.length > 1
    ? [
        { qn: "auto", label: "自适应", url },
        ...alternatives,
      ]
    : undefined;
  return ctx.protocols.hlsStream({
    url: defaultUrl,
    qn: top?.qn ?? "auto",
    qnLabel: top?.label ?? "自适应",
    alternatives: alts,
    referer: REFERER,
    ua: UA,
  });
}

async function fetchMasterAlternatives(ctx, masterUrl) {
  const res = await ctx.fetch(masterUrl, {
    method: "GET",
    headers: { "User-Agent": UA, Referer: REFERER },
    timeout: 15000,
    http2: true,
  });
  if (!res.ok) return [];
  const text = await res.text();
  const lines = text.split("\n");
  const variants = [];
  let pendingInf = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      pendingInf = line;
      continue;
    }
    if (pendingInf && line && !line.startsWith("#")) {
      const bwM = pendingInf.match(/BANDWIDTH=([0-9]+)/);
      const resM = pendingInf.match(/RESOLUTION=([0-9x]+)/);
      const frM = pendingInf.match(/FRAME-RATE=([0-9.]+)/);
      const bw = bwM ? parseInt(bwM[1], 10) : 0;
      const resolution = resM ? resM[1] : "?";
      const fr = frM ? Math.round(parseFloat(frM[1])) : 0;
      const heightM = resolution.match(/x([0-9]+)/);
      const heightLabel = heightM
        ? `${heightM[1]}p${fr > 30 ? fr : ""}`
        : resolution;
      const absUrl = line.startsWith("http")
        ? line
        : new URL(line, masterUrl).toString();
      variants.push({
        bw,
        qn: heightLabel || `${variants.length}`,
        label: heightLabel || resolution,
        url: absUrl,
      });
      pendingInf = null;
    }
  }
  variants.sort((a, b) => b.bw - a.bw);
  return variants.map(({ qn, label, url }) => ({ qn, label, url }));
}
