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

  // plugins/bongacams.js
  var bongacams_exports = {};
  __export(bongacams_exports, {
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var REFERER = "https://bongacams.com/";
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "application/json, text/plain, */*" };
  var manifest = {
    id: "bongacams",
    label: "BongaCams",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  async function resolve(ctx, { roomId }) {
    const res = await ctx.fetch(
      `https://tools.bongacams.com/promo.php?c=2001&type=api&api_v=1&model=${encodeURIComponent(roomId)}`,
      { headers: HEADERS, timeout: 2e4 }
    );
    if (!res.ok) throw new Error(`BongaCams HTTP ${res.status}`);
    const data = await res.json();
    const models = Array.isArray(data) ? data : [];
    const model = models.find((m) => m.username?.toLowerCase() === roomId.toLowerCase());
    if (!model) throw new Error(`BongaCams \u4E3B\u64AD ${roomId} \u4E0D\u5728\u7EBF`);
    const hlsUrl = model.direct_chat_url ? `https:${model.direct_chat_url}` : `https://edge-hls.bongacams.com/hls/stream_${roomId}/playlist.m3u8`;
    return ctx.protocols.hlsStream({ url: hlsUrl, referer: REFERER, ua: UA });
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const offset = (page - 1) * pageSize;
    const res = await ctx.fetch(
      `https://tools.bongacams.com/promo.php?c=2001&type=api&api_v=1&limit=${pageSize}&offset=${offset}`,
      { headers: HEADERS, timeout: 25e3 }
    );
    if (!res.ok) throw new Error(`BongaCams HTTP ${res.status}`);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`BongaCams \u8FD4\u56DE\u975E JSON: ${text.slice(0, 80)}`);
    }
    const models = Array.isArray(data) ? data : [];
    const list = models.map((m) => ({
      platform: "bongacams",
      roomId: m.username || "",
      title: m.topic || m.display_name || m.username || "",
      uname: m.display_name || m.username,
      cover: m.thumb_image ? `https:${m.thumb_image}` : void 0,
      online: m.members_count ?? 0,
      category: m.primary_tag,
      live: true,
      link: `https://bongacams.com/${m.username}`
    })).filter((r) => r.roomId);
    return { list, hasMore: models.length >= pageSize };
  }
  async function search(ctx, { keyword }) {
    const res = await ctx.fetch(
      `https://tools.bongacams.com/promo.php?c=2001&type=api&api_v=1&model=${encodeURIComponent(keyword)}&limit=30`,
      { headers: HEADERS, timeout: 2e4 }
    );
    if (!res.ok) return { list: [], hasMore: false };
    const data = await res.json();
    const models = Array.isArray(data) ? data : [];
    const list = models.map((m) => ({
      platform: "bongacams",
      roomId: m.username || "",
      title: m.topic || m.username || "",
      uname: m.display_name || m.username,
      cover: m.thumb_image ? `https:${m.thumb_image}` : void 0,
      online: m.members_count ?? 0,
      live: true,
      link: `https://bongacams.com/${m.username}`
    })).filter((r) => r.roomId);
    return { list, hasMore: false };
  }
  return __toCommonJS(bongacams_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
