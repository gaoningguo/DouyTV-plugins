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
  var manifest = {
    id: "kuaishou",
    label: "\u5FEB\u624B\u76F4\u64AD",
    version: "1.0.0",
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  function randomDid() {
    let s = "";
    for (let i = 0; i < 36; i++) {
      s += Math.floor(Math.random() * 16).toString(16);
    }
    return "web_" + s;
  }
  var SESSION_DID = randomDid();
  var SESSION_CLIENTID = "3";
  var HEADERS_BASE = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Connection: "keep-alive",
    Referer: "https://live.kuaishou.com/",
    Origin: "https://live.kuaishou.com",
    Cookie: "did=" + SESSION_DID + ";clientid=" + SESSION_CLIENTID + ";kpf=PC_WEB;kpn=GAME_ZONE",
    "Sec-Ch-Ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"'
  };
  var IMAGE_EXTS = /* @__PURE__ */ new Set([
    "svgz",
    "pjp",
    "png",
    "ico",
    "avif",
    "tiff",
    "tif",
    "jfif",
    "svg",
    "xbm",
    "pjpeg",
    "webp",
    "jpg",
    "jpeg",
    "bmp",
    "gif"
  ]);
  function isImage(url) {
    if (!url) return false;
    const ext = url.split(".").pop() ?? "";
    return IMAGE_EXTS.has(ext.toLowerCase());
  }
  function normalizeCover(poster) {
    if (!poster) return void 0;
    return isImage(poster) ? poster : poster + ".jpg";
  }
  function authorDescription(d) {
    return d ? d.replace(/\n/g, " ") : "";
  }
  function parseWatching(v) {
    if (v === void 0 || v === null) return void 0;
    if (typeof v === "number") return v;
    const n = parseInt(v, 10);
    return isNaN(n) ? void 0 : n;
  }
  async function fetchJsonHelper(ctx, url, init) {
    init = init || {};
    const res = await ctx.fetch(url, {
      method: "GET",
      headers: { ...HEADERS_BASE, ...init.headers || {} },
      timeout: 2e4
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
    return res.json();
  }
  async function fetchText(ctx, url, init) {
    init = init || {};
    const res = await ctx.fetch(url, {
      method: "GET",
      headers: { ...HEADERS_BASE, ...init.headers || {} },
      timeout: 2e4
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
    return res.text();
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const data = await fetchJsonHelper(ctx, "https://live.kuaishou.com/live_api/home/list");
    const list = [];
    for (const item of data.data?.list ?? []) {
      for (const sub of item.gameLiveInfo ?? []) {
        for (const t of sub.liveInfo ?? []) {
          const author = t.author;
          if (!author?.id) continue;
          list.push({
            platform: "kuaishou",
            roomId: author.id,
            title: authorDescription(author.description),
            cover: normalizeCover(t.gameInfo?.poster),
            uname: author.name,
            avatar: author.avatar,
            online: parseWatching(t.watchingCount),
            category: t.gameInfo?.name,
            live: true,
            link: "https://live.kuaishou.com/u/" + author.id
          });
        }
      }
    }
    return { list, hasMore: false };
  }
  var PARENT_CATS = [
    { id: "1", name: "\u70ED\u95E8" },
    { id: "2", name: "\u7F51\u6E38" },
    { id: "3", name: "\u5355\u673A" },
    { id: "4", name: "\u624B\u6E38" },
    { id: "5", name: "\u68CB\u724C" },
    { id: "6", name: "\u5A31\u4E50" },
    { id: "7", name: "\u7EFC\u5408" },
    { id: "8", name: "\u6587\u5316" }
  ];
  async function getCategories(ctx) {
    const out = [];
    for (const parent of PARENT_CATS) {
      let pg = 1;
      const pgSize = 30;
      while (pg < 10) {
        let resp;
        try {
          resp = await fetchJsonHelper(
            ctx,
            "https://live.kuaishou.com/live_api/category/data?type=" + parent.id + "&page=" + pg + "&size=" + pgSize
          );
        } catch (e) {
          break;
        }
        const sub = resp.data?.list ?? [];
        for (const c of sub) {
          if (!c.id) continue;
          out.push({ id: c.id, name: c.name ?? "", cover: c.poster, parent: parent.name });
        }
        if (sub.length < pgSize) break;
        pg++;
      }
    }
    return out;
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const api = categoryId.length < 7 ? "https://live.kuaishou.com/live_api/gameboard/list" : "https://live.kuaishou.com/live_api/non-gameboard/list";
    const url = api + "?filterType=0&pageSize=20&gameId=" + encodeURIComponent(categoryId) + "&page=" + page;
    const data = await fetchJsonHelper(ctx, url);
    const items = data.data?.list ?? [];
    const list = [];
    for (const item of items) {
      const aid = item.author?.id;
      if (!aid) continue;
      list.push({
        platform: "kuaishou",
        roomId: aid,
        title: item.caption ?? "",
        cover: normalizeCover(item.poster),
        uname: item.author?.name,
        avatar: item.author?.avatar,
        online: parseWatching(item.watchingCount),
        category: item.gameInfo?.name,
        live: true,
        link: "https://live.kuaishou.com/u/" + aid
      });
    }
    return { list, hasMore: items.length >= 20 };
  }
  async function fetchInitialState(ctx, roomId) {
    const url = "https://live.kuaishou.com/u/" + encodeURIComponent(roomId);
    const html = await fetchText(ctx, url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1"
      }
    });
    const m = html.match(/window\.__INITIAL_STATE__=([\s\S]*?);/);
    const raw = m ? m[1] : null;
    if (!raw) throw new Error("\u5FEB\u624B\u672A\u627E\u5230 __INITIAL_STATE__");
    const cleaned = raw.replace(/undefined/g, "null");
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error("\u5FEB\u624B __INITIAL_STATE__ \u89E3\u6790\u5931\u8D25\uFF1A" + e.message);
    }
  }
  async function getRoomDetail(ctx, { roomId }) {
    const state = await fetchInitialState(ctx, roomId);
    const play = state.liveroom?.playList?.[0];
    if (!play) throw new Error("\u5FEB\u624B\u672A\u8FD4\u56DE playList");
    const author = play.author ?? {};
    const game = play.gameInfo ?? {};
    const live = !!play.isLiving;
    return {
      platform: "kuaishou",
      roomId,
      title: authorDescription(author.description),
      cover: normalizeCover(play.liveStream?.poster),
      uname: author.name,
      avatar: author.avatar,
      online: live ? parseWatching(game.watchingCount) : 0,
      category: game.name,
      live,
      link: "https://live.kuaishou.com/u/" + roomId
    };
  }
  function pickKsStream(playUrls) {
    if (!playUrls) return { primary: "", alts: [] };
    const codec = Array.isArray(playUrls) ? playUrls[0] : playUrls;
    if (!codec) return { primary: "", alts: [] };
    const reps = codec.h264?.adaptationSet?.representation ?? codec.h265?.adaptationSet?.representation ?? [];
    if (reps.length === 0) return { primary: "", alts: [] };
    const sorted = [...reps].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const alts = sorted.filter((r) => r.url).map((r) => ({
      qn: String(r.level ?? 0),
      label: r.name ?? "",
      url: r.url ?? ""
    }));
    return { primary: alts[0]?.url ?? "", alts };
  }
  async function resolve(ctx, { roomId }) {
    const state = await fetchInitialState(ctx, roomId);
    const play = state.liveroom?.playList?.[0];
    if (!play?.isLiving) throw new Error("\u5FEB\u624B\u76F4\u64AD\u95F4\u672A\u5F00\u64AD");
    const picked = pickKsStream(play.liveStream?.playUrls);
    if (!picked.primary) throw new Error("\u5FEB\u624B\u672A\u5339\u914D\u5230\u53EF\u64AD\u6D41");
    return ctx.protocols.hlsStream({
      url: picked.primary,
      qn: picked.alts[0]?.qn,
      qnLabel: picked.alts[0]?.label,
      alternatives: picked.alts.length > 0 ? picked.alts : void 0,
      referer: "https://live.kuaishou.com/",
      ua: UA
    });
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const detail = await getRoomDetail(ctx, { roomId });
      return detail.live;
    } catch {
      return false;
    }
  }
  return __toCommonJS(kuaishou_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
