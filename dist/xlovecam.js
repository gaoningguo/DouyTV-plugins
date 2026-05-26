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

  // plugins/xlovecam.js
  var xlovecam_exports = {};
  __export(xlovecam_exports, {
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.xlovecam.com/";
  var API_BASE = "https://www.xlovecam.com/hu";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://www.xlovecam.com", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };
  var nicknameToId = /* @__PURE__ */ new Map();
  var manifest = {
    id: "xlovecam",
    label: "XLoveCam",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  async function postForm(ctx, path, body) {
    const form = Object.entries(body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    const res = await ctx.fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error(`XLoveCam HTTP ${res.status}`);
    return res.json();
  }
  function mapRoom(p) {
    if (!p.nickname) return void 0;
    if (typeof p.id === "number") nicknameToId.set(p.nickname, p.id);
    return {
      platform: "xlovecam",
      roomId: p.nickname,
      title: p.nickname,
      uname: p.nickname,
      avatar: p.profileImg,
      cover: p.snapshot || p.profileImg,
      online: 0,
      live: true,
      link: `https://www.xlovecam.com/hu/profile/${encodeURIComponent(p.nickname)}`
    };
  }
  function listBody(nickname, from, length) {
    return {
      "config[nickname]": nickname,
      "config[favorite]": "0",
      "config[recent]": "0",
      "config[vip]": "0",
      "config[sort][id]": "35",
      "offset[from]": String(from),
      "offset[length]": String(length),
      origin: "filter-chg",
      stat: "0"
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const length = Math.max(pageSize, 20);
    const from = Math.max(0, (page - 1) * length);
    const data = await postForm(ctx, "/performerAction/onlineList", listBody("", from, length));
    const arr = data.content?.performerList ?? [];
    return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length >= length };
  }
  async function search(ctx, { keyword }) {
    const data = await postForm(ctx, "/performerAction/onlineList", listBody(keyword, 0, 50));
    const arr = data.content?.performerList ?? [];
    return { list: arr.map(mapRoom).filter(Boolean), hasMore: false };
  }
  async function resolveId(ctx, nickname) {
    const cached = nicknameToId.get(nickname);
    if (cached) return cached;
    const data = await postForm(ctx, "/performerAction/onlineList", listBody(nickname, 0, 10));
    for (const p of data.content?.performerList ?? []) {
      if (p.nickname?.toLowerCase() === nickname.toLowerCase() && typeof p.id === "number") {
        nicknameToId.set(nickname, p.id);
        return p.id;
      }
    }
    return null;
  }
  async function resolve(ctx, { roomId }) {
    const id = await resolveId(ctx, roomId);
    if (!id) throw new Error(`XLoveCam \u672A\u627E\u5230\u4E3B\u64AD ${roomId}`);
    const data = await postForm(ctx, "/performerAction/getPerformerRoom", { performerId: String(id) });
    const perf = data.content?.performer;
    if (!perf) throw new Error("XLoveCam \u62FF\u4E0D\u5230\u623F\u95F4\u6570\u636E");
    if (perf.online !== 1) throw new Error(`XLoveCam \u4E3B\u64AD ${roomId} \u4E0D\u5728\u7EBF`);
    if (!perf.hlsPlaylistFree) throw new Error(`XLoveCam \u4E3B\u64AD ${roomId} \u79C1\u5BC6\u6A21\u5F0F`);
    return ctx.protocols.hlsStream({ url: perf.hlsPlaylistFree, referer: REFERER, ua: UA });
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const id = await resolveId(ctx, roomId);
      if (!id) return false;
      const data = await postForm(ctx, "/performerAction/getPerformerRoom", { performerId: String(id) });
      return data.content?.performer?.online === 1;
    } catch {
      return false;
    }
  }
  return __toCommonJS(xlovecam_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
