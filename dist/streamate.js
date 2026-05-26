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

  // plugins/streamate.js
  var streamate_exports = {};
  __export(streamate_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://streamate.com/";
  var SEARCH_API = "https://member.naiadsystems.com/search/v3/performers";
  var MANIFEST_API = "https://manifest-server.naiadsystems.com/live";
  var DUMMY_ID = "ffffffff-ffff-ffff-ffff-ffffffffffffG0000000000000";
  var HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Accept: "application/json, text/plain, */*",
    platform: "SCP",
    smtid: DUMMY_ID,
    smeid: DUMMY_ID,
    smvid: DUMMY_ID
  };
  var manifest = {
    id: "streamate",
    label: "Streamate",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  var CATEGORIES = [
    { id: "anal", name: "Anal" },
    { id: "bigboobs", name: "Big Boobs" },
    { id: "bigbutt", name: "Big Butt" },
    { id: "milf", name: "MILF" },
    { id: "teen", name: "Teen" },
    { id: "asian", name: "Asian" },
    { id: "ebony", name: "Ebony" },
    { id: "latina", name: "Latina" },
    { id: "blonde", name: "Blonde" },
    { id: "brunette", name: "Brunette" },
    { id: "redhead", name: "Redhead" },
    { id: "lesbian", name: "Lesbian" },
    { id: "couples", name: "Couples" },
    { id: "feet", name: "Feet" },
    { id: "smoking", name: "Smoking" }
  ];
  var listCache = [];
  function mapPerformer(p) {
    if (!p.nickname) return void 0;
    return {
      platform: "streamate",
      roomId: p.nickname,
      title: p.nickname + (p.age ? ` (${p.age})` : ""),
      uname: p.nickname,
      cover: p.thumbnail || void 0,
      online: 0,
      category: (p.categoryName || []).join(", ") || void 0,
      live: p.online ?? true,
      link: `https://streamate.com/cam/${p.nickname}`,
      _hd: p.highDefinition,
      _country: p.country
    };
  }
  async function fetchPerformers(ctx, { from = 0, size = 48, category } = {}) {
    let filters = "gender:f,ff,mf,tm2f,g;online:true";
    if (category) filters += `;category:${category}`;
    const params = new URLSearchParams({
      domain: "streamate.com",
      from: String(from),
      size: String(size),
      filters,
      genderSetting: "f"
    });
    const res = await ctx.fetch(`${SEARCH_API}?${params.toString()}`, {
      headers: HEADERS,
      timeout: 25e3
    });
    if (!res.ok) throw new Error(`Streamate HTTP ${res.status}`);
    const data = await res.json();
    return {
      performers: data.performers || [],
      total: data.totalResultCount || 0
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const size = Math.max(pageSize, 48);
    const from = (page - 1) * size;
    const { performers, total } = await fetchPerformers(ctx, { from, size });
    listCache = performers;
    const list = performers.map(mapPerformer).filter(Boolean);
    return { list, hasMore: from + size < total };
  }
  async function search(ctx, { keyword }) {
    const kw = keyword.toLowerCase();
    let performers = listCache;
    if (!performers.length) {
      const result = await fetchPerformers(ctx, { from: 0, size: 200 });
      performers = result.performers;
      listCache = performers;
    }
    const filtered = performers.filter(
      (p) => (p.nickname || "").toLowerCase().includes(kw)
    );
    const list = filtered.map(mapPerformer).filter(Boolean);
    return { list, hasMore: false };
  }
  async function getCategories(ctx) {
    return CATEGORIES;
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const size = 48;
    const from = (page - 1) * size;
    const { performers, total } = await fetchPerformers(ctx, { from, size, category: categoryId });
    const list = performers.map(mapPerformer).filter(Boolean);
    return { list, hasMore: from + size < total };
  }
  async function resolve(ctx, { roomId }) {
    const url = `${MANIFEST_API}/s:${encodeURIComponent(roomId)}.json?last=load&format=mp4-hls`;
    const res = await ctx.fetch(url, {
      headers: { "User-Agent": UA, Referer: REFERER },
      timeout: 2e4
    });
    if (!res.ok) throw new Error(`Streamate manifest HTTP ${res.status}`);
    const data = await res.json();
    const mp4hls = data.formats?.["mp4-hls"];
    if (!mp4hls || !mp4hls.encodings || mp4hls.encodings.length === 0) {
      throw new Error(`Streamate: ${roomId} \u65E0\u53EF\u7528 HLS \u6D41`);
    }
    const sorted = [...mp4hls.encodings].sort(
      (a, b) => (b.videoWidth || 0) - (a.videoWidth || 0)
    );
    const best = sorted[0];
    if (!best.location) throw new Error(`Streamate: ${roomId} HLS location \u4E3A\u7A7A`);
    const alternatives = sorted.filter((e) => e.location).map((e, i) => ({
      qn: `enc_${i}`,
      label: e.videoWidth && e.videoHeight ? `${e.videoWidth}x${e.videoHeight}` : `Stream ${i + 1}`,
      url: e.location
    }));
    return ctx.protocols.hlsStream({
      url: best.location,
      qnLabel: alternatives[0]?.label || "Auto",
      alternatives: alternatives.length > 1 ? alternatives : void 0,
      referer: REFERER,
      ua: UA
    });
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const url = `${MANIFEST_API}/s:${encodeURIComponent(roomId)}.json?last=load&format=mp4-hls`;
      const res = await ctx.fetch(url, {
        headers: { "User-Agent": UA, Referer: REFERER },
        timeout: 15e3
      });
      if (!res.ok) return false;
      const data = await res.json();
      const encodings = data.formats?.["mp4-hls"]?.encodings;
      return Array.isArray(encodings) && encodings.length > 0;
    } catch {
      return false;
    }
  }
  return __toCommonJS(streamate_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
