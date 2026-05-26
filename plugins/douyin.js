/**
 * 抖音直播插件 —— ABogus 签名 + webcast API
 * 协议: HLS / FLV
 */
import { getABogus } from "./_abogus.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.97 Safari/537.36 Core/1.116.567.400 QQBrowser/19.7.6764.400";
const DEFAULT_COOKIE = "ttwid=1%7CB1qls3GdnZhUov9o2NxOMxxYS2ff6OSvEWbv0ytbES4%7C1680522049%7C280d802d6d478e3e78d0c807f7c487e7ffec0ae4e5fdd6a0fe74c3c6af149511";
const AUTHORITY = "live.douyin.com";
const REFERER = "https://live.douyin.com";
const MSTOKEN_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const manifest = {
  id: "douyin",
  label: "抖音",
  version: "1.0.0",
  defaultProxy: "direct",
  engine: { netliveApi: 1 },
};

function generateMsToken(length) {
  let out = "";
  for (let i = 0; i < (length || 107); i++) out += MSTOKEN_ALPHA[Math.floor(Math.random() * MSTOKEN_ALPHA.length)];
  return out;
}

function signUrl(url) {
  const msToken = generateMsToken(107);
  const withToken = `${url}&msToken=${msToken}`;
  const qs = withToken.split("?")[1] ?? "";
  let aBogus = "";
  try { aBogus = getABogus(qs, UA); } catch {}
  return `${url}&msToken=${encodeURIComponent(msToken)}&a_bogus=${encodeURIComponent(aBogus)}`;
}

function defaultHeaders() {
  return { "User-Agent": UA, Referer: REFERER, Authority: AUTHORITY, Cookie: DEFAULT_COOKIE };
}

