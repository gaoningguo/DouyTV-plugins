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

  // plugins/camscom.js
  var camscom_exports = {};
  __export(camscom_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://cams.com/";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://cams.com", Accept: "application/json, text/plain, */*" };
  var COMPRESSED_URL = "https://beta-api.cams.com/won/compressed/";
  var cache = null;
  var TTL = 3 * 60 * 1e3;
  var manifest = {
    id: "camscom",
    label: "Cams.com",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function buildIdx(mapping) {
    const idx = {};
    for (let i = 0; i < mapping.length; i++) idx[mapping[i]] = i;
    return idx;
  }
  function rowToModel(row, idx) {
    const get = (k) => idx[k] !== void 0 ? row[idx[k]] : void 0;
    const screen = String(get("screen_name") ?? "").trim();
    const stream = String(get("stream_name") ?? screen).trim();
    const gender = String(get("gender") ?? "").trim();
    const chat = String(get("chat_type") ?? "").trim();
    if (!screen || !gender || !chat) return void 0;
    return { screen_name: screen, stream_name: stream, gender, chat_type: chat };
  }
  async function fetchAll(ctx) {
    if (cache && Date.now() - cache.at < TTL) return cache.models;
    const res = await ctx.fetch(COMPRESSED_URL, { headers: HEADERS, timeout: 3e4, http2: true });
    if (!res.ok) throw new Error(`Cams.com HTTP ${res.status}`);
    const data = await res.json();
    const mapping = data.mapping ?? [];
    const rows = data.models ?? [];
    if (mapping.length === 0) throw new Error("Cams.com \u7F3A mapping");
    const idx = buildIdx(mapping);
    const out = [];
    for (let i = 0; i < rows.length; i += 100) {
      for (const r of rows.slice(i, i + 100)) {
        const m = rowToModel(r, idx);
        if (m) out.push(m);
      }
      if (i + 100 < rows.length) await new Promise((r) => setTimeout(r, 0));
    }
    cache = { at: Date.now(), models: out };
    return out;
  }
  function isPublic(t) {
    return t === "1";
  }
  function genderLabel(g) {
    switch (g.toUpperCase()) {
      case "F":
        return "female";
      case "M":
        return "male";
      case "T":
        return "trans";
      case "C":
        return "couple";
      default:
        return g;
    }
  }
  function buildCover(name) {
    const lower = name.toLowerCase();
    const raw = `https://images4.streamray.com/images/streamray/streams/${lower}_640.gif`;
    return `https://dynimages.securedataimages.com/unsigned/rs:fill:360::0/g:no/plain/${encodeURIComponent(raw)}@webp`;
  }
  function toRoom(m) {
    return {
      platform: "camscom",
      roomId: m.screen_name,
      title: m.screen_name,
      uname: m.screen_name,
      cover: buildCover(m.stream_name || m.screen_name),
      online: 0,
      category: genderLabel(m.gender),
      live: isPublic(m.chat_type),
      link: `https://cams.com/${encodeURIComponent(m.screen_name)}`
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const all = await fetchAll(ctx);
    const sorted = [...all].sort((a, b) => {
      const pa = isPublic(a.chat_type) ? 0 : 1;
      const pb = isPublic(b.chat_type) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.screen_name.localeCompare(b.screen_name);
    });
    const start = (page - 1) * pageSize;
    return { list: sorted.slice(start, start + pageSize).map(toRoom), hasMore: start + pageSize < sorted.length };
  }
  async function getCategories(ctx) {
    return [
      { id: "F", name: "\u5973\u6027" },
      { id: "M", name: "\u7537\u6027" },
      { id: "C", name: "\u60C5\u4FA3" },
      { id: "T", name: "TS" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const all = await fetchAll(ctx);
    const filtered = all.filter((m) => m.gender.toUpperCase() === categoryId.toUpperCase()).sort((a, b) => {
      const pa = isPublic(a.chat_type) ? 0 : 1;
      const pb = isPublic(b.chat_type) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.screen_name.localeCompare(b.screen_name);
    });
    const ps = 30;
    const start = (page - 1) * ps;
    return { list: filtered.slice(start, start + ps).map(toRoom), hasMore: start + ps < filtered.length };
  }
  async function search(ctx, { keyword, page }) {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return { list: [], hasMore: false };
    const all = await fetchAll(ctx);
    const matched = all.filter((m) => m.screen_name.toLowerCase().includes(kw));
    const ps = 30;
    const start = (page - 1) * ps;
    return { list: matched.slice(start, start + ps).map(toRoom), hasMore: start + ps < matched.length };
  }
  async function resolve(ctx, { roomId }) {
    if (cache) {
      const hit = cache.models.find((m) => m.screen_name.toLowerCase() === roomId.toLowerCase());
      if (hit) {
        if (!isPublic(hit.chat_type)) throw new Error(`Cams.com ${roomId} chat_type=${hit.chat_type} (\u533F\u540D\u65E0\u753B\u9762)`);
        return ctx.protocols.hlsStream({
          url: `https://camshls.cams.com/cdn-${(hit.stream_name || hit.screen_name).toLowerCase()}.m3u8`,
          referer: REFERER,
          ua: UA
        });
      }
    }
    const res = await ctx.fetch(`https://beta-api.cams.com/models/stream/${encodeURIComponent(roomId)}/`, { headers: HEADERS, timeout: 2e4, http2: true });
    if (!res.ok) throw new Error(`Cams.com ${roomId} \u4E0D\u5B58\u5728`);
    const data = await res.json();
    if (data.online !== "1") throw new Error(`Cams.com ${roomId} \u72B6\u6001 ${data.online}`);
    return ctx.protocols.hlsStream({
      url: `https://camshls.cams.com/cdn-${(data.stream_name || roomId).toLowerCase()}.m3u8`,
      referer: REFERER,
      ua: UA
    });
  }
  async function getLiveStatus(ctx, { roomId }) {
    if (cache) {
      const hit = cache.models.find((m) => m.screen_name.toLowerCase() === roomId.toLowerCase());
      if (hit) return isPublic(hit.chat_type);
    }
    try {
      const res = await ctx.fetch(`https://beta-api.cams.com/models/stream/${encodeURIComponent(roomId)}/`, { headers: HEADERS, timeout: 2e4, http2: true });
      if (!res.ok) return false;
      const data = await res.json();
      return data.online === "1";
    } catch {
      return false;
    }
  }
  return __toCommonJS(camscom_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
