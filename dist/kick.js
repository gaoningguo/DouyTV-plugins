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

  // plugins/kick.js
  var kick_exports = {};
  __export(kick_exports, {
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
    id: "kick",
    label: "Kick",
    version: "1.0.0",
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://kick.com/";
  var COMMON_HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Origin: "https://kick.com",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Sec-Ch-Ua": '"Chromium";v="130", "Not(A:Brand";v="99", "Google Chrome";v="130"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"'
  };
  function pickThumb(t) {
    if (!t) return void 0;
    if (typeof t === "string") return t;
    return t.src ?? t.url ?? void 0;
  }
  function mapStreamToRoom(s) {
    const slug = s.channel?.slug ?? s.slug;
    if (!slug) return void 0;
    return {
      platform: "kick",
      roomId: slug,
      title: s.session_title ?? slug,
      uname: s.channel?.user?.username ?? slug,
      avatar: s.channel?.user?.profile_pic,
      cover: pickThumb(s.thumbnail),
      online: s.viewer_count ?? 0,
      category: s.categories?.[0]?.name,
      live: !!s.is_live,
      link: `https://kick.com/${slug}`
    };
  }
  async function getJson(ctx, url) {
    const res = await ctx.fetch(url, {
      method: "GET",
      headers: COMMON_HEADERS,
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error(`Kick HTTP ${res.status}`);
    return res.json();
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const candidates = [
      `https://kick.com/api/v2/featured-livestreams/en?page=${page}`,
      `https://kick.com/featured-livestreams/en?page=${page}`,
      `https://kick.com/stream/livestreams/en?page=${page}&limit=24`
    ];
    for (const url of candidates) {
      try {
        const data = await getJson(ctx, url);
        const arr = Array.isArray(data) ? data : data?.data ?? [];
        if (arr.length > 0) {
          const list = arr.map(mapStreamToRoom).filter((r) => !!r);
          return { list, hasMore: arr.length >= 20 };
        }
      } catch {
      }
    }
    return { list: [], hasMore: false };
  }
  async function getCategories(ctx) {
    try {
      const data = await getJson(ctx, "https://kick.com/api/v1/categories");
      const arr = Array.isArray(data) ? data : data?.data ?? [];
      return arr.slice(0, 40).map((c) => ({
        id: c.slug,
        name: c.name,
        cover: c.banner?.url ?? void 0
      }));
    } catch {
      return [];
    }
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const candidates = [
      `https://kick.com/api/v2/categories/${encodeURIComponent(categoryId)}/livestreams?page=${page}`,
      `https://kick.com/api/v2/categories/${encodeURIComponent(categoryId)}/streams?page=${page}`,
      `https://kick.com/api/v1/categories/${encodeURIComponent(categoryId)}/livestreams?page=${page}`,
      `https://kick.com/stream/livestreams/en?category=${encodeURIComponent(categoryId)}&page=${page}&limit=24`
    ];
    for (const url of candidates) {
      try {
        const data = await getJson(ctx, url);
        const arr = Array.isArray(data) ? data : data?.data ?? [];
        if (arr.length > 0) {
          const list = arr.map(mapStreamToRoom).filter((r) => !!r);
          return { list, hasMore: arr.length >= 20 };
        }
      } catch {
      }
    }
    return { list: [], hasMore: false };
  }
  async function search(ctx, { keyword, page }) {
    const url = `https://kick.com/api/v2/channels/search?searched_word=${encodeURIComponent(keyword)}`;
    const data = await getJson(ctx, url);
    const arr = Array.isArray(data) ? data : data?.data ?? [];
    const list = arr.map((c) => ({
      platform: "kick",
      roomId: c.slug,
      title: c.livestream?.session_title ?? c.user?.username ?? c.slug,
      uname: c.user?.username ?? c.slug,
      avatar: c.user?.profile_pic,
      cover: pickThumb(c.livestream?.thumbnail),
      online: c.livestream?.viewer_count ?? 0,
      live: !!c.is_live || !!c.livestream,
      link: `https://kick.com/${c.slug}`
    }));
    return { list, hasMore: false };
  }
  async function fetchChannel(ctx, slug) {
    return getJson(
      ctx,
      `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`
    );
  }
  async function getRoomDetail(ctx, { roomId }) {
    const ch = await fetchChannel(ctx, roomId);
    const ls = ch.livestream;
    return {
      platform: "kick",
      roomId: ch.slug ?? roomId,
      title: ls?.session_title ?? ch.user?.username ?? ch.slug ?? roomId,
      uname: ch.user?.username ?? ch.slug,
      avatar: ch.user?.profile_pic,
      cover: pickThumb(ls?.thumbnail),
      online: ls?.viewer_count ?? 0,
      category: ls?.categories?.[0]?.name ?? ch.recent_categories?.[0]?.name,
      live: !!ls?.is_live,
      link: `https://kick.com/${ch.slug ?? roomId}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const ch = await fetchChannel(ctx, roomId);
      return !!ch.livestream?.is_live;
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const ch = await fetchChannel(ctx, roomId);
    const url = ch.playback_url ?? ch.livestream?.playback_url;
    if (!url) throw new Error("Kick \u672A\u8FD4\u56DE playback_url\uFF08\u623F\u95F4\u672A\u5F00\u64AD\uFF09");
    const alternatives = await fetchMasterAlternatives(ctx, url).catch(() => []);
    const top = alternatives[0];
    const defaultUrl = top?.url ?? url;
    const alts = alternatives.length > 1 ? [
      { qn: "auto", label: "\u81EA\u9002\u5E94", url },
      ...alternatives
    ] : void 0;
    return ctx.protocols.hlsStream({
      url: defaultUrl,
      qn: top?.qn ?? "auto",
      qnLabel: top?.label ?? "\u81EA\u9002\u5E94",
      alternatives: alts,
      referer: REFERER,
      ua: UA
    });
  }
  async function fetchMasterAlternatives(ctx, masterUrl) {
    const res = await ctx.fetch(masterUrl, {
      method: "GET",
      headers: { "User-Agent": UA, Referer: REFERER },
      timeout: 15e3,
      http2: true
    });
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.split("\n");
    const variants = [];
    let pendingInf = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith("#EXT-X-STREAM-INF:")) {
        pendingInf = line;
        continue;
      }
      if (pendingInf && line && !line.startsWith("#")) {
        const bwM = pendingInf.match(/BANDWIDTH=([0-9]+)/);
        const resM = pendingInf.match(/RESOLUTION=([0-9x]+)/);
        const frM = pendingInf.match(/FRAME-RATE=([0-9.]+)/);
        const bw = bwM ? parseInt(bwM[1], 10) : 0;
        const resolution = resM ? resM[1] : "?";
        const fr = frM ? Math.round(parseFloat(frM[1])) : 0;
        const heightM = resolution.match(/x([0-9]+)/);
        const heightLabel = heightM ? `${heightM[1]}p${fr > 30 ? fr : ""}` : resolution;
        const absUrl = line.startsWith("http") ? line : new URL(line, masterUrl).toString();
        variants.push({
          bw,
          qn: heightLabel || `${variants.length}`,
          label: heightLabel || resolution,
          url: absUrl
        });
        pendingInf = null;
      }
    }
    variants.sort((a, b) => b.bw - a.bw);
    return variants.map(({ qn, label, url }) => ({ qn, label, url }));
  }
  return __toCommonJS(kick_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
