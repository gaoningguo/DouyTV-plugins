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
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var REFERER = "https://www.camsoda.com/";
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://www.camsoda.com", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "X-Requested-With": "XMLHttpRequest" };
  var manifest = {
    id: "camsoda",
    label: "CamSoda",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  async function resolve(ctx, { roomId }) {
    const res = await ctx.fetch(
      `https://www.camsoda.com/api/v1/video/vtoken/${encodeURIComponent(roomId)}?username=guest`,
      { headers: HEADERS, timeout: 2e4 }
    );
    if (!res.ok) throw new Error(`CamSoda HTTP ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error(`CamSoda \u4E3B\u64AD ${roomId} \u4E0D\u5728\u7EBF\u6216\u9700\u767B\u5F55`);
    const server = data.edge_servers?.[0] || data.stream_name;
    if (!server) throw new Error("CamSoda \u672A\u8FD4\u56DE edge server");
    const hlsUrl = `https://${server}/${data.stream_name}_v1/index.m3u8?token=${data.token}`;
    return ctx.protocols.hlsStream({ url: hlsUrl, referer: REFERER, ua: UA });
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const limit = Math.max(pageSize, 24);
    const offset = (page - 1) * limit;
    const res = await ctx.fetch(
      `https://www.camsoda.com/api/v1/browse/online?limit=${limit}&offset=${offset}`,
      { headers: HEADERS, timeout: 25e3 }
    );
    if (!res.ok) throw new Error(`CamSoda HTTP ${res.status}`);
    const data = await res.json();
    const users = data.results || [];
    const list = users.map((u) => ({
      platform: "camsoda",
      roomId: u.username || u.tpl_username || "",
      title: u.subject_html || u.display_name || u.username || "",
      uname: u.display_name || u.username,
      cover: u.thumb || u.thumb_hq,
      online: u.connection_count ?? 0,
      category: u.tags?.[0],
      live: u.status === "online",
      link: `https://www.camsoda.com/${u.username}`
    })).filter((r) => r.roomId);
    return { list, hasMore: users.length >= limit };
  }
  async function search(ctx, { keyword }) {
    const res = await ctx.fetch(
      `https://www.camsoda.com/api/v1/browse/online?limit=30&q=${encodeURIComponent(keyword)}`,
      { headers: HEADERS, timeout: 2e4 }
    );
    if (!res.ok) return { list: [], hasMore: false };
    const data = await res.json();
    const users = data.results || [];
    const list = users.map((u) => ({
      platform: "camsoda",
      roomId: u.username || "",
      title: u.subject_html || u.username || "",
      uname: u.display_name || u.username,
      cover: u.thumb,
      online: u.connection_count ?? 0,
      live: u.status === "online",
      link: `https://www.camsoda.com/${u.username}`
    })).filter((r) => r.roomId);
    return { list, hasMore: false };
  }
  return __toCommonJS(camsoda_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
