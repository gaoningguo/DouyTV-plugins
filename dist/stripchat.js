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

  // plugins/stripchat.js
  var stripchat_exports = {};
  __export(stripchat_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://stripchat.com/";
  var API = "https://stripchat.com/api/front/v2/models";
  var HEADERS = { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Referer: REFERER };
  var THUMB = "https://img.doppiocdn.org/thumbs";
  var manifest = {
    id: "stripchat",
    label: "Stripchat",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function buildCover(streamName, ts) {
    if (!streamName) return void 0;
    return `${THUMB}/${ts ?? Math.floor(Date.now() / 1e3)}/${streamName}`;
  }
  function mapModel(m) {
    if (!m.username) return void 0;
    const st = (m.status ?? "").toLowerCase();
    if (st === "off" || st === "offline" || st === "private") return void 0;
    const tags = m.tags ?? [];
    return {
      platform: "stripchat",
      roomId: m.username,
      title: m.topic || m.modelDetails?.fullName || m.username,
      uname: m.modelDetails?.fullName || m.username,
      cover: buildCover(m.streamName, m.snapshotTimestamp),
      online: m.viewersCount ?? 0,
      category: tags[0]?.name ?? tags[0]?.slug ?? m.broadcastGender ?? m.primaryTag,
      live: m.isLive ?? true,
      link: `https://stripchat.com/${m.username}`
    };
  }
  function flatten(data) {
    if (Array.isArray(data.models) && data.models.length > 0) return data.models;
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const block of data.blocks ?? []) {
      for (const m of block.models ?? []) {
        if (!m.username || seen.has(m.username)) continue;
        seen.add(m.username);
        out.push(m);
      }
    }
    return out;
  }
  async function fetchList(ctx, params) {
    const url = new URL(API);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await ctx.fetch(url.toString(), { method: "GET", headers: HEADERS, timeout: 25e3, http2: true });
    if (!res.ok) throw new Error(`Stripchat HTTP ${res.status}`);
    return res.json();
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const limit = Math.max(pageSize, 30);
    const data = await fetchList(ctx, { primaryTag: "girls", limit, offset: (page - 1) * limit });
    const models = flatten(data);
    return { list: models.map(mapModel).filter(Boolean), hasMore: models.length >= limit };
  }
  async function getCategories(ctx) {
    return [
      { id: "primaryTag=girls", name: "Girls" },
      { id: "primaryTag=men", name: "Men" },
      { id: "primaryTag=couples", name: "Couples" },
      { id: "primaryTag=trans", name: "Trans" },
      { id: "primaryTag=girls&tagSlugs=asian", name: "Asian" },
      { id: "primaryTag=girls&tagSlugs=latina", name: "Latina" },
      { id: "primaryTag=girls&tagSlugs=ebony", name: "Ebony" },
      { id: "primaryTag=girls&tagSlugs=teen-18", name: "Teen 18+" },
      { id: "primaryTag=girls&tagSlugs=milf", name: "MILF" },
      { id: "primaryTag=girls&tagSlugs=mature", name: "Mature" },
      { id: "primaryTag=girls&tagSlugs=big-tits", name: "Big Tits" },
      { id: "primaryTag=girls&tagSlugs=squirt", name: "Squirt" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const params = { limit: 30, offset: (page - 1) * 30 };
    for (const part of categoryId.split("&")) {
      const eq = part.indexOf("=");
      if (eq > 0) params[part.slice(0, eq)] = part.slice(eq + 1);
    }
    if (!params.primaryTag) params.primaryTag = "girls";
    const data = await fetchList(ctx, params);
    const models = flatten(data);
    return { list: models.map(mapModel).filter(Boolean), hasMore: models.length >= 30 };
  }
  async function search(ctx, { keyword }) {
    const data = await fetchList(ctx, { primaryTag: "girls", searchPhrase: keyword, limit: 30 });
    const models = flatten(data);
    return { list: models.map(mapModel).filter(Boolean), hasMore: false };
  }
  async function getRoomDetail(ctx, { roomId }) {
    const url = `https://stripchat.com/api/front/v2/models/username/${encodeURIComponent(roomId)}/cam`;
    const res = await ctx.fetch(url, { headers: HEADERS, timeout: 25e3, http2: true });
    if (!res.ok) throw new Error(`Stripchat HTTP ${res.status}`);
    const body = await res.json();
    if (!body.model) throw new Error(`Stripchat ${roomId} \u672A\u627E\u5230`);
    return mapModel(body.model) || { platform: "stripchat", roomId, title: roomId, live: false, link: `https://stripchat.com/${roomId}` };
  }
  async function resolve(ctx, { roomId }) {
    const camUrl = `https://stripchat.com/api/front/v2/models/username/${encodeURIComponent(roomId)}/cam`;
    let streamName;
    try {
      const res = await ctx.fetch(camUrl, { headers: HEADERS, timeout: 2e4, http2: true });
      if (res.ok) {
        const body = await res.json();
        streamName = body.cam?.userStreamName || body.cam?.streamName;
      }
    } catch {
    }
    if (!streamName) {
      const pageRes = await ctx.fetch(`https://stripchat.com/${roomId}`, {
        headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
        timeout: 25e3,
        http2: true
      });
      if (!pageRes.ok) throw new Error(`Stripchat HTTP ${pageRes.status}`);
      const html = await pageRes.text();
      const m = html.match(/"streamName"\s*:\s*"([^"]+)"/);
      if (!m) throw new Error("Stripchat \u672A\u63D0\u53D6\u5230 streamName");
      streamName = m[1];
    }
    const hls = `https://edge-hls.doppiocdn.com/hls/${streamName}/master/${streamName}_auto.m3u8`;
    return ctx.protocols.hlsStream({
      url: hls,
      qnLabel: "\u81EA\u9002\u5E94 (\u9700\u5728\u8BBE\u7F6E\u4E2D\u914D Mouflon \u89E3\u6270\u5BC6\u94A5)",
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(stripchat_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
