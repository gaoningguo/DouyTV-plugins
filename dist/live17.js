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

  // plugins/live17.js
  var live17_exports = {};
  __export(live17_exports, {
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
  var REFERER = "https://17.live/";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://17.live", Accept: "application/json, text/plain, */*", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" };
  var manifest = {
    id: "live17",
    label: "17 Live",
    version: "1.0.0",
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function normalizeImage(url) {
    if (!url) return void 0;
    return url.startsWith("http") ? url : `https://cdn.17app.co/${url}`;
  }
  function mapStream(s) {
    const user = s.userInfo;
    const roomId = user?.userID ?? s.userID;
    if (!roomId) return void 0;
    return {
      platform: "live17",
      roomId,
      title: s.caption ?? user?.displayName ?? user?.openID ?? roomId,
      uname: user?.displayName ?? user?.openID ?? roomId,
      avatar: normalizeImage(user?.picture),
      cover: normalizeImage(s.thumbnail) ?? s.coverPhoto,
      online: s.liveViewerCount ?? s.viewerCount ?? 0,
      category: "17Live",
      live: s.status === 2,
      link: `https://17.live/live/${roomId}`
    };
  }
  async function fetchCells(ctx, tab, count) {
    const qs = new URLSearchParams({ count: String(count ?? 20), cursor: "", paging: "1", region: "SG", tab: tab ?? "hot_opt" });
    const res = await ctx.fetch(`https://wap-api.17app.co/api/v1/cells?${qs.toString()}`, {
      headers: HEADERS,
      timeout: 25e3
    });
    if (!res.ok) throw new Error(`17Live HTTP ${res.status}`);
    const data = await res.json();
    const list = [];
    for (const cell of data.cells ?? []) {
      if (cell.type !== 0 || !cell.stream) continue;
      const r = mapStream(cell.stream);
      if (r) list.push(r);
    }
    return { list, cursor: data.cursor, raw: data.cells ?? [] };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    if (page > 1) return { list: [], hasMore: false };
    const data = await fetchCells(ctx, "hot_opt", Math.max(pageSize, 20));
    return { list: data.list, hasMore: !!data.cursor };
  }
  async function getCategories(ctx) {
    return [
      { id: "hot_opt", name: "\u70ED\u95E8" },
      { id: "nearby_opt", name: "\u9644\u8FD1" },
      { id: "follow_opt", name: "\u5173\u6CE8" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    if (page > 1) return { list: [], hasMore: false };
    const data = await fetchCells(ctx, categoryId, 20);
    return { list: data.list, hasMore: !!data.cursor };
  }
  async function search(ctx, { keyword }) {
    const data = await fetchCells(ctx, "hot_opt", 50);
    const kw = keyword.toLowerCase();
    return {
      list: data.list.filter((r) => r.title?.toLowerCase().includes(kw) || r.uname?.toLowerCase().includes(kw)),
      hasMore: false
    };
  }
  async function fetchRoom(ctx, roomId) {
    const res = await ctx.fetch("https://wap-api.17app.co/api/v1/cells?count=50&cursor=&paging=1&region=SG&tab=hot_opt", {
      headers: HEADERS,
      timeout: 25e3
    });
    if (!res.ok) return null;
    const data = await res.json();
    for (const cell of data.cells ?? []) {
      if (cell.stream?.userInfo?.userID === roomId) return cell.stream;
    }
    return null;
  }
  async function getRoomDetail(ctx, { roomId }) {
    const stream = await fetchRoom(ctx, roomId);
    if (!stream) throw new Error(`17Live \u623F\u95F4 ${roomId} \u672A\u627E\u5230`);
    const r = mapStream(stream);
    if (!r) throw new Error(`17Live \u623F\u95F4 ${roomId} \u89E3\u6790\u5931\u8D25`);
    return r;
  }
  async function getLiveStatus(ctx, { roomId }) {
    const stream = await fetchRoom(ctx, roomId);
    return stream?.status === 2;
  }
  function flvToHls(url) {
    if (url.includes("wansu")) return url.replace(".flv", "/playlist.m3u8");
    return url.replace("pull-rtmp", "pull-hls").replace(".flv", ".m3u8");
  }
  async function resolve(ctx, { roomId }) {
    const stream = await fetchRoom(ctx, roomId);
    if (!stream) throw new Error(`17Live \u623F\u95F4 ${roomId} \u672A\u627E\u5230`);
    if (stream.status !== 2) throw new Error("17Live \u672A\u5F00\u64AD");
    const urls = stream.pullURLsInfo?.rtmpURLs ?? stream.rtmpUrls ?? [];
    if (urls.length === 0) throw new Error("17Live \u672A\u8FD4\u56DE\u6D41\u5730\u5740");
    const best = urls.find((v) => !!v.urlQualityEnhancedHD) ?? urls[0];
    const flvUrl = best.urlQualityEnhancedHD ?? best.urlHighQuality ?? best.url ?? best.urlLowQuality;
    if (!flvUrl) throw new Error("17Live FLV \u5730\u5740\u4E3A\u7A7A");
    const alternatives = urls.map((v) => {
      const u = v.urlQualityEnhancedHD ?? v.urlHighQuality ?? v.url;
      if (!u) return null;
      return { qn: String(v.provider ?? "auto"), label: `\u7EBF\u8DEF ${v.provider ?? "auto"}`, url: flvToHls(u) };
    }).filter(Boolean);
    return ctx.protocols.hlsStream({
      url: flvToHls(flvUrl),
      qn: "origin",
      qnLabel: "\u539F\u753B",
      alternatives,
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(live17_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
