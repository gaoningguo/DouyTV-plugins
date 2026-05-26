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

  // plugins/bongacams.js
  var bongacams_exports = {};
  __export(bongacams_exports, {
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
    id: "bongacams",
    label: "BongaCams",
    version: "1.0.0",
    adult: true,
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://bongacams.com/";
  var COMMON_HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    "Accept-Language": "en-US,en;q=0.9",
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest"
  };
  function buildThumbUrl(thumb) {
    if (!thumb) return void 0;
    let url = thumb.replace("{ext}", "webp");
    if (url.startsWith("//")) url = "https:" + url;
    return url;
  }
  function mapRoom(r) {
    if (!r.username) return void 0;
    if (r.room && r.room !== "public") return void 0;
    return {
      platform: "bongacams",
      roomId: r.username,
      title: r.topic || r.display_name || r.username,
      uname: r.display_name || r.username,
      avatar: r.profile_image ?? r.profile_images?.thumbnail_image_medium,
      cover: buildThumbUrl(r.thumb_image),
      online: r.viewers ?? r.members_count ?? 0,
      category: r.gender ?? (r.tags && r.tags.length > 0 ? r.tags[0] : void 0) ?? r.country,
      live: true,
      link: "https://bongacams.com/" + r.username
    };
  }
  async function fetchList(ctx, params) {
    const url = new URL("https://bongacams.com/tools/listing_v3.php");
    url.searchParams.set("livetab", "female");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    const res = await ctx.fetch(url.toString(), {
      method: "GET",
      headers: COMMON_HEADERS,
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error("BongaCams HTTP " + res.status);
    const body = await res.json();
    return body.models ?? [];
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const limit = Math.max(pageSize, 24);
    const arr = await fetchList(ctx, { limit, offset: (page - 1) * limit });
    const list = arr.map(mapRoom).filter((r) => !!r);
    return { list, hasMore: arr.length >= limit };
  }
  var PRESET_CATEGORIES = [
    { id: "livetab=female", name: "Female" },
    { id: "livetab=male", name: "Male" },
    { id: "livetab=couples", name: "Couples" },
    { id: "livetab=transsexual", name: "Trans" },
    { id: "tag=asian", name: "Asian" },
    { id: "tag=latin", name: "Latin" },
    { id: "tag=ebony", name: "Ebony" },
    { id: "tag=18-19", name: "Teen 18+" },
    { id: "tag=milf", name: "MILF" },
    { id: "tag=mature", name: "Mature" },
    { id: "tag=big-boobs", name: "Big Boobs" },
    { id: "tag=dance", name: "Dance" }
  ];
  async function getCategories(ctx) {
    return PRESET_CATEGORIES;
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const [k, v] = categoryId.split("=");
    if (!k || !v) return { list: [], hasMore: false };
    const limit = 24;
    const arr = await fetchList(ctx, { [k]: v, limit, offset: (page - 1) * limit });
    const list = arr.map(mapRoom).filter((r) => !!r);
    return { list, hasMore: arr.length >= limit };
  }
  async function search(ctx, { keyword, page }) {
    const arr = await fetchList(ctx, {
      tag: keyword.toLowerCase().replace(/\s+/g, "-"),
      limit: 30
    });
    const list = arr.map(mapRoom).filter((r) => !!r);
    return { list, hasMore: false };
  }
  async function findRoomInListing(ctx, roomId) {
    try {
      const arr = await fetchList(ctx, { limit: 100 });
      return arr.find((r) => r.username === roomId) ?? null;
    } catch {
      return null;
    }
  }
  async function getRoomDetail(ctx, { roomId }) {
    const r = await findRoomInListing(ctx, roomId);
    if (r) {
      const mapped = mapRoom(r);
      if (mapped) return mapped;
    }
    return {
      platform: "bongacams",
      roomId,
      title: roomId,
      uname: roomId,
      live: false,
      link: "https://bongacams.com/" + roomId
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    return !!await findRoomInListing(ctx, roomId);
  }
  async function resolve(ctx, { roomId }) {
    const amfUrl = "https://bongacams.com/tools/amf.php?method=getRoomData&args%5B%5D=" + encodeURIComponent(roomId) + "&args%5B%5D=false";
    const res = await ctx.fetch(amfUrl, {
      method: "GET",
      headers: COMMON_HEADERS,
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error("BongaCams HTTP " + res.status);
    const body = await res.json();
    if (body.status !== "success") {
      throw new Error("BongaCams \u623F\u95F4 " + roomId + " \u4E0D\u53EF\u8BBF\u95EE (status=" + body.status + ")");
    }
    if (!body.performerData?.isOnline) {
      throw new Error("BongaCams \u623F\u95F4 " + roomId + " \u672A\u5F00\u64AD");
    }
    if (body.performerData.showType && body.performerData.showType !== "public") {
      throw new Error("BongaCams " + roomId + " \u5F53\u524D\u4E3A " + body.performerData.showType + "\uFF08\u975E\u516C\u5F00\uFF09");
    }
    let videoHost = body.localData?.videoServerUrl ?? "";
    if (videoHost.startsWith("//")) videoHost = "https:" + videoHost;
    if (!videoHost) throw new Error("BongaCams \u672A\u8FD4\u56DE videoServerUrl");
    const url = videoHost.replace(/\/$/, "") + "/hls/stream_" + encodeURIComponent(roomId) + "/playlist.m3u8";
    return ctx.protocols.hlsStream({
      url,
      qn: "auto",
      qnLabel: "\u81EA\u9002\u5E94",
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(bongacams_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
