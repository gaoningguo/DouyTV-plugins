"use strict";
var __plugin__ = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // plugins/youtube.js
  var youtube_exports = {};
  __export(youtube_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.youtube.com/";
  var HEADERS = { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8", Referer: REFERER };
  var SP_LIVE = "EgJAAQ%3D%3D";
  var cursorCache = /* @__PURE__ */ new Map();
  var cachedApiKey = null;
  var manifest = {
    id: "youtube",
    label: "YouTube",
    version: "1.0.0",
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function cursorMap(key) {
    let m = cursorCache.get(key);
    if (!m) {
      m = /* @__PURE__ */ new Map();
      cursorCache.set(key, m);
    }
    return m;
  }
  async function fetchHtml(ctx, url) {
    const res = await ctx.fetch(url, { headers: HEADERS, timeout: 25e3, http2: true });
    if (!res.ok) throw new Error(`YouTube HTTP ${res.status}`);
    return res.text();
  }
  function pickText(t) {
    if (!t || typeof t !== "object") return void 0;
    if (typeof t.simpleText === "string") return t.simpleText;
    if (Array.isArray(t.runs)) return t.runs.map((r) => r?.text ?? "").join("");
    return void 0;
  }
  function parseViewCount(txt) {
    if (!txt) return void 0;
    const cleaned = txt.replace(/[,，]/g, "");
    const m = cleaned.match(/([0-9]+(?:\.[0-9]+)?)\s*([KkMm万千])?/);
    if (!m) return void 0;
    const n = parseFloat(m[1]);
    const u = m[2];
    if (!u) return Math.round(n);
    if (u === "K" || u === "k" || u === "\u5343") return Math.round(n * 1e3);
    if (u === "M" || u === "m") return Math.round(n * 1e6);
    if (u === "\u4E07") return Math.round(n * 1e4);
    return Math.round(n);
  }
  function mapVideo(r) {
    if (!r.videoId) return void 0;
    const badges = r.badges ?? [];
    const isLive = badges.some(
      (b) => b.metadataBadgeRenderer?.style?.toUpperCase().includes("LIVE") || b.metadataBadgeRenderer?.label?.toUpperCase().includes("LIVE") || b.metadataBadgeRenderer?.label?.includes("\u76F4\u64AD")
    );
    if (!isLive) return void 0;
    const title = pickText(r.title) ?? "";
    const uname = pickText(r.ownerText) ?? pickText(r.longBylineText);
    const thumbs = r.thumbnail?.thumbnails ?? [];
    const cover = thumbs[thumbs.length - 1]?.url;
    const avatarThumbs = r.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails ?? [];
    const avatar = avatarThumbs[avatarThumbs.length - 1]?.url;
    const viewText = pickText(r.viewCountText) ?? pickText(r.shortViewCountText);
    return {
      platform: "youtube",
      roomId: r.videoId,
      title,
      uname,
      cover,
      avatar,
      online: parseViewCount(viewText),
      live: true,
      link: `https://www.youtube.com/watch?v=${r.videoId}`
    };
  }
  function extractInitial(html) {
    let m = html.match(/var ytInitialData\s*=\s*(\{.*?\});<\/script>/s);
    if (!m) m = html.match(/window\["ytInitialData"\]\s*=\s*(\{.*?\});/s);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  async function getApiKey(ctx) {
    if (cachedApiKey) return cachedApiKey;
    try {
      const html = await fetchHtml(ctx, "https://www.youtube.com/");
      const m = html.match(/"INNERTUBE_API_KEY":\s*"([^"]+)"/);
      if (m) {
        cachedApiKey = m[1];
        return cachedApiKey;
      }
    } catch {
    }
    return null;
  }
  function collectFromSections(sections) {
    const items = [];
    let continuation;
    for (const sec of sections) {
      if (sec.itemSectionRenderer?.contents) items.push(...sec.itemSectionRenderer.contents);
      if (sec.continuationItemRenderer) {
        const tok = sec.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
        if (tok) continuation = tok;
      }
    }
    return { items, continuation };
  }
  async function searchLive(ctx, keyword, page) {
    const cKey = `search:${keyword}`;
    const map = cursorMap(cKey);
    let payload;
    if (page === 1) {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=${SP_LIVE}`;
      const html = await fetchHtml(ctx, url);
      payload = extractInitial(html) ?? {};
    } else {
      const continuation2 = map.get(page - 1);
      if (!continuation2) return { list: [], hasMore: false };
      const apiKey = await getApiKey(ctx);
      if (!apiKey) return { list: [], hasMore: false };
      const res = await ctx.fetch(`https://www.youtube.com/youtubei/v1/search?key=${apiKey}&prettyPrint=false`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion: "2.20251101.00.00", hl: "zh-CN", gl: "US" } },
          continuation: continuation2
        }),
        timeout: 25e3
      });
      if (!res.ok) return { list: [], hasMore: false };
      payload = await res.json();
    }
    const sections = payload.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ?? payload.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction?.continuationItems ?? [];
    const { items, continuation } = collectFromSections(sections);
    if (continuation) map.set(page, continuation);
    const list = [];
    for (const it of items) {
      if (!it.videoRenderer) continue;
      const r = mapVideo(it.videoRenderer);
      if (r) list.push(r);
    }
    return { list, hasMore: !!continuation && list.length > 0 };
  }
  async function getRecommend(ctx, { page }) {
    return searchLive(ctx, "", page);
  }
  async function search(ctx, { keyword, page }) {
    return searchLive(ctx, keyword, page);
  }
  async function getCategories(ctx) {
    return [
      { id: "Gaming", name: "\u6E38\u620F" },
      { id: "Music", name: "\u97F3\u4E50" },
      { id: "News", name: "\u65B0\u95FB" },
      { id: "Sports", name: "\u4F53\u80B2" },
      { id: "Education", name: "\u6559\u80B2" },
      { id: "Tech", name: "\u79D1\u6280" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    return searchLive(ctx, categoryId, page);
  }
  var INNERTUBE_CLIENTS = [
    { clientName: "ANDROID_VR", clientVersion: "1.65.10", clientNumber: 28, deviceMake: "Oculus", deviceModel: "Quest 3", androidSdkVersion: 32, osName: "Android", osVersion: "12L", userAgent: "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip" },
    { clientName: "TVHTML5", clientVersion: "7.20260114.12.00", clientNumber: 7, userAgent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko)" },
    { clientName: "MWEB", clientVersion: "2.20260115.01.00", clientNumber: 2, userAgent: "Mozilla/5.0 (iPad; CPU OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 Version/16.6 Mobile/15E148 Safari/604.1", host: "m.youtube.com" },
    { clientName: "WEB", clientVersion: "2.20260114.08.00", clientNumber: 1, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/15.5 Safari/605.1.15" }
  ];
  async function fetchPlayer(ctx, videoId) {
    const apiKey = await getApiKey(ctx) ?? "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
    const reasons = [];
    for (const c of INNERTUBE_CLIENTS) {
      try {
        const host = c.host ?? "www.youtube.com";
        const ctx_ = { client: { clientName: c.clientName, clientVersion: c.clientVersion, userAgent: c.userAgent, hl: "en", gl: "US", timeZone: "UTC", utcOffsetMinutes: 0 } };
        if (c.androidSdkVersion) ctx_.client.androidSdkVersion = c.androidSdkVersion;
        if (c.osName) ctx_.client.osName = c.osName;
        if (c.osVersion) ctx_.client.osVersion = c.osVersion;
        if (c.deviceMake) ctx_.client.deviceMake = c.deviceMake;
        if (c.deviceModel) ctx_.client.deviceModel = c.deviceModel;
        const res = await ctx.fetch(`https://${host}/youtubei/v1/player?key=${apiKey}&prettyPrint=false`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": c.userAgent, "X-YouTube-Client-Name": String(c.clientNumber), "X-YouTube-Client-Version": c.clientVersion, Origin: `https://${host}`, Referer: `https://${host}/`, "Accept-Language": "en-US,en;q=0.9" },
          body: JSON.stringify({ context: ctx_, videoId, contentCheckOk: true, racyCheckOk: true, playbackContext: { contentPlaybackContext: { html5Preference: "HTML5_PREF_WANTS" } } }),
          timeout: 25e3,
          http2: true
        });
        if (!res.ok) {
          reasons.push(`${c.clientName}: HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        if (data?.streamingData?.hlsManifestUrl || data?.streamingData?.dashManifestUrl) return data;
        reasons.push(`${c.clientName}: ${data?.playabilityStatus?.status ?? "no_streaming"} - ${data?.playabilityStatus?.reason ?? ""}`);
      } catch (e) {
        reasons.push(`${c.clientName}: ${e.message}`);
      }
    }
    throw new Error(`YouTube Innertube \u5168\u5931\u8D25: ${reasons[reasons.length - 1] ?? "?"}`);
  }
  async function getRoomDetail(ctx, { roomId }) {
    const p = await fetchPlayer(ctx, roomId);
    const v = p?.videoDetails;
    if (!v) throw new Error(`YouTube ${roomId} \u672A\u627E\u5230`);
    return {
      platform: "youtube",
      roomId: v.videoId ?? roomId,
      title: v.title ?? "",
      uname: v.author,
      cover: v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url,
      online: v.viewCount ? parseInt(v.viewCount, 10) : 0,
      introduction: v.shortDescription,
      live: !!v.isLive,
      link: `https://www.youtube.com/watch?v=${v.videoId ?? roomId}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const p = await fetchPlayer(ctx, roomId);
      return p?.playabilityStatus?.status === "OK" && !!p?.videoDetails?.isLive;
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const p = await fetchPlayer(ctx, roomId);
    const status = p?.playabilityStatus?.status;
    if (status && status !== "OK" && status !== "LIVE_STREAM_OFFLINE") {
      throw new Error(p?.playabilityStatus?.reason || `YouTube ${status}`);
    }
    const hls = p?.streamingData?.hlsManifestUrl;
    if (!hls) throw new Error("YouTube \u672A\u8FD4\u56DE HLS");
    return ctx.protocols.hlsStream({ url: hls, referer: REFERER, ua: UA });
  }
  return __toCommonJS(youtube_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
