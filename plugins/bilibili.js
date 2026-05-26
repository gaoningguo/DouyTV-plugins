/**
 * 哔哩哔哩直播插件 —— WBI 签名 + buvid cookie
 * 协议: HLS / FLV (legacy v1 playUrl 主路径)
 */
import CryptoJS from "crypto-js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
const REFERER = "https://live.bilibili.com/";

let cachedBuvid3 = "";
let cachedBuvid4 = "";
let cachedImgKey = "";
let cachedSubKey = "";
let cachedAccessId = "";

export const manifest = {
  id: "bilibili",
  label: "哔哩哔哩",
  version: "1.0.0",
  defaultProxy: "direct",
  engine: { netliveApi: 1 },
};

async function fetchJsonLoose(ctx, url, headers) {
  const res = await ctx.fetch(url, { headers, timeout: 20000 });
  if (!res.ok) return undefined;
  try {
    const json = await res.json();
    return json.data ?? json;
  } catch { return undefined; }
}

async function fetchJson(ctx, url, headers) {
  const res = await ctx.fetch(url, { headers, timeout: 20000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== undefined && json.code !== 0) throw new Error(json.message || `B站 code ${json.code}`);
  return json.data ?? json;
}

async function ensureBuvid(ctx) {
  if (cachedBuvid3) return;
  const data = await fetchJsonLoose(ctx, "https://api.bilibili.com/x/frontend/finger/spi", { "user-agent": UA, referer: REFERER });
  cachedBuvid3 = data?.b_3 ?? "";
  cachedBuvid4 = data?.b_4 ?? "";
}

async function getHeaders(ctx) {
  await ensureBuvid(ctx);
  return { "user-agent": UA, referer: REFERER, cookie: `buvid3=${cachedBuvid3};buvid4=${cachedBuvid4};` };
}

const MIXIN_KEY_ENC_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];

async function getWbiKeys(ctx) {
  if (cachedImgKey && cachedSubKey) return { imgKey: cachedImgKey, subKey: cachedSubKey };
  const headers = await getHeaders(ctx);
  const data = await fetchJsonLoose(ctx, "https://api.bilibili.com/x/web-interface/nav", headers);
  const imgUrl = data?.wbi_img?.img_url ?? "";
  const subUrl = data?.wbi_img?.sub_url ?? "";
  cachedImgKey = imgUrl.substring(imgUrl.lastIndexOf("/") + 1).split(".")[0] ?? "";
  cachedSubKey = subUrl.substring(subUrl.lastIndexOf("/") + 1).split(".")[0] ?? "";
  return { imgKey: cachedImgKey, subKey: cachedSubKey };
}

function getMixinKey(origin) {
  let s = "";
  for (const i of MIXIN_KEY_ENC_TAB) { if (i < origin.length) s += origin[i]; }
  return s.substring(0, 32);
}

const FORBIDDEN = new Set(["!", "'", "(", ")", "*"]);

async function buildWbiQuery(ctx, baseUrl) {
  const { imgKey, subKey } = await getWbiKeys(ctx);
  const mixinKey = getMixinKey(imgKey + subKey);
  const wts = Math.floor(Date.now() / 1000);
  const u = new URL(baseUrl);
  const params = [];
  u.searchParams.forEach((v, k) => params.push([k, v]));
  params.push(["wts", String(wts)]);
  params.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const sanitized = params.map(([k, v]) => [k, Array.from(v).filter((c) => !FORBIDDEN.has(c)).join("")]);
  const encoded = sanitized.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const wRid = CryptoJS.MD5(encoded + mixinKey).toString(CryptoJS.enc.Hex);
  return `${encoded}&w_rid=${wRid}`;
}

async function fetchWithWbi(ctx, baseUrl) {
  const query = await buildWbiQuery(ctx, baseUrl);
  const u = new URL(baseUrl);
  u.search = `?${query}`;
  const headers = await getHeaders(ctx);
  const data = await fetchJsonLoose(ctx, u.toString(), headers);
  if (data === undefined) throw new Error(`B站 ${baseUrl} 无响应`);
  return data;
}

async function getAccessId(ctx) {
  if (cachedAccessId) return cachedAccessId;
  try {
    const headers = await getHeaders(ctx);
    const res = await ctx.fetch("https://live.bilibili.com/lol", { headers, timeout: 20000 });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/"access_id":"(.*?)"/);
      cachedAccessId = (m?.[1] ?? "").replace(/\\/g, "");
    }
  } catch {}
  return cachedAccessId;
}

