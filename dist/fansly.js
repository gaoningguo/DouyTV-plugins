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

  // plugins/fansly.js
  var fansly_exports = {};
  __export(fansly_exports, {
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://fansly.com/";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://fansly.com", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };
  var accountById = /* @__PURE__ */ new Map();
  var usernameToId = /* @__PURE__ */ new Map();
  var manifest = {
    id: "fansly",
    label: "Fansly Live",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function pickAvatar(acc) {
    const variants = acc.avatar?.variants ?? [];
    const sorted = [...variants].filter((v) => v.locations?.[0]?.location).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    for (const v of sorted) if ((v.width ?? 0) >= 200) return v.locations?.[0]?.location;
    return sorted[0]?.locations?.[0]?.location;
  }
  function pickBanner(acc) {
    const variants = acc.banner?.variants ?? [];
    const sorted = [...variants].filter((v) => v.locations?.[0]?.location).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    for (const v of sorted) if ((v.width ?? 0) >= 480) return v.locations?.[0]?.location;
    return sorted[sorted.length - 1]?.locations?.[0]?.location;
  }
  function toRoom(acc) {
    if (!acc.id || !acc.username) return void 0;
    const ch = acc.streaming?.channel;
    const st = ch?.stream;
    const avatar = pickAvatar(acc);
    const banner = pickBanner(acc);
    return {
      platform: "fansly",
      roomId: acc.id,
      title: st?.title || acc.displayName || acc.username,
      uname: acc.displayName || acc.username,
      avatar,
      cover: banner || avatar,
      online: st?.viewerCount ?? 0,
      category: "live",
      live: ch?.status === 2 && st?.status === 2,
      link: `https://fansly.com/${encodeURIComponent(acc.username)}`,
      introduction: acc.about
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const ps = Math.max(1, Math.min(pageSize, 50));
    const offset = (page - 1) * ps;
    const url = `https://apiv3.fansly.com/api/v1/contentdiscovery/livesuggestions?limit=${ps}&offset=${offset}&ngsw-bypass=true`;
    const res = await ctx.fetch(url, { headers: HEADERS, timeout: 25e3 });
    if (!res.ok) throw new Error(`Fansly HTTP ${res.status}`);
    const data = await res.json();
    if (data.success !== true) throw new Error("Fansly success!=true");
    const accounts = data.response?.accounts ?? [];
    for (const a of accounts) {
      if (a.id) accountById.set(a.id, { at: Date.now(), acc: a });
      if (a.username && a.id) usernameToId.set(a.username.toLowerCase(), a.id);
    }
    return { list: accounts.map(toRoom).filter(Boolean), hasMore: accounts.length === ps };
  }
  async function search(ctx, { keyword }) {
    const kw = keyword.trim();
    if (!kw) return { list: [], hasMore: false };
    const url = `https://apiv3.fansly.com/api/v1/account?usernames=${encodeURIComponent(kw)}&ngsw-bypass=true`;
    const res = await ctx.fetch(url, { headers: HEADERS, timeout: 15e3 });
    if (!res.ok) return { list: [], hasMore: false };
    const data = await res.json();
    const rooms = [];
    for (const a of data.response ?? []) {
      if (!a.id || !a.username) continue;
      usernameToId.set(a.username.toLowerCase(), a.id);
      accountById.set(a.id, { at: Date.now(), acc: a });
      const r = toRoom(a);
      if (r) rooms.push(r);
    }
    return { list: rooms, hasMore: false };
  }
  async function getRoomId(ctx, username) {
    const cached = usernameToId.get(username.toLowerCase());
    if (cached) return cached;
    const res = await ctx.fetch(`https://apiv3.fansly.com/api/v1/account?usernames=${encodeURIComponent(username)}&ngsw-bypass=true`, { headers: HEADERS, timeout: 2e4 });
    if (!res.ok) return null;
    const data = await res.json();
    for (const a of data.response ?? []) {
      if (a.username?.toLowerCase() === username.toLowerCase() && a.id) {
        usernameToId.set(a.username.toLowerCase(), a.id);
        accountById.set(a.id, { at: Date.now(), acc: a });
        return a.id;
      }
    }
    return null;
  }
  async function fetchChannel(ctx, roomId) {
    const res = await ctx.fetch(`https://apiv3.fansly.com/api/v1/streaming/channel/${encodeURIComponent(roomId)}?ngsw-bypass=true`, { headers: HEADERS, timeout: 2e4 });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success !== true) return null;
    return data.response?.stream ?? null;
  }
  async function resolve(ctx, { roomId }) {
    let chId = roomId;
    if (!/^\d+$/.test(roomId)) {
      const found = await getRoomId(ctx, roomId);
      if (!found) throw new Error(`Fansly ${roomId} \u4E0D\u5B58\u5728`);
      chId = found;
    }
    const stream = await fetchChannel(ctx, chId);
    if (!stream) throw new Error(`Fansly ${roomId} \u62C9\u4E0D\u5230 stream`);
    if (stream.status !== 2) throw new Error(`Fansly ${roomId} \u4E0D\u5728\u7EBF`);
    if (stream.access !== true || !stream.playbackUrl) throw new Error(`Fansly ${roomId} \u9700\u8BA2\u9605`);
    return ctx.protocols.hlsStream({ url: stream.playbackUrl, referer: REFERER, ua: UA });
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      let chId = roomId;
      if (!/^\d+$/.test(roomId)) {
        const found = await getRoomId(ctx, roomId);
        if (!found) return false;
        chId = found;
      }
      const cached = accountById.get(chId);
      if (cached && Date.now() - cached.at < 6e4) return cached.acc.streaming?.channel?.status === 2;
      const s = await fetchChannel(ctx, chId);
      return s?.status === 2 && s?.access === true;
    } catch {
      return false;
    }
  }
  async function getRoomDetail(ctx, { roomId }) {
    let chId = roomId;
    if (!/^\d+$/.test(roomId)) {
      const found = await getRoomId(ctx, roomId);
      if (found) chId = found;
    }
    const cached = accountById.get(chId);
    if (cached && Date.now() - cached.at < 6e4) return toRoom(cached.acc);
    const res = await ctx.fetch(`https://apiv3.fansly.com/api/v1/account?ids=${encodeURIComponent(chId)}&ngsw-bypass=true`, { headers: HEADERS, timeout: 15e3 });
    if (res.ok) {
      const data = await res.json();
      for (const a of data.response ?? []) {
        if (a.id) {
          accountById.set(a.id, { at: Date.now(), acc: a });
          const r = toRoom(a);
          if (r) return r;
        }
      }
    }
    return { platform: "fansly", roomId, title: roomId, uname: roomId, live: false, link: `https://fansly.com/${encodeURIComponent(roomId)}` };
  }
  return __toCommonJS(fansly_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
