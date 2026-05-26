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

  // plugins/fc2live.js
  var fc2live_exports = {};
  __export(fc2live_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://live.fc2.com/";
  var LIST_URL = "https://live.fc2.com/adult/contents/allchannellist.php";
  var HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Origin: "https://live.fc2.com",
    "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
    Accept: "application/json, text/plain, */*"
  };
  var SEX_LABEL = { w: "\u2640 Female", m: "\u2642 Male", c: "Couple", t: "Trans" };
  var cachedList = null;
  var TTL = 6e4;
  var manifest = {
    id: "fc2live",
    label: "FC2 Live (\u65E5\u672C BJ)",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  async function fetchAll(ctx) {
    if (cachedList && cachedList.expiry > Date.now()) return cachedList.data;
    const res = await ctx.fetch(LIST_URL, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error(`FC2 HTTP ${res.status}`);
    const data = await res.json();
    const channels = data.channel ?? [];
    cachedList = { data: channels, expiry: Date.now() + TTL };
    return channels;
  }
  function isOpen(c) {
    return !c.pay && !c.login;
  }
  function mapRoom(c) {
    if (!c.id) return void 0;
    const cat = [
      c.sex ? SEX_LABEL[c.sex] || c.sex : null,
      c.pay ? "\u{1F4B0} \u4ED8\u8D39\u623F" : null,
      !c.pay && c.login ? "\u{1F512} \u4F1A\u5458\u623F" : null,
      isOpen(c) ? null : "\u26A0 \u533F\u540D\u65E0\u6CD5\u64AD\u653E"
    ].filter(Boolean).join(" \xB7 ");
    return {
      platform: "fc2live",
      roomId: c.id,
      title: c.title || c.name || c.id,
      uname: c.name || c.id,
      cover: c.image,
      online: c.count ?? 0,
      category: cat || void 0,
      live: true,
      link: `https://live.fc2.com/${c.id}/`
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const all = await fetchAll(ctx);
    const sorted = all.filter(isOpen).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    const start = (page - 1) * pageSize;
    const slice = sorted.slice(start, start + pageSize);
    return { list: slice.map(mapRoom).filter(Boolean), hasMore: start + pageSize < sorted.length };
  }
  async function getCategories(ctx) {
    return [
      { id: "popular", name: "\u4EBA\u6C14" },
      { id: "new", name: "\u65B0\u4EBA" },
      { id: "female", name: "\u2640 Female" },
      { id: "male", name: "\u2642 Male" },
      { id: "couple", name: "Couple" },
      { id: "all", name: "\u5168\u90E8 (\u542B\u4ED8\u8D39)" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const all = await fetchAll(ctx);
    const pool = categoryId === "all" ? all : all.filter(isOpen);
    let filtered;
    switch (categoryId) {
      case "new":
        filtered = [...pool].sort((a, b) => (b.start_time ?? 0) - (a.start_time ?? 0));
        break;
      case "female":
        filtered = pool.filter((c) => c.sex === "w");
        break;
      case "male":
        filtered = pool.filter((c) => c.sex === "m");
        break;
      case "couple":
        filtered = pool.filter((c) => c.sex === "c");
        break;
      default:
        filtered = [...pool].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    }
    const ps = 24;
    const start = (page - 1) * ps;
    const slice = filtered.slice(start, start + ps);
    return { list: slice.map(mapRoom).filter(Boolean), hasMore: start + ps < filtered.length };
  }
  async function search(ctx, { keyword }) {
    if (!keyword.trim()) return { list: [], hasMore: false };
    const all = await fetchAll(ctx);
    const kw = keyword.toLowerCase();
    const hits = all.filter(
      (c) => (c.title ?? "").toLowerCase().includes(kw) || (c.name ?? "").toLowerCase().includes(kw) || (c.id ?? "").toLowerCase().includes(kw)
    );
    return { list: hits.map(mapRoom).filter(Boolean), hasMore: false };
  }
  async function resolve(ctx, { roomId }) {
    if (cachedList?.expiry > Date.now()) {
      const ch = cachedList.data.find((c) => c.id === roomId);
      if (ch?.pay) throw new Error(`FC2 Live: \u8BE5\u623F\u95F4\u662F\u4ED8\u8D39\u623F,\u533F\u540D\u65E0\u6CD5\u64AD\u653E`);
      if (ch?.login) throw new Error(`FC2 Live: \u8BE5\u623F\u95F4\u9650\u4F1A\u5458\u89C2\u770B`);
    }
    const hlsUrl = await ctx.invoke("fc2_resolve_hls", { channelId: roomId, proxyUrl: null });
    return ctx.protocols.hlsStream({ url: hlsUrl, qnLabel: "\u539F\u753B", referer: REFERER, ua: UA });
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const all = await fetchAll(ctx);
      return all.some((c) => c.id === roomId);
    } catch {
      return false;
    }
  }
  return __toCommonJS(fc2live_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