function mapRoom(item) {
  const rid = item.roomid;
  if (rid === undefined || rid === null) return undefined;
  return {
    platform: "bilibili",
    roomId: String(rid),
    title: item.title ?? "",
    cover: item.cover ? `${item.cover}@400w.jpg` : undefined,
    uname: item.uname,
    avatar: item.face,
    online: typeof item.online === "string" ? parseInt(item.online, 10) || 0 : item.online,
    category: item.area_name,
    live: true,
    link: `https://live.bilibili.com/${rid}`,
  };
}

export async function getRecommend(ctx, { page }) {
  const baseUrl = `https://api.live.bilibili.com/xlive/web-interface/v1/second/getListByArea?platform=web&sort=online&page_size=30&page=${page}`;
  const data = await fetchWithWbi(ctx, baseUrl);
  const arr = data.list ?? [];
  return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length > 0 };
}

export async function getCategories(ctx) {
  const headers = await getHeaders(ctx);
  const res = await ctx.fetch("https://api.live.bilibili.com/room/v1/Area/getList?need_entrance=1&parent_id=0", { headers, timeout: 20000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const env = await res.json();
  const out = [];
  for (const parent of env.data ?? []) {
    for (const child of parent.list ?? []) {
      if (child.id === undefined || child.id === null) continue;
      out.push({ id: `${parent.id ?? ""}:${child.id}`, name: child.name ?? "", cover: child.pic ? `${child.pic}@100w.png` : undefined, parent: parent.name });
    }
  }
  return out;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const [parentId, areaId] = categoryId.split(":");
  if (!parentId || !areaId) throw new Error('分类 ID 格式应为 "parent:child"');
  const accessId = await getAccessId(ctx);
  const baseUrl = `https://api.live.bilibili.com/xlive/web-interface/v1/second/getList?platform=web&parent_area_id=${parentId}&area_id=${areaId}&sort_type=&page=${page}&w_webid=${encodeURIComponent(accessId)}`;
  const data = await fetchWithWbi(ctx, baseUrl);
  const arr = data.list ?? [];
  return { list: arr.map(mapRoom).filter(Boolean), hasMore: data.has_more === 1 };
}

export async function search(ctx, { keyword, page }) {
  const headers = await getHeaders(ctx);
  const url = `https://api.bilibili.com/x/web-interface/search/type?context=&search_type=live&cover_type=user_cover&order=&keyword=${encodeURIComponent(keyword)}&category_id=&__refresh__=&_extra=&highlight=0&single_column=0&page=${page}`;
  const data = await fetchJson(ctx, url, headers);
  const arr = data.result?.live_room ?? [];
  const list = arr.map((item) => {
    if (item.roomid === undefined) return undefined;
    return {
      platform: "bilibili",
      roomId: String(item.roomid),
      title: (item.title ?? "").replace(/<.*?em.*?>/g, ""),
      cover: item.cover ? `https:${item.cover}@400w.jpg` : undefined,
      uname: item.uname,
      avatar: item.uface ? `https:${item.uface}@400w.jpg` : undefined,
      online: typeof item.online === "string" ? parseInt(item.online, 10) || 0 : item.online,
      category: item.cate_name,
      live: item.live_status === 1,
      link: `https://live.bilibili.com/${item.roomid}`,
    };
  }).filter(Boolean);
  return { list, hasMore: arr.length > 0 };
}

export async function getRoomDetail(ctx, { roomId }) {
  const baseUrl = `https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom?room_id=${roomId}`;
  const info = await fetchWithWbi(ctx, baseUrl);
  const r = info.room_info;
  const a = info.anchor_info?.base_info;
  if (!r) throw new Error("B站未返回房间信息");
  const realRoomId = String(r.room_id ?? roomId);
  return {
    platform: "bilibili",
    roomId: realRoomId,
    title: r.title ?? "",
    cover: r.cover,
    uname: a?.uname,
    avatar: a?.face ? `${a.face}@100w.jpg` : undefined,
    online: typeof r.online === "string" ? parseInt(r.online, 10) || 0 : r.online,
    category: r.area_name,
    introduction: r.description,
    live: r.live_status === 1,
    link: `https://live.bilibili.com/${roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const headers = await getHeaders(ctx);
    const data = await fetchJson(ctx, `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`, headers);
    return data.live_status === 1;
  } catch { return false; }
}

const MIRROR_CDN = "upos-sz-mirrorali.bilivideo.com";

function rewriteBiliUrl(url) {
  if (url.includes(".mcdn.bilivideo")) return `https://proxy-tf-all-ws.bilivideo.com/?url=${encodeURIComponent(url)}`;
  if (url.includes("/upgcxcode/")) return url.replace(/(https?):\/\/(.*?)\/upgcxcode\//, `https://${MIRROR_CDN}/upgcxcode/`);
  return url;
}

async function fetchLegacyPlayUrl(ctx, realRoomId) {
  const headers = await getHeaders(ctx);
  const url = `https://api.live.bilibili.com/room/v1/Room/playUrl?cid=${realRoomId}&qn=0&platform=h5&https_url_req=1&ptype=16`;
  const data = await fetchJsonLoose(ctx, url, headers);
  const durl = data?.durl ?? [];
  if (durl.length === 0) return null;
  const sorted = [...durl].sort((a, b) => (a.url?.includes("mcdn") ? 1 : 0) - (b.url?.includes("mcdn") ? 1 : 0));
  const primaryRaw = sorted[0].url;
  if (!primaryRaw) return null;
  const primary = rewriteBiliUrl(primaryRaw);
  const qLabels = new Map();
  for (const q of data?.quality_description ?? []) { if (q.qn !== undefined && q.desc) qLabels.set(q.qn, q.desc); }
  const currentQuality = data?.current_quality ?? 0;
  const alternatives = (data?.accept_quality ?? []).map((q) => parseInt(q, 10)).filter((q) => !isNaN(q)).map((qn) => ({
    qn: String(qn), label: qLabels.get(qn) ?? `qn=${qn}`, url: qn === currentQuality ? primary : "",
  }));
  const streamType = primary.includes(".m3u8") ? "hls" : "flv";
  return { url: primary, streamType, qn: String(currentQuality), qnLabel: qLabels.get(currentQuality) ?? "原画", alternatives: alternatives.length > 0 ? alternatives : undefined, referer: REFERER, ua: UA };
}

async function fetchModernPlayInfo(ctx, realRoomId) {
  const headers = await getHeaders(ctx);
  const url = `https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?room_id=${realRoomId}&protocol=0,1&format=0,1,2&codec=0,1&platform=html5&dolby=5`;
  const data = await fetchJsonLoose(ctx, url, headers);
  const streams = data?.playurl_info?.playurl?.stream ?? [];
  const qnDesc = data?.playurl_info?.playurl?.g_qn_desc ?? [];
  const qnLabelMap = new Map();
  for (const q of qnDesc) { if (q.qn !== undefined && q.desc) qnLabelMap.set(q.qn, q.desc); }
  const urls = [];
  for (const s of streams) {
    for (const fmt of s.format ?? []) {
      const formatName = (fmt.format_name ?? "").toLowerCase();
      const st = formatName === "flv" ? "flv" : "hls";
      for (const codec of fmt.codec ?? []) {
        const baseUrl = codec.base_url;
        if (!baseUrl) continue;
        for (const info of codec.url_info ?? []) {
          if (!info.host) continue;
          urls.push({ url: rewriteBiliUrl(`${info.host}${baseUrl}${info.extra ?? ""}`), current_qn: codec.current_qn ?? 0, alts: codec.accept_qn ?? [], streamType: st });
        }
      }
    }
  }
  urls.sort((a, b) => { if (a.streamType !== b.streamType) return a.streamType === "hls" ? -1 : 1; return (a.url.includes("mcdn") ? 1 : 0) - (b.url.includes("mcdn") ? 1 : 0); });
  if (urls.length === 0) return null;
  const chosen = urls[0];
  const alternatives = (chosen.alts ?? []).map((qn) => ({ qn: String(qn), label: qnLabelMap.get(qn) ?? `qn=${qn}`, url: qn === chosen.current_qn ? chosen.url : "" }));
  return { url: chosen.url, streamType: chosen.streamType, qn: String(chosen.current_qn), qnLabel: qnLabelMap.get(chosen.current_qn) ?? "原画", alternatives: alternatives.length > 0 ? alternatives : undefined, referer: REFERER, ua: UA };
}

export async function resolve(ctx, { roomId }) {
  let realRoomId = roomId;
  try {
    const info = await fetchWithWbi(ctx, `https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom?room_id=${roomId}`);
    if (info.room_info?.room_id !== undefined) realRoomId = String(info.room_info.room_id);
  } catch {}
  const v1 = await fetchLegacyPlayUrl(ctx, realRoomId);
  if (v1) {
    if (v1.streamType === "flv") return ctx.protocols.flvStream(v1);
    return ctx.protocols.hlsStream(v1);
  }
  const v2 = await fetchModernPlayInfo(ctx, realRoomId);
  if (v2) {
    if (v2.streamType === "flv") return ctx.protocols.flvStream(v2);
    return ctx.protocols.hlsStream(v2);
  }
  throw new Error("B站未返回可用拉流地址（房间未开播 / 风控）");
}