async function fetchJson(ctx, url) {
  const res = await ctx.fetch(url, { headers: defaultHeaders(), timeout: 20000, http2: true });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(ctx, url) {
  const res = await ctx.fetch(url, { headers: defaultHeaders(), timeout: 20000, http2: true });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseDisplayCount(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return v;
  const s = String(v);
  if (!s) return undefined;
  const num = parseFloat(s);
  if (isNaN(num)) return undefined;
  if (s.includes("万")) return Math.round(num * 10000);
  if (s.includes("亿")) return Math.round(num * 100000000);
  return Math.round(num);
}

function mapPartitionItem(item) {
  const rid = item.web_rid;
  if (!rid) return undefined;
  const room = item.room ?? {};
  return {
    platform: "douyin",
    roomId: String(rid),
    title: room.title ?? "",
    cover: room.cover?.url_list?.[0],
    uname: room.owner?.nickname,
    avatar: room.owner?.avatar_thumb?.url_list?.[0],
    online: parseDisplayCount(room.room_view_stats?.display_value),
    category: item.tag_name ?? "热门推荐",
    live: true,
    link: `https://live.douyin.com/${rid}`,
  };
}

function partitionQuery(partition, partitionType, page) {
  return {
    aid: "6383", app_name: "douyin_web", live_id: "1", device_platform: "web", language: "zh-CN",
    enter_from: "link_share", cookie_enabled: "true", screen_width: "1980", screen_height: "1080",
    browser_language: "zh-CN", browser_platform: "Win32", browser_name: "Edge", browser_version: "125.0.0.0",
    browser_online: "true", count: "15", offset: String((page - 1) * 15), partition, partition_type: partitionType, req_from: "2",
  };
}

function buildUrl(base, params) {
  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return `${base}?${qs}`;
}

export async function getRecommend(ctx, { page }) {
  const url = buildUrl("https://live.douyin.com/webcast/web/partition/detail/room/v2/", partitionQuery("720", "1", page));
  const data = await fetchJson(ctx, signUrl(url));
  const items = data.data?.data ?? [];
  return { list: items.map(mapPartitionItem).filter(Boolean), hasMore: items.length >= 15 };
}

function extractCategoryDataJson(source) {
  const startPattern = '{\\"pathname\\":\\"/\\",\\"categoryData\\":';
  const startIndex = source.indexOf(startPattern);
  if (startIndex === -1) return "";
  let openBraces = 0, foundFirst = false;
  for (let i = startIndex; i < source.length; i++) {
    if (source[i] === "{") { openBraces++; foundFirst = true; }
    else if (source[i] === "}") openBraces--;
    if (foundFirst && openBraces === 0) {
      return source.substring(startIndex, i + 1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }
  return "";
}

export async function getCategories(ctx) {
  const html = await fetchText(ctx, "https://live.douyin.com/?from_nav=1");
  const extracted = extractCategoryDataJson(html);
  if (!extracted) return [];
  let parsed;
  try { parsed = JSON.parse(extracted); } catch { return []; }
  const out = [];
  for (const item of parsed.categoryData ?? []) {
    const parentTitle = item.partition?.title ?? "";
    const parentId = `${item.partition?.id_str ?? ""},${item.partition?.type ?? ""}`;
    for (const sub of item.sub_partition ?? []) {
      const subId = `${sub.partition?.id_str ?? ""},${sub.partition?.type ?? ""}`;
      if (!subId.startsWith(",")) out.push({ id: subId, name: sub.partition?.title ?? "", parent: parentTitle });
    }
    if (parentId && !parentId.startsWith(",")) out.push({ id: parentId, name: `${parentTitle}-全部`, parent: parentTitle });
  }
  return out;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const [partition, partitionType] = categoryId.split(",");
  if (!partition || !partitionType) throw new Error(`抖音 categoryId 格式应为 "id,type"`);
  const url = buildUrl("https://live.douyin.com/webcast/web/partition/detail/room/v2/", partitionQuery(partition, partitionType, page));
  const data = await fetchJson(ctx, signUrl(url));
  const items = data.data?.data ?? [];
  return { list: items.map(mapPartitionItem).filter(Boolean), hasMore: items.length >= 15 };
}

export async function search(ctx, { keyword, page }) {
  const params = {
    device_platform: "webapp", aid: "6383", channel: "channel_pc_web", search_channel: "aweme_live",
    keyword, search_source: "switch_tab", query_correct_type: "1", is_filter_search: "0", from_group_id: "",
    offset: String((page - 1) * 10), count: "10", pc_client_type: "1", version_code: "170400",
    version_name: "17.4.0", cookie_enabled: "true", screen_width: "1980", screen_height: "1080",
    browser_language: "zh-CN", browser_platform: "Win32", browser_name: "Edge", browser_version: "125.0.0.0",
    browser_online: "true", engine_name: "Blink", engine_version: "125.0.0.0", os_name: "Windows", os_version: "10",
    cpu_core_num: "12", device_memory: "8", platform: "PC", downlink: "10", effective_type: "4g",
    round_trip_time: "100", webid: "7382872326016435738",
  };
  const url = buildUrl("https://www.douyin.com/aweme/v1/web/live/search/", params);
  const res = await ctx.fetch(url, {
    headers: { "User-Agent": UA, Authority: "www.douyin.com", Accept: "application/json, text/plain, */*", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8", Cookie: DEFAULT_COOKIE, Referer: `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=live` },
    timeout: 20000, http2: true,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let resp;
  try { resp = await res.json(); } catch { throw new Error("抖音搜索被风控"); }
  const list = [];
  for (const item of resp.data ?? []) {
    const raw = item.lives?.rawdata;
    if (!raw) continue;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { continue; }
    const owner = parsed.owner;
    if (!owner?.web_rid) continue;
    list.push({
      platform: "douyin", roomId: owner.web_rid, title: parsed.title ?? "",
      cover: parsed.cover?.url_list?.[0], uname: owner.nickname,
      avatar: owner.avatar_thumb?.url_list?.[0], online: parseDisplayCount(parsed.stats?.total_user_str),
      live: (parsed.status ?? 0) === 2, link: `https://live.douyin.com/${owner.web_rid}`,
    });
  }
  return { list, hasMore: list.length >= 10 };
}

async function fetchEnter(ctx, webRid) {
  const params = { aid: "6383", app_name: "douyin_web", live_id: "1", device_platform: "web", language: "zh-CN", browser_language: "zh-CN", browser_platform: "Win32", browser_name: "Chrome", browser_version: "125.0.0.0", web_rid: webRid, msToken: "" };
  const url = buildUrl("https://live.douyin.com/webcast/room/web/enter/", params);
  const signed = signUrl(url);
  const headers = { "User-Agent": UA, Authority: AUTHORITY, Referer: `https://live.douyin.com/${webRid}`, Cookie: DEFAULT_COOKIE };
  const res = await ctx.fetch(signed, { headers, timeout: 20000, http2: true });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function getRoomDetail(ctx, { roomId }) {
  const data = await fetchEnter(ctx, roomId);
  const r = data?.data?.[0];
  if (!r) throw new Error("抖音未返回房间数据");
  const live = (r.status ?? 0) === 2;
  return {
    platform: "douyin", roomId, title: r.title ?? "",
    cover: live ? r.cover?.url_list?.[0] : undefined,
    uname: live ? r.owner?.nickname : data?.user?.nickname,
    avatar: live ? r.owner?.avatar_thumb?.url_list?.[0] : data?.user?.avatar_thumb?.url_list?.[0],
    online: parseDisplayCount(r.room_view_stats?.display_value),
    introduction: r.owner?.signature, live, link: `https://live.douyin.com/${roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try { const d = await getRoomDetail(ctx, { roomId }); return d.live; } catch { return false; }
}

function pickStreamUrls(stream) {
  const qualities = stream.live_core_sdk_data?.pull_data?.options?.qualities ?? [];
  const streamDataStr = stream.live_core_sdk_data?.pull_data?.stream_data ?? "";
  const alts = [];
  let primary = "", type = "hls";
  if (streamDataStr.startsWith("{")) {
    let parsed = {};
    try { parsed = JSON.parse(streamDataStr); } catch {}
    const qData = parsed.data ?? {};
    for (const q of qualities) {
      const main = q.sdk_key ? qData[q.sdk_key]?.main : undefined;
      const hls = main?.hls, flv = main?.flv;
      if (hls) { alts.push({ qn: String(q.level), label: q.name, url: hls }); if (!primary) { primary = hls; type = "hls"; } }
      else if (flv) { alts.push({ qn: String(q.level), label: q.name, url: flv }); if (!primary) { primary = flv; type = "flv"; } }
    }
  } else {
    const flvList = Object.values(stream.flv_pull_url ?? {});
    const hlsList = Object.values(stream.hls_pull_url_map ?? {});
    for (const q of qualities) {
      const hlsIdx = hlsList.length - q.level, flvIdx = flvList.length - q.level;
      const hlsUrl = hlsIdx >= 0 && hlsIdx < hlsList.length ? hlsList[hlsIdx] : "";
      const flvUrl = flvIdx >= 0 && flvIdx < flvList.length ? flvList[flvIdx] : "";
      const chosen = hlsUrl || flvUrl;
      if (!chosen) continue;
      alts.push({ qn: String(q.level), label: q.name, url: chosen });
      if (!primary) { primary = chosen; type = hlsUrl ? "hls" : "flv"; }
    }
  }
  return { primary, type, alts };
}

export async function resolve(ctx, { roomId }) {
  const data = await fetchEnter(ctx, roomId);
  const r = data?.data?.[0];
  if (!r) throw new Error("抖音未返回房间数据");
  if ((r.status ?? 0) !== 2) throw new Error("抖音直播间未开播");
  const stream = r.stream_url;
  if (!stream) throw new Error("抖音未返回 stream_url");
  const picked = pickStreamUrls(stream);
  if (!picked.primary) throw new Error("抖音未匹配到可播流");
  const opts = { url: picked.primary, qn: picked.alts[0]?.qn, qnLabel: picked.alts[0]?.label, alternatives: picked.alts.length > 0 ? picked.alts : undefined, referer: REFERER + "/", ua: UA };
  if (picked.type === "flv") return ctx.protocols.flvStream(opts);
  return ctx.protocols.hlsStream(opts);
}
