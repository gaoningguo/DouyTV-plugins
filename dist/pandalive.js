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

  // plugins/pandalive.js
  var pandalive_exports = {};
  __export(pandalive_exports, {
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
    id: "pandalive",
    label: "Pandalive",
    version: "1.0.0",
    adult: true,
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.pandalive.co.kr/";
  var API_BASE = "https://api.pandalive.co.kr";
  var LIST_CACHE_TTL_MS = 3e4;
  var BLOCK_COOLDOWN_MS = 10 * 6e4;
  var listCache = /* @__PURE__ */ new Map();
  var blockedUntil = 0;
  var lastBlockMessage = "";
  function getCachedList(key) {
    const hit = listCache.get(key);
    if (!hit) return void 0;
    if (hit.expiry < Date.now()) {
      listCache.delete(key);
      return void 0;
    }
    return hit.data;
  }
  function setCachedList(key, data) {
    listCache.set(key, { data, expiry: Date.now() + LIST_CACHE_TTL_MS });
    if (listCache.size > 32) {
      const firstKey = listCache.keys().next().value;
      if (firstKey !== void 0) listCache.delete(firstKey);
    }
  }
  function ensureNotBlocked() {
    if (blockedUntil > Date.now()) {
      throw new Error(
        "Pandalive: " + (lastBlockMessage || "IP blocked, retry later or change proxy")
      );
    }
  }
  var COMMON_HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Origin: "https://www.pandalive.co.kr",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    Accept: "application/json, text/plain, */*",
    "X-Device-Info": JSON.stringify({
      t: "webPc",
      v: "1.0",
      ui: "0",
      ck: { sessKeyAsp: "" }
    })
  };
  function assertPandaliveOk(data) {
    if (data.result !== false) return;
    const code = data.errorData?.code;
    if (code === "block") {
      const msg = "Pandalive IP blocked" + (data.userIp ? " (" + data.userIp + ")" : "") + " - use KR/JP residential proxy";
      blockedUntil = Date.now() + BLOCK_COOLDOWN_MS;
      lastBlockMessage = msg;
      throw new Error("Pandalive: " + msg);
    }
    throw new Error(
      "Pandalive rejected" + (code ? " (" + code + ")" : "") + ": " + (data.errorData?.message ?? data.message ?? "unknown")
    );
  }
  function mapRoom(r) {
    const uid = r.userId;
    if (!uid) return void 0;
    return {
      platform: "pandalive",
      roomId: uid,
      title: r.title || r.userNick || uid,
      uname: r.userNick || uid,
      avatar: r.userImg,
      cover: r.thumbUrl,
      online: r.user ?? 0,
      category: r.isAdult ? "19+" : r.category,
      live: r.isLive ?? true,
      link: "https://www.pandalive.co.kr/live/play/" + uid
    };
  }
  async function getJson(ctx, path, params) {
    const qs = Object.entries(params).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(String(v))).join("&");
    const url = qs ? API_BASE + path + "?" + qs : API_BASE + path;
    let res;
    try {
      res = await ctx.fetch(url, {
        method: "GET",
        headers: COMMON_HEADERS,
        timeout: 25e3,
        http2: true
      });
    } catch (e) {
      throw new Error("Pandalive: network unreachable (" + (e?.message ?? String(e)) + ")");
    }
    if (!res.ok) {
      if (res.status === 403 || res.status === 503) {
        throw new Error("Pandalive: HTTP " + res.status + " blocked, need proxy");
      }
      throw new Error("Pandalive HTTP " + res.status);
    }
    return res.json();
  }
  async function postJson(ctx, path, body) {
    let res;
    try {
      res = await ctx.fetch(API_BASE + path, {
        method: "POST",
        headers: { ...COMMON_HEADERS, "Content-Type": "application/json" },
        json: body,
        timeout: 25e3,
        http2: true
      });
    } catch (e) {
      throw new Error("Pandalive: network unreachable (" + (e?.message ?? String(e)) + ")");
    }
    if (!res.ok) {
      if (res.status === 403 || res.status === 503) {
        throw new Error("Pandalive: HTTP " + res.status + " blocked, need proxy");
      }
      throw new Error("Pandalive HTTP " + res.status);
    }
    return res.json();
  }
  async function postForm(ctx, path, body) {
    const form = Object.entries(body).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
    let res;
    try {
      res = await ctx.fetch(API_BASE + path, {
        method: "POST",
        headers: {
          ...COMMON_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form,
        timeout: 25e3,
        http2: true
      });
    } catch (e) {
      throw new Error("Pandalive: network unreachable (" + (e?.message ?? String(e)) + ")");
    }
    if (!res.ok) {
      if (res.status === 403 || res.status === 503) {
        throw new Error("Pandalive: HTTP " + res.status + " blocked, need proxy");
      }
      throw new Error("Pandalive HTTP " + res.status);
    }
    return res.json();
  }
  async function fetchList(ctx, page, pageSize, orderBy, isAdult, onlyNewBj) {
    orderBy = orderBy ?? "user";
    isAdult = isAdult ?? false;
    onlyNewBj = onlyNewBj ?? "N";
    ensureNotBlocked();
    const ck = orderBy + "|" + onlyNewBj + "|" + (isAdult ? 1 : 0) + "|" + page + "|" + pageSize;
    const cached = getCachedList(ck);
    if (cached) return cached;
    const offset = Math.max(0, (page - 1) * pageSize);
    const params = { orderBy, onlyNewBj, limit: pageSize, offset };
    if (isAdult) params.isAdult = true;
    const data = await getJson(ctx, "/v1/live/index", params);
    assertPandaliveOk(data);
    setCachedList(ck, data);
    return data;
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const limit = Math.max(pageSize, 24);
    const data = await fetchList(ctx, page, limit, "user", false);
    const arr = data.list ?? [];
    const list = arr.map(mapRoom).filter((r) => !!r);
    const pg = data.page;
    const hasMore = pg ? (pg.page ?? page) < (pg.lastPage ?? 0) : arr.length >= limit;
    return { list, hasMore };
  }
  var PRESET_CATEGORIES = [
    { id: "user", name: "\u4EBA\u6C14" },
    { id: "newBj", name: "\u65B0\u4EBA" },
    { id: "bookmark", name: "\u6536\u85CF\u591A" },
    { id: "adult", name: "19+" }
  ];
  async function getCategories(ctx) {
    return PRESET_CATEGORIES;
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const isAdult = categoryId === "adult";
    const orderBy = isAdult ? "user" : categoryId;
    const data = await fetchList(ctx, page, 24, orderBy, isAdult);
    const arr = data.list ?? [];
    const list = arr.map(mapRoom).filter((r) => !!r);
    const pg = data.page;
    const hasMore = pg ? (pg.page ?? page) < (pg.lastPage ?? 0) : arr.length >= 24;
    return { list, hasMore };
  }
  async function search(ctx, { keyword, page }) {
    try {
      ensureNotBlocked();
      const data = await postJson(ctx, "/v1/live/bj_list", {
        keyword,
        orderBy: "user",
        onlyNewBj: "N",
        limit: 30,
        offset: 0
      });
      assertPandaliveOk(data);
      const arr = data.list ?? [];
      const list = arr.map(mapRoom).filter((r) => !!r);
      return { list, hasMore: false };
    } catch {
      return { list: [], hasMore: false };
    }
  }
  async function fetchPlay(ctx, roomId) {
    ensureNotBlocked();
    const data = await postForm(ctx, "/v1/live/play", {
      userId: roomId,
      action: "watch",
      password: "",
      shareLinkType: ""
    });
    assertPandaliveOk(data);
    return data;
  }
  async function getRoomDetail(ctx, { roomId }) {
    const info = await fetchPlay(ctx, roomId);
    const m = info.media;
    if (!m) throw new Error("Pandalive room " + roomId + " not found");
    return {
      platform: "pandalive",
      roomId,
      title: m.title || m.userNick || roomId,
      uname: m.userNick,
      avatar: m.userImg,
      cover: m.thumbUrl,
      online: m.user ?? 0,
      category: m.isAdult ? "19+" : m.category,
      live: m.isLive ?? true,
      link: "https://www.pandalive.co.kr/live/play/" + roomId
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const info = await fetchPlay(ctx, roomId);
      return !!info.media?.isLive;
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const data = await fetchPlay(ctx, roomId);
    if (data.errorData?.code) {
      const c = data.errorData.code;
      if (c === "needAdult" || c === "needLogin") {
        throw new Error("Pandalive: room requires login + 19+ age verification (KR ID)");
      }
      if (c === "needPw") {
        throw new Error("Pandalive: room is password-protected");
      }
      throw new Error("Pandalive resolve failed: " + (data.errorData.message ?? c));
    }
    const pl = data.PlayList;
    const url = pl?.hls3?.[0]?.url || pl?.hls2?.[0]?.url || pl?.hls?.[0]?.url;
    if (!url) {
      throw new Error("Pandalive: no hls URL (room may be offline or private)");
    }
    const alternatives = [
      ...(pl?.hls3 ?? []).map((x, i) => ({ qn: "hls3_" + i, label: x.name ?? "HD", url: x.url ?? "" })),
      ...(pl?.hls2 ?? []).map((x, i) => ({ qn: "hls2_" + i, label: x.name ?? "SD", url: x.url ?? "" })),
      ...(pl?.hls ?? []).map((x, i) => ({ qn: "hls_" + i, label: x.name ?? "Compat", url: x.url ?? "" }))
    ].filter((a) => a.url);
    return ctx.protocols.hlsStream({
      url,
      qn: "auto",
      qnLabel: "HD",
      referer: REFERER,
      ua: UA,
      alternatives: alternatives.length > 1 ? alternatives : void 0
    });
  }
  return __toCommonJS(pandalive_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
