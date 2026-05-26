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
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://sexchat.hu/";
  var API_BASE = "https://sexchat.hu/ajax/api/roomList/babes";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "application/json, text/plain, */*" };
  var manifest = {
    id: "sexchathu",
    label: "SexChat HU",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  var roomCache = [];
  function statusLabel(s) {
    if (!s) return "offline";
    const lower = s.toLowerCase();
    if (lower === "free") return "free";
    if (lower === "offline") return "offline";
    return "private";
  }
  function mapRoom(r) {
    if (!r.perfid || !r.screenname) return void 0;
    const st = statusLabel(r.onlinestatus);
    if (st === "offline") return void 0;
    const cover = r.snapshotid_big ? `https://m1.nsimg.net/bigsnapshots/${r.snapshotid_big}` : r.snapshotid ? `https://m1.nsimg.net/snapshots/${r.snapshotid}` : void 0;
    return {
      platform: "sexchathu",
      roomId: r.screenname,
      title: r.screenname,
      uname: r.screenname,
      cover,
      online: 0,
      category: st === "free" ? "Free Chat" : "Private",
      live: st === "free",
      link: `https://sexchat.hu/${r.screenname}`,
      _perfid: r.perfid
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const [res1, res2] = await Promise.all([
      ctx.fetch(API_BASE, { headers: HEADERS, timeout: 25e3 }),
      ctx.fetch(`${API_BASE}/all`, { headers: HEADERS, timeout: 25e3 })
    ]);
    const arr1 = res1.ok ? await res1.json() : [];
    const arr2 = res2.ok ? await res2.json() : [];
    const seen = /* @__PURE__ */ new Set();
    const merged = [];
    for (const r of [...Array.isArray(arr1) ? arr1 : [], ...Array.isArray(arr2) ? arr2 : []]) {
      if (!r.perfid || seen.has(r.perfid)) continue;
      seen.add(r.perfid);
      merged.push(r);
    }
    merged.sort((a, b) => {
      const aFree = (a.onlinestatus || "").toLowerCase() === "free" ? 0 : 1;
      const bFree = (b.onlinestatus || "").toLowerCase() === "free" ? 0 : 1;
      return aFree - bFree;
    });
    roomCache = merged;
    const offset = (page - 1) * pageSize;
    const slice = merged.slice(offset, offset + pageSize);
    const list = slice.map(mapRoom).filter(Boolean);
    return { list, hasMore: offset + pageSize < merged.length };
  }
  async function search(ctx, { keyword }) {
    const kw = keyword.toLowerCase();
    let rooms = roomCache;
    if (!rooms.length) {
      const [res1, res2] = await Promise.all([
        ctx.fetch(API_BASE, { headers: HEADERS, timeout: 25e3 }),
        ctx.fetch(`${API_BASE}/all`, { headers: HEADERS, timeout: 25e3 })
      ]);
      const arr1 = res1.ok ? await res1.json() : [];
      const arr2 = res2.ok ? await res2.json() : [];
      const seen = /* @__PURE__ */ new Set();
      rooms = [];
      for (const r of [...Array.isArray(arr1) ? arr1 : [], ...Array.isArray(arr2) ? arr2 : []]) {
        if (!r.perfid || seen.has(r.perfid)) continue;
        seen.add(r.perfid);
        rooms.push(r);
      }
      roomCache = rooms;
    }
    const filtered = rooms.filter((r) => (r.screenname || "").toLowerCase().includes(kw));
    const list = filtered.map(mapRoom).filter(Boolean);
    return { list, hasMore: false };
  }
  async function resolve(ctx, { roomId }) {
    let perfid;
    const cached = roomCache.find((r) => (r.screenname || "").toLowerCase() === roomId.toLowerCase());
    if (cached) {
      perfid = cached.perfid;
    } else {
      const res2 = await ctx.fetch(API_BASE, { headers: HEADERS, timeout: 2e4 });
      if (res2.ok) {
        const arr = await res2.json();
        const found = (Array.isArray(arr) ? arr : []).find(
          (r) => (r.screenname || "").toLowerCase() === roomId.toLowerCase()
        );
        if (found) perfid = found.perfid;
      }
    }
    if (!perfid) throw new Error(`SexChatHU: ${roomId} \u672A\u627E\u5230\u6216\u4E0D\u5728\u7EBF`);
    const res = await ctx.fetch(`${API_BASE}/${perfid}`, { headers: HEADERS, timeout: 2e4 });
    if (!res.ok) throw new Error(`SexChatHU HTTP ${res.status}`);
    const data = await res.json();
    const rooms = Array.isArray(data) ? data : [];
    const room = rooms.find((r) => r.perfid === perfid);
    if (!room) throw new Error(`SexChatHU: ${roomId} \u623F\u95F4\u6570\u636E\u4E3A\u7A7A`);
    const hlsAddr = room.onlineparams?.modeSpecific?.main?.hls?.address;
    if (!hlsAddr) throw new Error(`SexChatHU: ${roomId} \u65E0 HLS \u5730\u5740 (\u53EF\u80FD\u4E0D\u5728\u7EBF)`);
    const hlsUrl = hlsAddr.startsWith("//") ? `https:${hlsAddr}` : hlsAddr;
    return ctx.protocols.hlsStream({ url: hlsUrl, referer: REFERER, ua: UA });
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const cached = roomCache.find((r) => (r.screenname || "").toLowerCase() === roomId.toLowerCase());
      if (cached) {
        return (cached.onlinestatus || "").toLowerCase() === "free";
      }
      const res = await ctx.fetch(API_BASE, { headers: HEADERS, timeout: 15e3 });
      if (!res.ok) return false;
      const arr = await res.json();
      const room = (Array.isArray(arr) ? arr : []).find(
        (r) => (r.screenname || "").toLowerCase() === roomId.toLowerCase()
      );
      return room ? (room.onlinestatus || "").toLowerCase() === "free" : false;
    } catch {
      return false;
    }
  }
  return __toCommonJS(sexchathu_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
