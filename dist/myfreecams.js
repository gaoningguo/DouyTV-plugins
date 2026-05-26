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

  // plugins/myfreecams.js
  var myfreecams_exports = {};
  __export(myfreecams_exports, {
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.myfreecams.com/";
  var listingCache = null;
  var TTL = 5 * 60 * 1e3;
  var manifest = {
    id: "myfreecams",
    label: "MyFreeCams",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  async function fetchListing(ctx) {
    const now = Date.now();
    if (listingCache && now - listingCache.at < TTL) return listingCache.items;
    const items = await ctx.invoke("mfc_list_online", { proxyUrl: null });
    if (items.length > 0) listingCache = { items, at: now };
    return items;
  }
  function toRoom(m) {
    return {
      platform: "myfreecams",
      roomId: m.nm,
      title: m.topic || m.nm,
      uname: m.nm,
      online: m.rc ?? 0,
      category: m.country,
      cover: m.thumb_url,
      live: m.vs === 0,
      link: `https://www.myfreecams.com/#${encodeURIComponent(m.nm)}`
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const all = await fetchListing(ctx);
    const start = (page - 1) * pageSize;
    return { list: all.slice(start, start + pageSize).map(toRoom), hasMore: start + pageSize < all.length };
  }
  async function search(ctx, { keyword }) {
    const all = await fetchListing(ctx);
    const kw = keyword.trim().toLowerCase();
    if (!kw) return { list: [], hasMore: false };
    return { list: all.filter((m) => m.nm.toLowerCase().includes(kw) || (m.topic ?? "").toLowerCase().includes(kw)).map(toRoom), hasMore: false };
  }
  async function resolve(ctx, { roomId }) {
    const cached = listingCache?.items.find((m) => m.nm.toLowerCase() === roomId.toLowerCase());
    if (cached?.hls_url) return ctx.protocols.hlsStream({ url: cached.hls_url, referer: REFERER, ua: UA });
    const items = await fetchListing(ctx);
    const hit = items.find((m) => m.nm.toLowerCase() === roomId.toLowerCase());
    if (hit?.hls_url) return ctx.protocols.hlsStream({ url: hit.hls_url, referer: REFERER, ua: UA });
    if (hit) throw new Error(`MyFreeCams ${roomId} \u975E\u516C\u5F00\u804A\u5929`);
    throw new Error(`MyFreeCams ${roomId} \u4E0D\u5728 listing \u4E2D`);
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const items = await fetchListing(ctx);
      const hit = items.find((m) => m.nm.toLowerCase() === roomId.toLowerCase());
      return !!hit && hit.vs === 0;
    } catch {
      return false;
    }
  }
  return __toCommonJS(myfreecams_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
