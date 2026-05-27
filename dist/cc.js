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
  var manifest = {
    id: "cc",
    label: "\u7F51\u6613CC\u76F4\u64AD",
    version: "1.0.0",
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
  var HEADERS_BASE = {
    "User-Agent": UA,
    Referer: "https://cc.163.com/"
  };
  async function fetchJson(ctx, url) {
    const res = await ctx.fetch(url, {
      method: "GET",
      headers: HEADERS_BASE,
      timeout: 2e4
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res.json();
  }
  function parseWatching(v) {
    if (v === void 0 || v === null) return void 0;
    if (typeof v === "number") return v;
    const n = parseInt(v, 10);
    return isNaN(n) ? void 0 : n;
  }
  function mapLive(item, watchKey) {
    if (item.cuteid === void 0 || item.cuteid === null) return void 0;
    const rid = String(item.cuteid);
    return {
      platform: "cc",
      roomId: rid,
      title: item.title ?? "",
      cover: item.cover,
      uname: item.nickname,
      avatar: item.purl,
      online: parseWatching(item[watchKey]),
      category: item.game_name ?? "",
      live: true,
      link: `https://cc.163.com/${rid}`
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const start = (page - 1) * 20;
    const data = await fetchJson(
      ctx,
      `https://cc.163.com/api/category/live/?format=json&start=${start}&size=20`
    );
    const items = data.lives ?? [];
    const list = items.map((i) => mapLive(i, "vision_visitor")).filter((r) => !!r);
    return { list, hasMore: items.length >= 20 };
  }
  var PARENT_CATS = [
    { id: "1", name: "\u5168\u90E8" },
    { id: "2", name: "\u7AEF\u6E38", tag: "pc_game" },
    { id: "4", name: "\u624B\u6E38", tag: "mobile_game" },
    { id: "5", name: "\u5176\u4ED6", tag: "other" }
  ];
  async function getCategories(ctx) {
    const data = await fetchJson(
      ctx,
      "https://cc.163.com/category/?format=json"
    );
    const all = data.game_list ?? [];
    const out = [];
    for (const parent of PARENT_CATS) {
      const filtered = parent.tag ? all.filter((g) => g.game_tag === parent.tag) : all;
      for (const g of filtered) {
        if (g.gametype === void 0 || g.gametype === null) continue;
        out.push({
          id: String(g.gametype),
          name: g.gamename ?? "",
          cover: g.img,
          parent: parent.name
        });
      }
    }
    return out;
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const data = await fetchJson(
      ctx,
      `https://cc.163.com/_next/data/nextjs/category/${encodeURIComponent(categoryId)}.json?game=${encodeURIComponent(categoryId)}`
    );
    const items = data.pageProps?.gametypeData?.lives ?? [];
    const list = items.map((i) => mapLive(i, "webcc_visitor")).filter((r) => !!r);
    return { list, hasMore: false };
  }
  async function search(ctx, { keyword, page }) {
    const data = await fetchJson(
      ctx,
      `https://cc.163.com/search/anchor?query=${encodeURIComponent(keyword)}&size=20&page=${page}`
    );
    const items = data.webcc_anchor?.result ?? [];
    const list = [];
    for (const item of items) {
      if (item.cuteid === void 0 || item.cuteid === null) continue;
      const rid = String(item.cuteid);
      list.push({
        platform: "cc",
        roomId: rid,
        title: item.title ?? "",
        cover: item.portrait,
        uname: item.nickname,
        avatar: item.portrait,
        online: parseWatching(item.follower_num),
        category: item.game_name ?? "",
        live: item.status === 1,
        link: `https://cc.163.com/${rid}`
      });
    }
    return { list, hasMore: items.length > 0 };
  }
  async function fetchChannelInfo(ctx, roomId) {
    const anchorResp = await fetchJson(
      ctx,
      `https://api.cc.163.com/v1/activitylives/anchor/lives?anchor_ccid=${encodeURIComponent(roomId)}`
    );
    const channelId = anchorResp.data?.[roomId]?.channel_id;
    if (channelId === void 0 || channelId === null) {
      throw new Error("CC \u672A\u8FD4\u56DE channel_id\uFF08\u623F\u95F4\u53EF\u80FD\u672A\u5F00\u64AD\uFF09");
    }
    const channelResp = await fetchJson(
      ctx,
      `https://cc.163.com/live/channel/?channelids=${encodeURIComponent(String(channelId))}`
    );
    return channelResp.data;
  }
  async function getRoomDetail(ctx, { roomId }) {
    const data = await fetchChannelInfo(ctx, roomId);
    const r = data?.[0];
    if (!r) throw new Error("CC \u672A\u8FD4\u56DE\u623F\u95F4\u6570\u636E");
    return {
      platform: "cc",
      roomId: String(r.ccid ?? roomId),
      title: r.title ?? "",
      cover: r.cover,
      uname: r.nickname,
      avatar: r.purl,
      online: parseWatching(r.follower_num),
      category: r.gamename,
      live: r.status === 1,
      link: `https://cc.163.com/${roomId}`
    };
  }
  var QUALITY_LABELS = {
    blueray: "\u539F\u753B",
    original: "\u539F\u753B",
    high: "\u9AD8\u6E05",
    medium: "\u6807\u51C6",
    standard: "\u6807\u51C6",
    low: "\u4F4E\u6E05",
    ultra: "\u84DD\u5149"
  };
  var LINE_PRIORITY = ["hs", "ks", "ali", "fws", "wy"];
  function pickCcStream(detail) {
    const dataSource = detail.quickplay ?? detail.stream_list;
    if (!dataSource) return { primary: "", alts: [] };
    const link = detail.m3u8;
    const dataObj = dataSource;
    const isLiveStream = dataObj.resolution === void 0 || dataObj.resolution === null;
    const qualityMap = isLiveStream ? dataObj : dataObj.resolution ?? {};
    const alts = [];
    for (const [key, q] of Object.entries(qualityMap)) {
      if (!q || typeof q !== "object") continue;
      const label = QUALITY_LABELS[key] ?? key;
      const vbr = q.vbr ?? 0;
      const lineMap = isLiveStream ? q.CDN_FMT ?? {} : q.cdn ?? {};
      let chosen;
      for (const line of LINE_PRIORITY) {
        const lineVal = lineMap[line];
        if (!lineVal) continue;
        if (isLiveStream) {
          if (!link) continue;
          chosen = `${link}&${lineVal}`;
        } else {
          chosen = lineVal;
        }
        break;
      }
      if (chosen) {
        alts.push({ qn: String(vbr), label, url: chosen });
      }
    }
    alts.sort((a, b) => parseInt(b.qn, 10) - parseInt(a.qn, 10));
    return { primary: alts[0]?.url ?? "", alts };
  }
  async function resolve(ctx, { roomId }) {
    const data = await fetchChannelInfo(ctx, roomId);
    const r = data?.[0];
    if (!r) throw new Error("CC \u672A\u8FD4\u56DE\u623F\u95F4\u6570\u636E");
    if (r.status !== 1) throw new Error("CC \u76F4\u64AD\u95F4\u672A\u5F00\u64AD");
    const picked = pickCcStream(r);
    if (!picked.primary) throw new Error("CC \u672A\u5339\u914D\u5230\u53EF\u64AD\u6D41");
    const isFlv = !picked.primary.includes(".m3u8");
    if (isFlv) {
      return ctx.protocols.flvStream({
        url: picked.primary,
        qn: picked.alts[0]?.qn,
        qnLabel: picked.alts[0]?.label,
        alternatives: picked.alts.length > 0 ? picked.alts : void 0,
        referer: "https://cc.163.com/",
        ua: UA
      });
    }
    return ctx.protocols.hlsStream({
      url: picked.primary,
      qn: picked.alts[0]?.qn,
      qnLabel: picked.alts[0]?.label,
      alternatives: picked.alts.length > 0 ? picked.alts : void 0,
      referer: "https://cc.163.com/",
      ua: UA
    });
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const detail = await getRoomDetail(ctx, { roomId });
      return detail.live;
    } catch {
      return false;
    }
  }
  return __toCommonJS(cc_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
