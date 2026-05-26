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

  // plugins/sexchathu.js
  var sexchathu_exports = {};
  __export(sexchathu_exports, {
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var manifest = {
    id: "sexchathu",
    label: "SexChat.hu",
    version: "1.0.0",
    adult: true,
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://sexchat.hu/";
  var COMMON_HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Accept: "application/json, text/plain, */*"
  };
  var LIST_ENDPOINTS = [
    "https://sexchat.hu/ajax/api/roomList/babes",
    "https://sexchat.hu/ajax/api/roomList/babes/all"
  ];
  function ensureHttps(url) {
    if (!url) return void 0;
    if (url.startsWith("//")) return "https:" + url;
    return url;
  }
  async function fetchEndpoint(ctx, url) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await ctx.fetch(url, {
          method: "GET",
          headers: COMMON_HEADERS,
          timeout: 3e4,
          http2: true
        });
        if (res.ok) return await res.json();
        if (res.status < 500) return [];
      } catch {
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
    return [];
  }
  async function fetchAll(ctx) {
    const lists = await Promise.all(LIST_ENDPOINTS.map((u) => fetchEndpoint(ctx, u)));
    if (lists.every((l) => l.length === 0)) {
      const res = await ctx.fetch(LIST_ENDPOINTS[0], {
        method: "GET",
        headers: COMMON_HEADERS,
        timeout: 3e4,
        http2: true
      });
      if (!res.ok) throw new Error("SexChatHU HTTP " + res.status);
      return await res.json();
    }
    const seen = /* @__PURE__ */ new Set();
    const merged = [];
    for (const list of lists) {
      for (const room of list) {
        const key = String(room.perfid ?? room.screenname ?? "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(room);
      }
    }
    return merged;
  }
  function statusKind(status) {
    const s = (status ?? "").toLowerCase();
    if (s === "free") return "free";
    if (s === "offline") return "offline";
    return "private";
  }
  function mapRoom(r) {
    const screen = r.screenname || r.onlineparams?.screenName;
    if (!screen) return void 0;
    const kind = statusKind(r.onlinestatus);
    const primaryCat = r.onlineparams?.publicData?.primaryCat || r.primarycat;
    const category = kind === "private" ? "\u{1F512} \u79C1\u5BC6\u76F4\u64AD\u4E2D" : primaryCat;
    return {
      platform: "sexchathu",
      roomId: screen,
      title: screen,
      uname: screen,
      cover: ensureHttps(r.snapshotid_big || r.snapshotid),
      online: 0,
      category,
      live: kind === "free",
      link: r.perfid ? "https://sexchat.hu/mypage/" + r.perfid + "/" + encodeURIComponent(screen) + "/chat" : "https://sexchat.hu/"
    };
  }
  function statusOrder(status) {
    switch (statusKind(status)) {
      case "free":
        return 0;
      case "private":
        return 1;
      default:
        return 2;
    }
  }
  var pagedCache = null;
  var PAGED_CACHE_TTL_MS = 5 * 60 * 1e3;
  var PAGED_SOFT_LIMIT = 15;
  function roomKey(r) {
    return String(r.perfid ?? r.screenname ?? "");
  }
  function findCachedRoom(roomId) {
    if (!pagedCache) return void 0;
    if (/^\d+$/.test(roomId)) {
      const direct = pagedCache.rooms.get(roomId);
      if (direct) return direct;
    }
    const lower = roomId.toLowerCase();
    for (const r of pagedCache.rooms.values()) {
      if ((r.screenname ?? "").toLowerCase() === lower) return r;
    }
    return void 0;
  }
  async function fetchRoomByPerfid(ctx, perfid) {
    const arr = await fetchEndpoint(
      ctx,
      "https://sexchat.hu/ajax/api/roomList/babes/" + perfid
    );
    const target = String(perfid);
    return arr.find((r) => String(r.perfid) === target);
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const now = Date.now();
    const stale = !pagedCache || now - pagedCache.lastUpdate > PAGED_CACHE_TTL_MS;
    if (page === 1 || stale) {
      pagedCache = { rooms: /* @__PURE__ */ new Map(), exhausted: false, lastUpdate: now };
    }
    if (pagedCache.exhausted) {
      return { list: [], hasMore: false };
    }
    const fresh = await fetchAll(ctx);
    const newRooms = [];
    for (const r of fresh) {
      const key = roomKey(r);
      if (!key) continue;
      if (!pagedCache.rooms.has(key)) {
        pagedCache.rooms.set(key, r);
        newRooms.push(r);
      }
    }
    pagedCache.lastUpdate = now;
    if (newRooms.length === 0) {
      pagedCache.exhausted = true;
      return { list: [], hasMore: false };
    }
    const sorted = newRooms.sort(
      (a, b) => statusOrder(a.onlinestatus) - statusOrder(b.onlinestatus)
    );
    const list = sorted.map(mapRoom).filter((r) => !!r);
    const hasMore = page < PAGED_SOFT_LIMIT;
    return { list, hasMore };
  }
  async function search(ctx, { keyword, page }) {
    const arr = await fetchAll(ctx);
    const kw = keyword.toLowerCase();
    const list = arr.filter((r) => (r.screenname ?? "").toLowerCase().includes(kw)).sort((a, b) => statusOrder(a.onlinestatus) - statusOrder(b.onlinestatus)).map(mapRoom).filter((r) => !!r);
    return { list, hasMore: false };
  }
  async function resolve(ctx, { roomId }) {
    let cached = findCachedRoom(roomId);
    if (!cached) {
      const arr = await fetchAll(ctx);
      cached = arr.find(
        (r) => (r.screenname ?? "").toLowerCase() === roomId.toLowerCase()
      );
      if (!cached) {
        throw new Error("SexChatHU \u672A\u627E\u5230\u4E3B\u64AD " + roomId + "\uFF08\u53EF\u80FD\u5DF2\u79BB\u7EBF\uFF09");
      }
    }
    if (!cached.perfid) {
      throw new Error("SexChatHU " + roomId + " \u7F3A perfid\uFF0C\u65E0\u6CD5 resolve");
    }
    const fresh = await fetchRoomByPerfid(ctx, cached.perfid);
    if (!fresh) {
      throw new Error("SexChatHU \u4E3B\u64AD " + roomId + " \u5DF2\u4E0B\u7EBF");
    }
    const status = (fresh.onlinestatus ?? "").toLowerCase();
    if (status !== "free") {
      throw new Error(
        "SexChatHU \u4E3B\u64AD " + roomId + " \u72B6\u6001 " + status + "\uFF08\u79C1\u5BC6/\u79BB\u7EBF\uFF0C\u533F\u540D\u65E0\u753B\u9762\uFF09"
      );
    }
    const hls = ensureHttps(fresh.onlineparams?.modeSpecific?.main?.hls?.address);
    if (!hls) throw new Error("SexChatHU " + roomId + " \u65E0 HLS URL\uFF08\u72B6\u6001 free \u4F46\u65E0\u6D41\uFF09");
    return ctx.protocols.hlsStream({
      url: hls,
      qn: "auto",
      qnLabel: "\u81EA\u9002\u5E94",
      referer: REFERER,
      ua: UA
    });
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const cached = findCachedRoom(roomId);
      if (cached?.perfid) {
        const fresh = await fetchRoomByPerfid(ctx, cached.perfid);
        return (fresh?.onlinestatus ?? "").toLowerCase() === "free";
      }
      const arr = await fetchAll(ctx);
      const found = arr.find(
        (r) => (r.screenname ?? "").toLowerCase() === roomId.toLowerCase()
      );
      return (found?.onlinestatus ?? "").toLowerCase() === "free";
    } catch {
      return false;
    }
  }
  return __toCommonJS(sexchathu_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
