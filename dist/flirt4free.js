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

  // plugins/flirt4free.js
  var flirt4free_exports = {};
  __export(flirt4free_exports, {
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var manifest = {
    id: "flirt4free",
    label: "Flirt4Free",
    version: "1.0.0",
    adult: true,
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.flirt4free.com/";
  var COMMON_HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  };
  var modelIdCache = /* @__PURE__ */ new Map();
  function parseModels(html) {
    const needle = "window.__homePageData__ = ";
    const start = html.indexOf(needle);
    if (start === -1) return [];
    const after = html.slice(start + needle.length);
    const arrStart = after.indexOf("[");
    if (arrStart === -1) return [];
    const arrEnd = after.indexOf("],\n", arrStart);
    if (arrEnd === -1) return [];
    const slice = after.slice(arrStart, arrEnd + 1).replace(/,\s*]\s*$/, "]");
    try {
      return JSON.parse(slice);
    } catch (e) {
      return [];
    }
  }
  function thumb(m) {
    if (!m.sample_long_id) return void 0;
    return "https://cdn5.vscdns.com/images/models/webp/s/640x480/imgid/" + m.sample_long_id + ".webp";
  }
  function mapRoom(m) {
    const slug = m.model_seo_name;
    if (!slug) return void 0;
    if (m.model_id) modelIdCache.set(slug, m.model_id);
    return {
      platform: "flirt4free",
      roomId: slug,
      title: m.display || m.model_name || slug,
      uname: m.display || m.model_name || slug,
      cover: thumb(m),
      online: 0,
      category: m.category_name,
      live: m.room_status_char === "O",
      link: "https://www.flirt4free.com/?model=" + encodeURIComponent(slug)
    };
  }
  async function fetchHomepage(ctx) {
    const res = await ctx.fetch("https://www.flirt4free.com/", {
      method: "GET",
      headers: COMMON_HEADERS,
      timeout: 3e4,
      http2: true
    });
    if (!res.ok) throw new Error("Flirt4Free HTTP " + res.status);
    const html = await res.text();
    return parseModels(html);
  }
  var homepageCache = null;
  var HOMEPAGE_CACHE_TTL = 6e4;
  async function fetchHomepageCached(ctx) {
    const now = Date.now();
    if (homepageCache && now - homepageCache.ts < HOMEPAGE_CACHE_TTL) {
      return homepageCache.models;
    }
    const arr = await fetchHomepage(ctx);
    homepageCache = { models: arr, ts: now };
    return arr;
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const arr = await fetchHomepageCached(ctx);
    const mapped = arr.map(mapRoom).filter((r) => !!r);
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize;
    return {
      list: mapped.slice(from, to),
      hasMore: to < mapped.length
    };
  }
  async function search(ctx, { keyword, page }) {
    const pageSize = 30;
    const arr = await fetchHomepageCached(ctx);
    const kw = keyword.toLowerCase();
    const matched = arr.filter(
      (m) => (m.model_seo_name ?? "").toLowerCase().includes(kw) || (m.display ?? "").toLowerCase().includes(kw) || (m.model_name ?? "").toLowerCase().includes(kw) || (m.category_name ?? "").toLowerCase().includes(kw)
    ).map(mapRoom).filter((r) => !!r);
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize;
    return {
      list: matched.slice(from, to),
      hasMore: to < matched.length
    };
  }
  async function resolveModelId(ctx, slug) {
    const cached = modelIdCache.get(slug);
    if (cached) return cached;
    try {
      const res = await ctx.fetch(
        "https://ws.vs3.com/rooms/check-model-status.php?model_name=" + encodeURIComponent(slug),
        {
          method: "GET",
          headers: {
            ...COMMON_HEADERS,
            Accept: "application/json, text/plain, */*"
          },
          timeout: 1e4,
          http2: true
        }
      );
      if (res.ok) {
        const j = await res.json();
        if (j.model_id) {
          const id = String(j.model_id);
          modelIdCache.set(slug, id);
          return id;
        }
      }
    } catch (e) {
    }
    const arr = await fetchHomepageCached(ctx);
    for (const m of arr) {
      if (m.model_seo_name === slug && m.model_id) {
        modelIdCache.set(slug, m.model_id);
        return m.model_id;
      }
    }
    return null;
  }
  async function resolve(ctx, { roomId }) {
    const modelId = await resolveModelId(ctx, roomId);
    if (!modelId) throw new Error("Flirt4Free \u672A\u627E\u5230\u4E3B\u64AD " + roomId);
    const res = await ctx.fetch(
      "https://www.flirt4free.com/ws/chat/get-stream-urls.php?model_id=" + modelId,
      {
        method: "GET",
        headers: {
          ...COMMON_HEADERS,
          Accept: "application/json, text/plain, */*",
          Referer: "https://www.flirt4free.com/?model=" + encodeURIComponent(roomId)
        },
        timeout: 25e3,
        http2: true
      }
    );
    if (!res.ok) throw new Error("Flirt4Free stream HTTP " + res.status);
    const data = await res.json();
    if (data.code === 44) throw new Error("Flirt4Free \u4E3B\u64AD " + roomId + " \u4E0D\u5B58\u5728");
    if (data.code !== 0) throw new Error("Flirt4Free \u62C9\u6D41\u5931\u8D25 code=" + data.code);
    const hls = data.data?.hls?.[0]?.url;
    if (!hls) throw new Error("Flirt4Free \u65E0 HLS \u6D41");
    const fullUrl = hls.startsWith("//") ? "https:" + hls : hls;
    return ctx.protocols.hlsStream({
      url: fullUrl,
      qn: "auto",
      qnLabel: "\u81EA\u9002\u5E94",
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(flirt4free_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
