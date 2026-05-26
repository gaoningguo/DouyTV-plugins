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

  // plugins/amateurtv.js
  var amateurtv_exports = {};
  __export(amateurtv_exports, {
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
  var STREAM_UA = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  var REFERER = "https://www.amateur.tv/";
  var HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Origin: "https://www.amateur.tv",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9"
  };
  var manifest = {
    id: "amateurtv",
    label: "AmateurTV",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function absUrl(u) {
    if (!u) return void 0;
    if (u.startsWith("http")) return u;
    return `https://www.amateur.tv${u}`;
  }
  function mapCam(c) {
    if (!c.username) return void 0;
    return {
      platform: "amateurtv",
      roomId: c.username,
      title: c.topic || c.username,
      uname: c.username,
      avatar: absUrl(c.optimized?.avatar) || absUrl(c.avatar),
      cover: absUrl(c.optimized?.fullCapture) || absUrl(c.optimized?.capture) || absUrl(c.fullCapture) || absUrl(c.capture),
      online: c.viewers ?? 0,
      category: c.tags?.slice(0, 5).join(", ") || c.countryName,
      live: c.online ?? true,
      link: `https://www.amateur.tv/${c.username}`
    };
  }
  async function fetchList(ctx) {
    const res = await ctx.fetch("https://www.amateur.tv/v3/readmodel/cache/onlinecamlist-cam-score", {
      headers: HEADERS,
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error(`AmateurTV HTTP ${res.status}`);
    return res.json();
  }
  async function fetchShow(ctx, username) {
    const res = await ctx.fetch(`https://www.amateur.tv/v3/readmodel/show/${encodeURIComponent(username)}/en`, {
      headers: HEADERS,
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error(`AmateurTV HTTP ${res.status}`);
    return res.json();
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const data = await fetchList(ctx);
    const all = (data.cams ?? []).map(mapCam).filter(Boolean);
    const start = (page - 1) * pageSize;
    return { list: all.slice(start, start + pageSize), hasMore: start + pageSize < all.length };
  }
  async function search(ctx, { keyword, page }) {
    const data = await fetchList(ctx);
    const lower = keyword.toLowerCase();
    const matched = (data.cams ?? []).filter(
      (c) => c.username?.toLowerCase().includes(lower) || c.topic?.toLowerCase().includes(lower) || c.tags?.some((t) => t.toLowerCase().includes(lower))
    ).map(mapCam).filter(Boolean);
    const ps = 20;
    const start = (page - 1) * ps;
    return { list: matched.slice(start, start + ps), hasMore: start + ps < matched.length };
  }
  async function getRoomDetail(ctx, { roomId }) {
    const list = await fetchList(ctx);
    const found = list.cams?.find((x) => x.username?.toLowerCase() === roomId.toLowerCase());
    if (found) return mapCam(found);
    const show = await fetchShow(ctx, roomId);
    return {
      platform: "amateurtv",
      roomId,
      title: roomId,
      uname: roomId,
      live: show.status === "online",
      category: show.privateChatStatus ? "private" : "public",
      link: `https://www.amateur.tv/${roomId}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const data = await fetchShow(ctx, roomId);
      return data.status === "online" && !data.privateChatStatus;
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const data = await fetchShow(ctx, roomId);
    if (data.message === "NOT_FOUND") throw new Error(`AmateurTV ${roomId} \u4E0D\u5B58\u5728`);
    if (data.status !== "online") throw new Error(`AmateurTV ${roomId} \u4E0D\u5728\u7EBF`);
    if (data.privateChatStatus) throw new Error(`AmateurTV ${roomId} \u79C1\u5BC6\u6A21\u5F0F`);
    const m3u8Url = data.videoTechnologies?.["fmp4-hls"];
    if (!m3u8Url) throw new Error("AmateurTV \u672A\u8FD4\u56DE fmp4-hls");
    return ctx.protocols.sampleAesMp4Stream({
      url: m3u8Url,
      qnLabel: data.qualities?.[0] ?? "auto",
      referer: REFERER,
      ua: STREAM_UA
    });
  }
  return __toCommonJS(amateurtv_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
