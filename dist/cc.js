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

  // plugins/cc.js
  var cc_exports = {};
  __export(cc_exports, {
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
  var REFERER = "https://cc.163.com/";
  var HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Accept: "application/json, text/plain, */*"
  };
  var CDN_PRIORITY = ["hs", "ks", "ali", "fws", "wy"];
  var manifest = {
    id: "cc",
    label: "\u7F51\u6613 CC",
    version: "1.0.0",
    defaultProxy: "direct",
    engine: { netliveApi: 1 }
  };
  function mapRoom(r) {
    if (!r.cuteid) return void 0;
    return {
      platform: "cc",
      roomId: String(r.cuteid),
      title: r.title || r.nickname || String(r.cuteid),
      uname: r.nickname || String(r.cuteid),
      avatar: r.portrait || r.purl,
      cover: r.cover || r.purl,
      online: r.vision_visitor ?? r.visitor ?? 0,
      category: r.game_name || r.gamename,
      live: true,
      link: `https://cc.163.com/${r.cuteid}`
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const size = Math.max(pageSize, 20);
    const offset = (page - 1) * size;
    const res = await ctx.fetch(
      `https://cc.163.com/api/category/live/?format=json&start=${offset}&size=${size}`,
      { headers: HEADERS, timeout: 25e3 }
    );
    if (!res.ok) throw new Error(`CC HTTP ${res.status}`);
    const data = await res.json();
    const lives = data.lives || [];
    return { list: lives.map(mapRoom).filter(Boolean), hasMore: lives.length >= size };
  }
  async function getCategories(ctx) {
    const res = await ctx.fetch(
      `https://cc.163.com/category/?format=json`,
      { headers: HEADERS, timeout: 25e3 }
    );
    if (!res.ok) throw new Error(`CC HTTP ${res.status}`);
    const data = await res.json();
    const gameList = data.game_list || [];
    const categories = [];
    const parents = [
      { id: "all", name: "\u5168\u90E8" },
      { id: "pc_game", name: "\u7AEF\u6E38" },
      { id: "mobile_game", name: "\u624B\u6E38" },
      { id: "other", name: "\u5176\u4ED6" }
    ];
    for (const p of parents) {
      categories.push({ id: p.id, name: p.name, children: [] });
    }
    for (const g of gameList) {
      categories.push({
        id: String(g.gametype),
        name: g.gamename || g.game_tag || String(g.gametype),
        cover: g.img
      });
    }
    return categories;
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const res = await ctx.fetch(
      `https://cc.163.com/_next/data/nextjs/category/${encodeURIComponent(categoryId)}.json`,
      { headers: HEADERS, timeout: 25e3 }
    );
    if (!res.ok) throw new Error(`CC HTTP ${res.status}`);
    const data = await res.json();
    const lives = data.pageProps?.gametypeData?.lives || [];
    return { list: lives.map(mapRoom).filter(Boolean), hasMore: false };
  }
  async function search(ctx, { keyword, page }) {
    const p = page || 1;
    const res = await ctx.fetch(
      `https://cc.163.com/search/anchor?query=${encodeURIComponent(keyword)}&size=20&page=${p}`,
      { headers: HEADERS, timeout: 25e3 }
    );
    if (!res.ok) return { list: [], hasMore: false };
    const data = await res.json();
    const results = data.webcc_anchor?.result || [];
    const list = results.map((r) => ({
      platform: "cc",
      roomId: String(r.cuteid),
      title: r.title || r.nickname || String(r.cuteid),
      uname: r.nickname || String(r.cuteid),
      avatar: r.portrait,
      cover: r.portrait,
      online: r.follower_num ?? 0,
      category: r.game_name,
      live: r.status === 1 || r.status === "1",
      link: `https://cc.163.com/${r.cuteid}`
    })).filter((r) => r.roomId);
    return { list, hasMore: results.length >= 20 };
  }
  async function fetchChannelInfo(ctx, roomId) {
    const anchorRes = await ctx.fetch(
      `https://cc.163.com/v1/activitylives/anchor/lives?anchor_ccid=${encodeURIComponent(roomId)}`,
      { headers: HEADERS, timeout: 25e3 }
    );
    if (!anchorRes.ok) throw new Error(`CC HTTP ${anchorRes.status}`);
    const anchorData = await anchorRes.json();
    const roomInfo = anchorData.data?.[roomId] || anchorData.data?.[String(roomId)];
    if (!roomInfo) throw new Error(`CC \u623F\u95F4 ${roomId} \u672A\u627E\u5230`);
    const channelId = roomInfo.channel_id;
    if (!channelId) throw new Error(`CC \u623F\u95F4 ${roomId} \u65E0 channel_id`);
    const chRes = await ctx.fetch(
      `https://cc.163.com/live/channel/?channelids=${channelId}`,
      { headers: HEADERS, timeout: 25e3 }
    );
    if (!chRes.ok) throw new Error(`CC HTTP ${chRes.status}`);
    const chData = await chRes.json();
    const channel = chData.data?.[0] || chData.data?.[channelId];
    if (!channel) throw new Error(`CC channel ${channelId} \u6570\u636E\u7F3A\u5931`);
    return channel;
  }
  async function getRoomDetail(ctx, { roomId }) {
    const ch = await fetchChannelInfo(ctx, roomId);
    return {
      platform: "cc",
      roomId,
      title: ch.title || ch.nickname || roomId,
      uname: ch.nickname || roomId,
      avatar: ch.purl,
      cover: ch.cover || ch.purl,
      online: ch.visitor ?? 0,
      category: ch.gamename || ch.game_name,
      live: ch.status === 1 || ch.status === "1",
      link: `https://cc.163.com/${roomId}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const ch = await fetchChannelInfo(ctx, roomId);
      return ch.status === 1 || ch.status === "1";
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const ch = await fetchChannelInfo(ctx, roomId);
    if (ch.status !== 1 && ch.status !== "1") throw new Error(`CC \u4E3B\u64AD ${roomId} \u672A\u5728\u76F4\u64AD`);
    const m3u8Base = ch.m3u8;
    if (!m3u8Base) throw new Error("CC \u672A\u8FD4\u56DE m3u8 \u5730\u5740");
    const quickplay = ch.quickplay || {};
    const streamList = ch.stream_list || quickplay;
    const qualityOrder = ["blueray", "original", "high", "medium"];
    const alternatives = [];
    for (const qName of qualityOrder) {
      const qData = streamList[qName] || quickplay[qName];
      if (!qData) continue;
      let tail = null;
      for (const cdn of CDN_PRIORITY) {
        if (qData[cdn]) {
          tail = qData[cdn];
          break;
        }
      }
      if (!tail) {
        const keys = Object.keys(qData).filter((k) => typeof qData[k] === "string" && qData[k].length > 0);
        if (keys.length > 0) tail = qData[keys[0]];
      }
      if (!tail) continue;
      const url = m3u8Base + (tail.startsWith("&") ? tail : "&" + tail);
      const labelMap = { blueray: "\u84DD\u5149", original: "\u539F\u753B", high: "\u9AD8\u6E05", medium: "\u6807\u6E05" };
      alternatives.push({
        qn: qName,
        label: labelMap[qName] || qName,
        url
      });
    }
    const bestUrl = alternatives.length > 0 ? alternatives[0].url : m3u8Base;
    const bestLabel = alternatives.length > 0 ? alternatives[0].label : "\u539F\u753B";
    const bestQn = alternatives.length > 0 ? alternatives[0].qn : "original";
    return ctx.protocols.hlsStream({
      url: bestUrl,
      qn: bestQn,
      qnLabel: bestLabel,
      alternatives: alternatives.length > 1 ? alternatives : void 0,
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(cc_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
