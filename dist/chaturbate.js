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

  // plugins/chaturbate.js
  var chaturbate_exports = {};
  __export(chaturbate_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
  var REFERER = "https://chaturbate.com/";
  var API = "https://chaturbate.com/api/ts/roomlist/room-list/";
  var HEADERS = {
    "User-Agent": UA,
    "Accept-Language": "en-US,en;q=0.9",
    Accept: "application/json, text/plain, */*",
    Referer: REFERER,
    Origin: "https://chaturbate.com",
    "X-Requested-With": "XMLHttpRequest"
  };
  var manifest = {
    id: "chaturbate",
    label: "Chaturbate",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function mapRoom(r) {
    if (!r.username) return void 0;
    return {
      platform: "chaturbate",
      roomId: r.username,
      title: r.room_subject || r.current_show || r.display_name || r.username,
      uname: r.display_name || r.username,
      cover: r.image_url_360x270 || r.image_url || r.img,
      online: r.num_users ?? 0,
      category: r.tags?.[0] || r.gender,
      introduction: r.spoken_languages ? `${r.gender ?? "\u2014"} \xB7 ${r.location ?? "\u2014"} \xB7 ${r.spoken_languages}` : void 0,
      live: true,
      link: `https://chaturbate.com/${r.username}/`
    };
  }
  async function fetchList(ctx, params) {
    const url = new URL(API);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await ctx.fetch(url.toString(), { headers: HEADERS, timeout: 25e3, http2: true });
    if (!res.ok) {
      if (res.status === 403 || res.status === 503) throw new Error(`[LIST_UNSUPPORTED]Chaturbate Cloudflare HTTP ${res.status} \u62E6\u622A,\u8BF7\u914D\u7F6E\u4EE3\u7406`);
      throw new Error(`Chaturbate HTTP ${res.status}`);
    }
    const body = await res.json();
    return body.rooms ?? body.results ?? [];
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const limit = Math.max(pageSize, 30);
    const rooms = await fetchList(ctx, { limit, offset: (page - 1) * limit });
    return { list: rooms.map(mapRoom).filter(Boolean), hasMore: rooms.length >= limit };
  }
  async function getCategories(ctx) {
    return [
      { id: "genders=f", name: "Female" },
      { id: "genders=m", name: "Male" },
      { id: "genders=c", name: "Couples" },
      { id: "genders=t", name: "Trans" },
      { id: "tags=asian", name: "Asian" },
      { id: "tags=latina", name: "Latina" },
      { id: "tags=ebony", name: "Ebony" },
      { id: "tags=teen18", name: "18+" },
      { id: "tags=milf", name: "MILF" },
      { id: "tags=mature", name: "Mature" },
      { id: "tags=bigboobs", name: "Big Boobs" },
      { id: "tags=anal", name: "Anal" },
      { id: "tags=squirt", name: "Squirt" },
      { id: "tags=dance", name: "Dance" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const [k, v] = categoryId.split("=");
    if (!k || !v) return { list: [], hasMore: false };
    const limit = 30;
    const rooms = await fetchList(ctx, { [k]: v, limit, offset: (page - 1) * limit });
    return { list: rooms.map(mapRoom).filter(Boolean), hasMore: rooms.length >= limit };
  }
  async function search(ctx, { keyword }) {
    const rooms = await fetchList(ctx, { tags: keyword.toLowerCase().replace(/\s+/g, ""), limit: 30 });
    return { list: rooms.map(mapRoom).filter(Boolean), hasMore: false };
  }
  async function getRoomDetail(ctx, { roomId }) {
    const rooms = await fetchList(ctx, { limit: 100 }).catch(() => []);
    const hit = rooms.find((r) => r.username === roomId);
    if (hit) return mapRoom(hit);
    return { platform: "chaturbate", roomId, title: roomId, uname: roomId, live: false, link: `https://chaturbate.com/${roomId}/` };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const rooms = await fetchList(ctx, { limit: 100 });
      return rooms.some((r) => r.username === roomId);
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const res = await ctx.fetch(`https://chaturbate.com/${roomId}/`, {
      headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error(`Chaturbate HTTP ${res.status}`);
    const html = await res.text();
    const m = html.match(/window\.initialRoomDossier\s*=\s*"([^"]+)"/);
    if (!m) throw new Error("Chaturbate \u672A\u627E\u5230 initialRoomDossier");
    let dossier;
    try {
      dossier = JSON.parse(JSON.parse('"' + m[1] + '"'));
    } catch (e) {
      throw new Error(`Chaturbate dossier \u89E3\u6790\u5931\u8D25: ${e.message}`);
    }
    if (dossier.room_status && dossier.room_status !== "public") throw new Error(`Chaturbate \u623F\u95F4\u72B6\u6001 ${dossier.room_status}`);
    if (!dossier.hls_source) throw new Error("Chaturbate \u672A\u5F00\u64AD");
    return ctx.protocols.hlsStream({ url: dossier.hls_source, referer: REFERER, ua: UA });
  }
  return __toCommonJS(chaturbate_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
