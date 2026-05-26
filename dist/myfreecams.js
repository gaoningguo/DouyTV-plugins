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
  var manifest = {
    id: "myfreecams",
    label: "MyFreeCams",
    version: "1.0.0",
    adult: true,
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.myfreecams.com/";
  var listingCache = null;
  var LISTING_TTL_MS = 5 * 60 * 1e3;
  async function fetchListing(ctx) {
    const now = Date.now();
    if (listingCache && now - listingCache.at < LISTING_TTL_MS) {
      return listingCache.items;
    }
    const proxyUrl = null;
    try {
      const items = await ctx.invoke("mfc_list_online", { proxyUrl });
      if (items.length === 0) {
        try {
          const report = await ctx.invoke("mfc_diagnose", { proxyUrl });
          console.warn("[mfc diagnose report]\n" + report);
        } catch (de) {
          console.error("[mfc] diagnose itself failed:", de);
        }
      } else {
        listingCache = { items, at: now };
      }
      return items;
    } catch (e) {
      console.error("[mfc] mfc_list_online invoke failed:", e);
      throw e;
    }
  }
  function listItemToRoom(m) {
    return {
      platform: "myfreecams",
      roomId: m.nm,
      title: m.topic || m.nm,
      uname: m.nm,
      online: m.rc ?? 0,
      category: m.country,
      cover: m.thumb_url,
      live: m.vs === 0,
      link: "https://www.myfreecams.com/#" + encodeURIComponent(m.nm)
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const all = await fetchListing(ctx);
    const p = Math.max(1, page);
    const ps = Math.max(1, pageSize);
    const start = (p - 1) * ps;
    const slice = all.slice(start, start + ps);
    return {
      list: slice.map(listItemToRoom),
      hasMore: start + ps < all.length
    };
  }
  async function search(ctx, { keyword, page }) {
    const all = await fetchListing(ctx);
    const kw = keyword.trim().toLowerCase();
    if (!kw) return { list: [], hasMore: false };
    const filtered = all.filter(
      (m) => m.nm.toLowerCase().includes(kw) || (m.topic ?? "").toLowerCase().includes(kw)
    );
    return { list: filtered.map(listItemToRoom), hasMore: false };
  }
  async function resolve(ctx, { roomId }) {
    const cache = listingCache?.items.find(
      (m) => m.nm.toLowerCase() === roomId.toLowerCase()
    );
    if (cache?.hls_url) {
      return ctx.protocols.hlsStream({
        url: cache.hls_url,
        qn: "auto",
        qnLabel: "\u81EA\u9002\u5E94",
        referer: REFERER,
        ua: UA
      });
    }
    if (!cache) {
      const items = await fetchListing(ctx);
      const hit = items.find(
        (m) => m.nm.toLowerCase() === roomId.toLowerCase()
      );
      if (hit?.hls_url) {
        return ctx.protocols.hlsStream({
          url: hit.hls_url,
          qn: "auto",
          qnLabel: "\u81EA\u9002\u5E94",
          referer: REFERER,
          ua: UA
        });
      }
      if (hit) throw new Error("MyFreeCams \u4E3B\u64AD " + roomId + " \u672A\u5728\u516C\u5F00\u5217\u8868\uFF08\u53EF\u80FD\u79C1\u804A/\u79BB\u7EBF\uFF09");
      throw new Error("MyFreeCams \u4E3B\u64AD " + roomId + " \u5F53\u524D listing \u4E2D\u4E0D\u5B58\u5728");
    }
    throw new Error("MyFreeCams \u4E3B\u64AD " + roomId + " \u5F53\u524D\u4E0D\u5728\u7EBF\u6216\u975E\u516C\u5F00\u804A\u5929");
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const items = await fetchListing(ctx);
      const hit = items.find(
        (m) => m.nm.toLowerCase() === roomId.toLowerCase()
      );
      return !!hit && hit.vs === 0;
    } catch {
      return false;
    }
  }
  return __toCommonJS(myfreecams_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
