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

  // plugins/kuaishou.js
  var kuaishou_exports = {};
  __export(kuaishou_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://live.kuaishou.com/";
  var COOKIE = `did=web_${randomHex(36)};clientid=3;kpf=PC_WEB;kpn=GAME_ZONE`;
  var HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Accept: "application/json, text/plain, */*",
    Cookie: COOKIE
  };
  var HTML_HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    Cookie: COOKIE
  };
  function randomHex(len) {
    const chars = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
    return s;
  }
  function normalizeImage(url) {
    if (!url) return url;
    if (/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url)) return url;
    return url + ".jpg";
  }
  var manifest = {
    id: "kuaishou",
    label: "\u5FEB\u624B",
    version: "1.0.0",
    defaultProxy: "direct",
    engine: { netliveApi: 1 }
  };
  function mapRoom(info) {
    const author = info.author || {};
    const game = info.gameInfo || {};
    return {
      platform: "kuaishou",
      roomId: author.id || "",
      title: author.description || author.name || "",
      uname: author.name || "",
      avatar: normalizeImage(author.avatar),
      cover: normalizeImage(game.poster || info.cover),
      online: info.watchingCount ?? 0,
      category: game.name,
      live: true,
      link: `https://live.kuaishou.com/u/${author.id}`
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const res = await ctx.fetch(
      `https://live.kuaishou.com/live_api/home/list`,
      { headers: HEADERS, timeout: 25e3 }
    );
    if (!res.ok) throw new Error(`\u5FEB\u624B HTTP ${res.status}`);
    const data = await res.json();
    const items = data.data?.list || [];
    const rooms = [];
    for (const item of items) {
      const infos = item.gameLiveInfo || [];
      for (const gi of infos) {
        const lives = gi.liveInfo || [];
        for (const li of lives) {
          const r = mapRoom(li);
          if (r && r.roomId) rooms.push(r);
        }
      }
    }
    return { list: rooms, hasMore: false };
  }
  async function getCategories(ctx) {
    return [
      { id: "1", name: "\u70ED\u95E8" },
      { id: "2", name: "\u7F51\u6E38" },
      { id: "3", name: "\u5355\u673A" },
      { id: "4", name: "\u624B\u6E38" },
      { id: "5", name: "\u68CB\u724C" },
      { id: "6", name: "\u5A31\u4E50" },
      { id: "7", name: "\u7EFC\u5408" },
      { id: "8", name: "\u6587\u5316" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    let url;
    if (/^\d{1,2}$/.test(categoryId)) {
      url = `https://live.kuaishou.com/live_api/category/data?type=${categoryId}&page=${page}&size=30`;
    } else if (categoryId.length <= 10) {
      url = `https://live.kuaishou.com/live_api/gameboard/list?filterType=0&pageSize=20&gameId=${encodeURIComponent(categoryId)}&page=${page}`;
    } else {
      url = `https://live.kuaishou.com/live_api/non-gameboard/list?filterType=0&pageSize=20&gameId=${encodeURIComponent(categoryId)}&page=${page}`;
    }
    const res = await ctx.fetch(url, { headers: HEADERS, timeout: 25e3 });
    if (!res.ok) throw new Error(`\u5FEB\u624B HTTP ${res.status}`);
    const data = await res.json();
    const items = data.data?.list || data.data || [];
    const rooms = [];
    for (const item of items) {
      if (item.author) {
        const r = mapRoom(item);
        if (r && r.roomId) rooms.push(r);
      } else if (item.gameLiveInfo) {
        for (const gi of Array.isArray(item.gameLiveInfo) ? item.gameLiveInfo : [item.gameLiveInfo]) {
          const lives = gi.liveInfo || [];
          for (const li of lives) {
            const r = mapRoom(li);
            if (r && r.roomId) rooms.push(r);
          }
        }
      }
    }
    return { list: rooms, hasMore: items.length >= 20 };
  }
  function extractInitialState(html) {
    const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|window\.)/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  async function fetchRoomHtml(ctx, roomId) {
    const res = await ctx.fetch(`https://live.kuaishou.com/u/${encodeURIComponent(roomId)}`, {
      headers: HTML_HEADERS,
      timeout: 25e3
    });
    if (!res.ok) throw new Error(`\u5FEB\u624B HTTP ${res.status}`);
    const html = await res.text();
    const state = extractInitialState(html);
    if (!state) throw new Error("\u5FEB\u624B \u672A\u627E\u5230 __INITIAL_STATE__");
    return state;
  }
  async function getRoomDetail(ctx, { roomId }) {
    const state = await fetchRoomHtml(ctx, roomId);
    const liveroom = state.liveroom || state.liveRoom || {};
    const playList = liveroom.playList || [];
    const stream = playList[0]?.liveStream || {};
    const author = stream.user || liveroom.author || {};
    return {
      platform: "kuaishou",
      roomId,
      title: stream.caption || liveroom.title || author.user_name || roomId,
      uname: author.user_name || author.name || roomId,
      avatar: normalizeImage(author.headurl || author.avatar),
      cover: normalizeImage(stream.coverUrl || liveroom.cover),
      online: stream.watchingCount ?? liveroom.watchingCount ?? 0,
      category: stream.gameInfo?.name || liveroom.gameName,
      live: !!stream.playUrls,
      link: `https://live.kuaishou.com/u/${roomId}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const state = await fetchRoomHtml(ctx, roomId);
      const liveroom = state.liveroom || state.liveRoom || {};
      const playList = liveroom.playList || [];
      const stream = playList[0]?.liveStream || {};
      return !!stream.playUrls;
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const state = await fetchRoomHtml(ctx, roomId);
    const liveroom = state.liveroom || state.liveRoom || {};
    const playList = liveroom.playList || [];
    const stream = playList[0]?.liveStream || {};
    const playUrls = stream.playUrls;
    if (!playUrls) throw new Error(`\u5FEB\u624B \u4E3B\u64AD ${roomId} \u672A\u5728\u76F4\u64AD`);
    const h264 = playUrls.h264 || playUrls.H264 || {};
    const adaptationSet = h264.adaptationSet || {};
    const representations = adaptationSet.representation || [];
    if (representations.length === 0) throw new Error("\u5FEB\u624B \u672A\u8FD4\u56DE\u53EF\u7528\u6D41");
    const sorted = [...representations].sort((a, b) => (b.level || 0) - (a.level || 0));
    const best = sorted[0];
    const alternatives = sorted.map((r) => ({
      qn: r.name || String(r.level || 0),
      label: r.name || `${r.level}`,
      url: r.url
    }));
    const bestUrl = best.url || "";
    if (bestUrl.includes(".flv") || bestUrl.includes("/flv/")) {
      return ctx.protocols.flvStream({
        url: bestUrl,
        qn: best.name || "original",
        qnLabel: best.name || "\u539F\u753B",
        alternatives: alternatives.length > 1 ? alternatives : void 0,
        referer: REFERER,
        ua: UA
      });
    }
    return ctx.protocols.hlsStream({
      url: bestUrl,
      qn: best.name || "original",
      qnLabel: best.name || "\u539F\u753B",
      alternatives: alternatives.length > 1 ? alternatives : void 0,
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(kuaishou_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
