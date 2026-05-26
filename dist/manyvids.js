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

  // plugins/manyvids.js
  var manyvids_exports = {};
  __export(manyvids_exports, {
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.manyvids.com/live/online";
  var AGORA_APP_ID = "07af9cc5c9cd4cf7bf0b730a72997902";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://www.manyvids.com", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };
  var listCache = null;
  var TTL = 3e4;
  var manifest = {
    id: "manyvids",
    label: "ManyVids",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  async function fetchAll(ctx) {
    if (listCache && listCache.expiry > Date.now()) return listCache.data;
    const url = "https://api.manyvids.com/live/creators?sortBy=rank&limit=300&blockedCountry=Hong%20Kong&status=online";
    const res = await ctx.fetch(url, { headers: HEADERS, timeout: 3e4, http2: true });
    if (!res.ok) throw new Error(`ManyVids HTTP ${res.status}`);
    const data = await res.json();
    const creators = data.creators ?? [];
    listCache = { data: creators, expiry: Date.now() + TTL };
    return creators;
  }
  function mapRoom(c) {
    const handle = c.url_handle;
    if (!handle) return void 0;
    const name = c.display_name || handle;
    return {
      platform: "manyvids",
      roomId: handle,
      title: name,
      uname: name,
      avatar: c.avatar || c.portrait,
      cover: c.live_cover || c.portrait,
      live: (c.live_status || "").toUpperCase() === "ONLINE",
      link: c.session_url || `https://www.manyvids.com/live/cam/${encodeURIComponent(handle)}`
    };
  }
  async function findCreator(ctx, handle) {
    const all = await fetchAll(ctx);
    const key = handle.toLowerCase();
    return all.find((c) => (c.url_handle || "").toLowerCase() === key || (c.display_name || "").toLowerCase() === key);
  }
  async function joinChannel(ctx, userId) {
    const res = await ctx.fetch(`https://api.manyvids.com/live/room/${encodeURIComponent(userId)}/joinChannel`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: "PUBLIC" }),
      timeout: 2e4,
      http2: true
    });
    if (!res.ok) throw new Error(`ManyVids joinChannel HTTP ${res.status}`);
    return res.json();
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const all = await fetchAll(ctx);
    const start = (page - 1) * pageSize;
    return { list: all.slice(start, start + pageSize).map(mapRoom).filter(Boolean), hasMore: start + pageSize < all.length };
  }
  async function getRoomDetail(ctx, { roomId }) {
    const c = await findCreator(ctx, roomId);
    if (!c) throw new Error(`ManyVids ${roomId} \u4E0D\u5728\u7EBF\u6216\u4E0D\u5B58\u5728`);
    const base = mapRoom(c);
    if (!base) throw new Error(`ManyVids ${roomId} \u6570\u636E\u5F02\u5E38`);
    return base;
  }
  async function getLiveStatus(ctx, { roomId }) {
    const c = await findCreator(ctx, roomId);
    return (c?.live_status || "").toUpperCase() === "ONLINE";
  }
  async function resolve(ctx, { roomId }) {
    const c = await findCreator(ctx, roomId);
    if (!c) throw new Error(`ManyVids ${roomId} \u5F53\u524D\u4E0D\u5728\u7EBF\u6216\u4E0D\u5B58\u5728`);
    if ((c.live_status || "").toUpperCase() !== "ONLINE") throw new Error(`ManyVids ${roomId} \u72B6\u6001 ${c.live_status}`);
    if (!c.user_id) throw new Error(`ManyVids ${roomId} \u7F3A\u5C11 user_id`);
    const jc = await joinChannel(ctx, c.user_id);
    const info = jc.meetingInfo;
    if (!info?.channelId || !info?.rtc || typeof info?.uid !== "number") {
      throw new Error(`ManyVids joinChannel \u5F02\u5E38: ${jc.message || ""}`);
    }
    return ctx.protocols.agoraStream({
      appId: AGORA_APP_ID,
      channelId: info.channelId,
      token: info.rtc,
      uid: info.uid,
      refresh: async () => {
        const fresh = await joinChannel(ctx, c.user_id);
        const m = fresh.meetingInfo;
        if (!m?.channelId || !m?.rtc || typeof m?.uid !== "number") throw new Error(`ManyVids refresh \u5F02\u5E38`);
        return { channelId: m.channelId, token: m.rtc, uid: m.uid };
      },
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(manyvids_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
