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

  // plugins/camsoda.js
  var camsoda_exports = {};
  __export(camsoda_exports, {
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
    id: "camsoda",
    label: "CamSoda",
    version: "1.0.0",
    adult: true,
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.camsoda.com/";
  var COMMON_HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Origin: REFERER.replace(/\/$/, ""),
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9"
  };
  var TPL = {
    USER_ID: "0",
    USERNAME: "1",
    DISPLAY_NAME: "2",
    STATUS: "3",
    CONNECTIONS: "4",
    SUBJECT_HTML: "6",
    STREAM_NAME: "7",
    GENDER: "8",
    THUMB: "10",
    BITRATE: "12",
    STANDBY: "14"
  };
  function tplStr(tpl, idx) {
    const v = tpl?.[idx];
    return typeof v === "string" ? v : void 0;
  }
  function tplNum(tpl, idx) {
    const v = tpl?.[idx];
    return typeof v === "number" ? v : void 0;
  }
  function mapRoom(raw) {
    const tpl = raw.tpl;
    if (!tpl) return void 0;
    const username = tplStr(tpl, TPL.USERNAME);
    if (!username) return void 0;
    const standby = tplNum(tpl, TPL.STANDBY);
    if (standby === 1) return void 0;
    const displayName = tplStr(tpl, TPL.DISPLAY_NAME);
    const topic = tplStr(tpl, TPL.SUBJECT_HTML);
    const cover = tplStr(tpl, TPL.THUMB);
    const viewers = tplNum(tpl, TPL.CONNECTIONS) ?? 0;
    const gender = tplStr(tpl, TPL.GENDER);
    return {
      platform: "camsoda",
      roomId: username,
      title: topic || displayName || username,
      uname: displayName || username,
      cover,
      online: viewers,
      category: gender,
      live: true,
      link: "https://www.camsoda.com/" + username
    };
  }
  async function fetchBrowse(ctx, params) {
    const url = new URL("https://www.camsoda.com/api/v1/browse/online");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    const res = await ctx.fetch(url.toString(), {
      method: "GET",
      headers: COMMON_HEADERS,
      timeout: 3e4,
      http2: true
    });
    if (!res.ok) throw new Error("CamSoda HTTP " + res.status);
    const data = await res.json();
    return data.results ?? [];
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const arr = await fetchBrowse(ctx, { page, gender: "f", showType: "all" });
    const list = arr.map(mapRoom).filter((v) => !!v);
    return { list, hasMore: arr.length > 0 };
  }
  var PRESET_CATEGORIES = [
    { id: "gender=f", name: "Female" },
    { id: "gender=m", name: "Male" },
    { id: "gender=t", name: "Trans" },
    { id: "gender=c", name: "Couple" }
  ];
  async function getCategories(ctx) {
    return PRESET_CATEGORIES;
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const [k, v] = categoryId.split("=");
    if (!k || !v) return { list: [], hasMore: false };
    const arr = await fetchBrowse(ctx, { [k]: v, page, showType: "all" });
    const list = arr.map(mapRoom).filter((r) => !!r);
    return { list, hasMore: arr.length > 0 };
  }
  async function search(ctx, { keyword, page }) {
    const arr = await fetchBrowse(ctx, { find: keyword, page: 1, showType: "all" });
    const list = arr.map(mapRoom).filter((r) => !!r);
    return { list, hasMore: false };
  }
  async function fetchVtoken(ctx, roomId) {
    const url = "https://www.camsoda.com/api/v1/video/vtoken/" + encodeURIComponent(roomId) + "?username=guest_";
    const res = await ctx.fetch(url, {
      method: "GET",
      headers: { ...COMMON_HEADERS, Referer: "https://www.camsoda.com/" + roomId },
      timeout: 3e4,
      http2: true
    });
    if (!res.ok) throw new Error("CamSoda vtoken HTTP " + res.status);
    return res.json();
  }
  async function getRoomDetail(ctx, { roomId }) {
    try {
      const v = await fetchVtoken(ctx, roomId);
      return {
        platform: "camsoda",
        roomId,
        title: roomId,
        uname: roomId,
        live: v.status === "online",
        link: "https://www.camsoda.com/" + roomId
      };
    } catch {
      return {
        platform: "camsoda",
        roomId,
        title: roomId,
        uname: roomId,
        live: false,
        link: "https://www.camsoda.com/" + roomId
      };
    }
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const v = await fetchVtoken(ctx, roomId);
      return v.status === "online";
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const v = await fetchVtoken(ctx, roomId);
    if (v.status && v.status !== "online") {
      throw new Error("CamSoda \u623F\u95F4 " + roomId + " \u72B6\u6001 " + v.status + "\uFF08\u672A\u516C\u5F00\u64AD\u653E\uFF09");
    }
    if (!v.stream_name) {
      throw new Error("CamSoda vtoken \u672A\u8FD4\u56DE stream_name\uFF08\u623F\u95F4\u53EF\u80FD\u672A\u5F00\u64AD\uFF09");
    }
    const edges = v.edge_servers ?? [];
    if (edges.length === 0) {
      throw new Error("CamSoda vtoken \u672A\u8FD4\u56DE edge_servers");
    }
    const urlFor = (edge) => "https://" + edge + "/" + v.stream_name + "_v1/index.m3u8";
    const primary = urlFor(edges[0]);
    const alternatives = edges.slice(1).map((edge, i) => ({
      qn: "edge" + (i + 2),
      label: "\u5907\u7528\u7EBF\u8DEF " + (i + 2),
      url: urlFor(edge)
    }));
    return ctx.protocols.hlsStream({
      url: primary,
      qn: "auto",
      qnLabel: "\u81EA\u9002\u5E94 (" + (v.width ?? "?") + "x" + (v.height ?? "?") + ")",
      alternatives: alternatives.length > 0 ? alternatives : void 0,
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(camsoda_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
