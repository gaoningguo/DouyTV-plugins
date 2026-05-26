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

  // plugins/bigo.js
  var bigo_exports = {};
  __export(bigo_exports, {
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
  var REFERER = "https://www.bigo.tv/";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://www.bigo.tv", Accept: "application/json, text/plain, */*", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" };
  var HTML_HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" };
  var manifest = {
    id: "bigo",
    label: "Bigo Live",
    version: "1.0.0",
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function mapRoom(r) {
    const id = r.bigo_id ?? r.uid ?? r.alias ?? r.room_id;
    if (id === void 0 || id === null) return void 0;
    const slug = String(id);
    return {
      platform: "bigo",
      roomId: slug,
      title: r.room_topic ?? r.nick_name ?? r.user_name ?? r.alias ?? slug,
      uname: r.nick_name ?? r.user_name ?? r.alias ?? slug,
      avatar: r.avatar_url ?? r.avatar ?? r.data1,
      cover: r.cover_l ?? r.cover_m ?? r.big_url ?? r.cover_url ?? r.pic ?? r.data2?.bigUrl,
      online: r.user_count ?? r.audience ?? 0,
      category: r.tag ?? r.country ?? r.language,
      live: true,
      link: `https://www.bigo.tv/${slug}`
    };
  }
  async function getJson(ctx, url) {
    const res = await ctx.fetch(url, { headers: HEADERS, timeout: 25e3, http2: true });
    if (!res.ok) throw new Error(`Bigo HTTP ${res.status}`);
    return res.json();
  }
  async function postJson(ctx, url, body) {
    const res = await ctx.fetch(url, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error(`Bigo HTTP ${res.status}`);
    return res.json();
  }
  async function getRecommend(ctx, { pageSize }) {
    const limit = Math.max(pageSize, 24);
    const url = `https://ta.bigo.tv/official_website/OInterfaceWeb/vedioList/5?fetchNum=${limit}`;
    try {
      const data = await getJson(ctx, url);
      const arr = data?.data?.data ?? data?.data?.list ?? data?.data?.rooms ?? [];
      if (!Array.isArray(arr)) throw new Error("[LIST_UNSUPPORTED]Bigo \u8FD4\u56DE data \u4E0D\u662F\u6570\u7EC4");
      return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length >= limit };
    } catch (e) {
      throw new Error(`[LIST_UNSUPPORTED]Bigo: ${e.message}`);
    }
  }
  async function getCategories(ctx) {
    return [
      { id: "0", name: "\u70ED\u95E8" },
      { id: "1", name: "\u70ED\u821E" },
      { id: "2", name: "\u989C\u503C" },
      { id: "3", name: "\u5531\u89C1" },
      { id: "4", name: "\u8131\u53E3\u79C0" },
      { id: "5", name: "\u6D3E\u5BF9" },
      { id: "6", name: "\u6237\u5916" },
      { id: "7", name: "\u6E38\u620F" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const limit = 24;
    const candidates = [
      `https://www.bigo.tv/oapi/v3/getNewListV2?page=${page}&size=${limit}&tabId=${encodeURIComponent(categoryId)}`,
      `https://ta.bigo.tv/official_website/studio/getNewListV3?page=${page}&pageSize=${limit}&tabId=${encodeURIComponent(categoryId)}`
    ];
    for (const url of candidates) {
      try {
        const data = await getJson(ctx, url);
        const arr = data?.data?.data ?? data?.data?.list ?? data?.data?.rooms ?? [];
        if (Array.isArray(arr) && arr.length > 0) {
          return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length >= limit };
        }
      } catch {
      }
    }
    if (page === 1) return getRecommend(ctx, { pageSize: limit });
    return { list: [], hasMore: false };
  }
  async function search(ctx, { keyword }) {
    try {
      const data = await postJson(ctx, "https://ta.bigo.tv/official_website/studio/getSearchInfo", {
        keyword,
        page: 1,
        size: 30
      });
      const arr = data.data?.list ?? data.data?.users ?? [];
      return { list: arr.map(mapRoom).filter(Boolean), hasMore: false };
    } catch {
      return { list: [], hasMore: false };
    }
  }
  function extractInitState(html) {
    const m = html.match(/window\.__INIT_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/) || html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  async function fetchPlayInfo(ctx, roomId) {
    const url = `https://ta.bigo.tv/official_website/studio/getInternalStudioInfo?siteId=${encodeURIComponent(roomId)}&verify=`;
    try {
      const res = await ctx.fetch(url, {
        method: "POST",
        headers: { ...HEADERS, "Content-Length": "0" },
        timeout: 25e3,
        http2: true
      });
      if (!res.ok) throw new Error(`Bigo HTTP ${res.status}`);
      return res.json();
    } catch {
      const r = await ctx.fetch(`https://www.bigo.tv/${roomId}`, { headers: HTML_HEADERS, timeout: 25e3, http2: true });
      if (!r.ok) throw new Error(`Bigo HTTP ${r.status}`);
      const html = await r.text();
      const state = extractInitState(html);
      const ui = state?.pageStore?.userInfoStore?.userInfo;
      if (!ui) throw new Error("Bigo \u623F\u95F4\u6570\u636E\u7F3A\u5931");
      return {
        data: {
          hls_src: ui.live?.hls,
          big_url: ui.big_url ?? ui.cover_url,
          room_topic: ui.room_topic,
          nick_name: ui.nick_name,
          user_count: ui.user_count,
          avatar: ui.avatar_url
        }
      };
    }
  }
  async function getRoomDetail(ctx, { roomId }) {
    const info = await fetchPlayInfo(ctx, roomId);
    const d = info.data;
    if (!d) throw new Error(`Bigo \u623F\u95F4 ${roomId} \u672A\u627E\u5230`);
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
      link: `https://www.bigo.tv/${roomId}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const info = await fetchPlayInfo(ctx, roomId);
      return !!(info.data?.hls_src ?? info.data?.hls_url);
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const info = await fetchPlayInfo(ctx, roomId);
    const d = info.data;
    if (!d) throw new Error(`Bigo \u623F\u95F4 ${roomId} \u672A\u627E\u5230`);
    const url = d.hls_src ?? d.hls_url ?? d.flv_url ?? d.rtmp_url;
    if (!url) throw new Error("Bigo \u672A\u5F00\u64AD");
    if (url.includes(".flv")) return ctx.protocols.flvStream({ url, qn: "auto", qnLabel: "\u539F\u753B", referer: REFERER, ua: UA });
    return ctx.protocols.hlsStream({ url, qn: "auto", qnLabel: "\u539F\u753B", referer: REFERER, ua: UA });
  }
  return __toCommonJS(bigo_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
