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

  // plugins/pandalive.js
  var pandalive_exports = {};
  __export(pandalive_exports, {
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
  var REFERER = "https://www.pandalive.co.kr/";
  var API = "https://api.pandalive.co.kr";
  var HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Origin: "https://www.pandalive.co.kr",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    Accept: "application/json, text/plain, */*",
    "X-Device-Info": JSON.stringify({ t: "webPc", v: "1.0", ui: "0", ck: { sessKeyAsp: "" } })
  };
  var manifest = {
    id: "pandalive",
    label: "PandaTV (\u97E9\u56FD BJ)",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function mapRoom(r) {
    if (!r.userId) return void 0;
    return {
      platform: "pandalive",
      roomId: r.userId,
      title: r.title || r.userNick || r.userId,
      uname: r.userNick || r.userId,
      avatar: r.userImg,
      cover: r.thumbUrl,
      online: r.user ?? 0,
      category: r.isAdult ? "19+" : r.category,
      live: r.isLive ?? true,
      link: `https://www.pandalive.co.kr/live/play/${r.userId}`
    };
  }
  async function getJson(ctx, path, params) {
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
    const res = await ctx.fetch(`${API}${path}?${qs}`, { headers: HEADERS, timeout: 25e3, http2: true });
    if (!res.ok) {
      if (res.status === 403 || res.status === 503) throw new Error(`[LIST_UNSUPPORTED]Pandalive HTTP ${res.status},\u9700\u914D\u7F6E\u4EE3\u7406`);
      throw new Error(`Pandalive HTTP ${res.status}`);
    }
    return res.json();
  }
  async function postForm(ctx, path, body) {
    const form = Object.entries(body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    const res = await ctx.fetch(`${API}${path}`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error(`Pandalive HTTP ${res.status}`);
    return res.json();
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const limit = Math.max(pageSize, 24);
    const offset = (page - 1) * limit;
    const data = await getJson(ctx, "/v1/live/index", { orderBy: "user", onlyNewBj: "N", limit, offset });
    if (data.result === false) throw new Error(`[LIST_UNSUPPORTED]Pandalive: ${data.errorData?.message || "\u4EE3\u7406 IP \u88AB\u98CE\u63A7"}`);
    const arr = data.list ?? [];
    const pg = data.page;
    const hasMore = pg ? (pg.page ?? page) < (pg.lastPage ?? 0) : arr.length >= limit;
    return { list: arr.map(mapRoom).filter(Boolean), hasMore };
  }
  async function getCategories(ctx) {
    return [
      { id: "user", name: "\u4EBA\u6C14" },
      { id: "newBj", name: "\u65B0\u4EBA" },
      { id: "bookmark", name: "\u6536\u85CF\u591A" },
      { id: "adult", name: "19+" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const isAdult = categoryId === "adult";
    const orderBy = isAdult ? "user" : categoryId;
    const params = { orderBy, onlyNewBj: "N", limit: 24, offset: (page - 1) * 24 };
    if (isAdult) params.isAdult = true;
    const data = await getJson(ctx, "/v1/live/index", params);
    if (data.result === false) throw new Error(`[LIST_UNSUPPORTED]Pandalive: ${data.errorData?.message || "\u98CE\u63A7"}`);
    const arr = data.list ?? [];
    return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length >= 24 };
  }
  async function search(ctx, { keyword }) {
    try {
      const res = await ctx.fetch(`${API}/v1/live/bj_list`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, orderBy: "user", onlyNewBj: "N", limit: 30, offset: 0 }),
        timeout: 25e3,
        http2: true
      });
      if (!res.ok) return { list: [], hasMore: false };
      const data = await res.json();
      return { list: (data.list ?? []).map(mapRoom).filter(Boolean), hasMore: false };
    } catch {
      return { list: [], hasMore: false };
    }
  }
  async function getRoomDetail(ctx, { roomId }) {
    const data = await postForm(ctx, "/v1/live/play", { userId: roomId, action: "watch", password: "", shareLinkType: "" });
    if (!data.media) throw new Error(`Pandalive ${roomId} \u672A\u627E\u5230`);
    const m = data.media;
    return {
      platform: "pandalive",
      roomId,
      title: m.title || m.userNick || roomId,
      uname: m.userNick,
      avatar: m.userImg,
      cover: m.thumbUrl,
      online: m.user ?? 0,
      category: m.isAdult ? "19+" : m.category,
      live: m.isLive ?? true,
      link: `https://www.pandalive.co.kr/live/play/${roomId}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const data = await postForm(ctx, "/v1/live/play", { userId: roomId, action: "watch", password: "", shareLinkType: "" });
      return !!data.media?.isLive;
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const data = await postForm(ctx, "/v1/live/play", { userId: roomId, action: "watch", password: "", shareLinkType: "" });
    if (data.errorData?.code) {
      const c = data.errorData.code;
      if (c === "needAdult" || c === "needLogin") throw new Error("Pandalive \u8BE5\u623F\u95F4\u9700\u767B\u5F55 + 19+ \u5E74\u9F84\u9A8C\u8BC1");
      if (c === "needPw") throw new Error("Pandalive \u8BE5\u623F\u95F4\u5DF2\u52A0\u5BC6");
      throw new Error(`Pandalive \u62C9\u6D41\u5931\u8D25: ${data.errorData.message ?? c}`);
    }
    const pl = data.PlayList;
    const url = pl?.hls3?.[0]?.url || pl?.hls2?.[0]?.url || pl?.hls?.[0]?.url;
    if (!url) throw new Error("Pandalive \u672A\u8FD4\u56DE hls URL");
    const alts = [
      ...(pl?.hls3 ?? []).map((x, i) => ({ qn: `hls3_${i}`, label: x.name ?? "\u539F\u753B", url: x.url })),
      ...(pl?.hls2 ?? []).map((x, i) => ({ qn: `hls2_${i}`, label: x.name ?? "\u6807\u6E05", url: x.url })),
      ...(pl?.hls ?? []).map((x, i) => ({ qn: `hls_${i}`, label: x.name ?? "\u517C\u5BB9", url: x.url }))
    ].filter((a) => a.url);
    return ctx.protocols.hlsStream({
      url,
      qnLabel: "\u539F\u753B",
      alternatives: alts.length > 1 ? alts : void 0,
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(pandalive_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
