/**
 * 快手直播 plugin
 */

export const manifest = {
  id: "kuaishou",
  label: "快手直播",
  version: "1.0.0",
  engine: { netliveApi: 1 },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function randomDid() {
  let s = "";
  for (let i = 0; i < 36; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return "web_" + s;
}

const SESSION_DID = randomDid();
const SESSION_CLIENTID = "3";

const HEADERS_BASE = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Connection: "keep-alive",
  Referer: "https://live.kuaishou.com/",
  Origin: "https://live.kuaishou.com",
  Cookie: "did=" + SESSION_DID + ";clientid=" + SESSION_CLIENTID + ";kpf=PC_WEB;kpn=GAME_ZONE",
  "Sec-Ch-Ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
};

const IMAGE_EXTS = new Set([
  "svgz", "pjp", "png", "ico", "avif", "tiff", "tif", "jfif", "svg",
  "xbm", "pjpeg", "webp", "jpg", "jpeg", "bmp", "gif",
]);

function isImage(url) {
  if (!url) return false;
  const ext = url.split(".").pop() ?? "";
  return IMAGE_EXTS.has(ext.toLowerCase());
}
function normalizeCover(poster) {
  if (!poster) return undefined;
  return isImage(poster) ? poster : poster + ".jpg";
}

function authorDescription(d) {
  return d ? d.replace(/\n/g, " ") : "";
}

function parseWatching(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return v;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}

async function fetchJsonHelper(ctx, url, init) {
  init = init || {};
  const res = await ctx.fetch(url, {
    method: "GET",
    headers: { ...HEADERS_BASE, ...(init.headers || {}) },
    timeout: 20000,
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return res.json();
}

async function fetchText(ctx, url, init) {
  init = init || {};
  const res = await ctx.fetch(url, {
    method: "GET",
    headers: { ...HEADERS_BASE, ...(init.headers || {}) },
    timeout: 20000,
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return res.text();
}

export async function getRecommend(ctx, { page, pageSize }) {
  const data = await fetchJsonHelper(ctx, "https://live.kuaishou.com/live_api/home/list");
  const list = [];
  for (const item of data.data?.list ?? []) {
    for (const sub of item.gameLiveInfo ?? []) {
      for (const t of sub.liveInfo ?? []) {
        const author = t.author;
        if (!author?.id) continue;
        list.push({
          platform: "kuaishou", roomId: author.id,
          title: authorDescription(author.description),
          cover: normalizeCover(t.gameInfo?.poster),
          uname: author.name, avatar: author.avatar,
          online: parseWatching(t.watchingCount),
          category: t.gameInfo?.name, live: true,
          link: "https://live.kuaishou.com/u/" + author.id,
        });
      }
    }
  }
  return { list, hasMore: false };
}

const PARENT_CATS = [
  { id: "1", name: "热门" }, { id: "2", name: "网游" },
  { id: "3", name: "单机" }, { id: "4", name: "手游" },
  { id: "5", name: "棋牌" }, { id: "6", name: "娱乐" },
  { id: "7", name: "综合" }, { id: "8", name: "文化" },
];

export async function getCategories(ctx) {
  const out = [];
  for (const parent of PARENT_CATS) {
    let pg = 1;
    const pgSize = 30;
    while (pg < 10) {
      let resp;
      try {
        resp = await fetchJsonHelper(ctx,
          "https://live.kuaishou.com/live_api/category/data?type=" + parent.id + "&page=" + pg + "&size=" + pgSize);
      } catch (e) { break; }
      const sub = resp.data?.list ?? [];
      for (const c of sub) {
        if (!c.id) continue;
        out.push({ id: c.id, name: c.name ?? "", cover: c.poster, parent: parent.name });
      }
      if (sub.length < pgSize) break;
      pg++;
    }
  }
  return out;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const api = categoryId.length < 7
    ? "https://live.kuaishou.com/live_api/gameboard/list"
    : "https://live.kuaishou.com/live_api/non-gameboard/list";
  const url = api + "?filterType=0&pageSize=20&gameId=" + encodeURIComponent(categoryId) + "&page=" + page;
  const data = await fetchJsonHelper(ctx, url);
  const items = data.data?.list ?? [];
  const list = [];
  for (const item of items) {
    const aid = item.author?.id;
    if (!aid) continue;
    list.push({
      platform: "kuaishou", roomId: aid, title: item.caption ?? "",
      cover: normalizeCover(item.poster), uname: item.author?.name,
      avatar: item.author?.avatar, online: parseWatching(item.watchingCount),
      category: item.gameInfo?.name, live: true,
      link: "https://live.kuaishou.com/u/" + aid,
    });
  }
  return { list, hasMore: items.length >= 20 };
}

async function fetchInitialState(ctx, roomId) {
  const url = "https://live.kuaishou.com/u/" + encodeURIComponent(roomId);
  const html = await fetchText(ctx, url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
    },
  });
  const m = html.match(/window\.__INITIAL_STATE__=([\s\S]*?);/);
  const raw = m ? m[1] : null;
  if (!raw) throw new Error("快手未找到 __INITIAL_STATE__");
  const cleaned = raw.replace(/undefined/g, "null");
  try { return JSON.parse(cleaned); }
  catch (e) { throw new Error("快手 __INITIAL_STATE__ 解析失败：" + e.message); }
}

export async function getRoomDetail(ctx, { roomId }) {
  const state = await fetchInitialState(ctx, roomId);
  const play = state.liveroom?.playList?.[0];
  if (!play) throw new Error("快手未返回 playList");
  const author = play.author ?? {};
  const game = play.gameInfo ?? {};
  const live = !!play.isLiving;
  return {
    platform: "kuaishou", roomId,
    title: authorDescription(author.description),
    cover: normalizeCover(play.liveStream?.poster),
    uname: author.name, avatar: author.avatar,
    online: live ? parseWatching(game.watchingCount) : 0,
    category: game.name, live,
    link: "https://live.kuaishou.com/u/" + roomId,
  };
}

function pickKsStream(playUrls) {
  if (!playUrls) return { primary: "", alts: [] };
  const codec = Array.isArray(playUrls) ? playUrls[0] : playUrls;
  if (!codec) return { primary: "", alts: [] };
  const reps = codec.h264?.adaptationSet?.representation ?? codec.h265?.adaptationSet?.representation ?? [];
  if (reps.length === 0) return { primary: "", alts: [] };
  const sorted = [...reps].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  const alts = sorted.filter((r) => r.url).map((r) => ({
    qn: String(r.level ?? 0), label: r.name ?? "", url: r.url ?? "",
  }));
  return { primary: alts[0]?.url ?? "", alts };
}

export async function resolve(ctx, { roomId }) {
  const state = await fetchInitialState(ctx, roomId);
  const play = state.liveroom?.playList?.[0];
  if (!play?.isLiving) throw new Error("快手直播间未开播");
  const picked = pickKsStream(play.liveStream?.playUrls);
  if (!picked.primary) throw new Error("快手未匹配到可播流");
  return ctx.protocols.hlsStream({
    url: picked.primary,
    qn: picked.alts[0]?.qn,
    qnLabel: picked.alts[0]?.label,
    alternatives: picked.alts.length > 0 ? picked.alts : undefined,
    referer: "https://live.kuaishou.com/",
    ua: UA,
  });
}

export async function getLiveStatus(ctx, { roomId }) {
  try { const detail = await getRoomDetail(ctx, { roomId }); return detail.live; }
  catch { return false; }
}

