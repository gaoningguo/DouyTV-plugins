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

  // plugins/soop.js
  var soop_exports = {};
  __export(soop_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var LIST_REFERER = "https://www.sooplive.co.kr/";
  var PLAYER_REFERER = "https://play.sooplive.com/";
  var PLAYER_ORIGIN = "https://play.sooplive.com";
  var LIST_HEADERS = {
    "User-Agent": UA,
    Referer: LIST_REFERER,
    Accept: "application/json, text/plain, */*"
  };
  var PLAYER_HEADERS = {
    "User-Agent": UA,
    Referer: PLAYER_REFERER,
    Origin: PLAYER_ORIGIN,
    Accept: "application/json, text/plain, */*"
  };
  var CDN_MAP = { gs_cdn: "gs_cdn_pc_web", lg_cdn: "lg_cdn_pc_web" };
  var manifest = {
    id: "soop",
    label: "SOOP (\u97E9\u56FD BJ)",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  function mapRoom(r) {
    if (!r.user_id) return void 0;
    return {
      platform: "soop",
      roomId: `${r.user_id}:${r.broad_no}`,
      title: r.broad_title || r.user_nick || r.user_id,
      uname: r.user_nick || r.user_id,
      cover: r.broad_thumb,
      online: r.current_view_cnt ?? 0,
      category: r.category_name,
      live: true,
      link: `https://play.sooplive.com/${r.user_id}/${r.broad_no}`
    };
  }
  async function postPlayer(ctx, body) {
    const form = Object.entries(body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    const res = await ctx.fetch("https://live.sooplive.com/afreeca/player_live_api.php", {
      method: "POST",
      headers: { ...PLAYER_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      timeout: 25e3
    });
    if (!res.ok) throw new Error(`SOOP player HTTP ${res.status}`);
    return res.json();
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const res = await ctx.fetch(
      `https://live.afreecatv.com/api/main_broad_list_api.php?selectType=action&pageNo=${page}&lang=ko_KR&pageType=home`,
      { headers: LIST_HEADERS, timeout: 25e3 }
    );
    if (!res.ok) throw new Error(`SOOP HTTP ${res.status}`);
    const data = await res.json();
    const broads = data.broad || [];
    return { list: broads.map(mapRoom).filter(Boolean), hasMore: broads.length >= 20 };
  }
  async function search(ctx, { keyword, page }) {
    const res = await ctx.fetch(
      `https://live.afreecatv.com/api/main_broad_list_api.php?selectType=action&pageNo=1&lang=ko_KR&pageType=home`,
      { headers: LIST_HEADERS, timeout: 25e3 }
    );
    if (!res.ok) return { list: [], hasMore: false };
    const data = await res.json();
    const broads = data.broad || [];
    const kw = keyword.toLowerCase();
    const filtered = broads.filter((r) => (r.user_nick || "").toLowerCase().includes(kw) || (r.broad_title || "").toLowerCase().includes(kw) || (r.user_id || "").toLowerCase().includes(kw)).map(mapRoom).filter(Boolean);
    return { list: filtered, hasMore: false };
  }
  async function getCategories(ctx) {
    return [
      { id: "action", name: "\u70ED\u95E8" },
      { id: "new", name: "\u65B0\u4EBA" },
      { id: "adult19", name: "19+" },
      { id: "dance", name: "\uB304\uC2A4" },
      { id: "uniform", name: "\u5236\u670D" }
    ];
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const res = await ctx.fetch(
      `https://live.afreecatv.com/api/main_broad_list_api.php?selectType=${encodeURIComponent(categoryId)}&pageNo=${page}&lang=ko_KR&pageType=home`,
      { headers: LIST_HEADERS, timeout: 25e3 }
    );
    if (!res.ok) throw new Error(`SOOP HTTP ${res.status}`);
    const data = await res.json();
    const broads = data.broad || [];
    return { list: broads.map(mapRoom).filter(Boolean), hasMore: broads.length >= 20 };
  }
  async function getRoomDetail(ctx, { roomId }) {
    const [userId, broadNo] = roomId.split(":");
    const data = await postPlayer(ctx, {
      bid: userId,
      bno: broadNo || "0",
      type: "live",
      pwd: "",
      from_api: "0",
      mode: "landing",
      player_type: "html5",
      stream_type: "common"
    });
    const ch = data.CHANNEL;
    if (!ch || ch.RESULT === 0) throw new Error(`SOOP \u623F\u95F4 ${roomId} \u672A\u627E\u5230`);
    const presets = ch.VIEWPRESET || [];
    return {
      platform: "soop",
      roomId,
      title: ch.TITLE || userId,
      uname: ch.BJNICK || userId,
      avatar: `https://profile.img.afreecatv.com/LOGO/${userId.substring(0, 2)}/${userId}/${userId}.jpg`,
      online: ch.VIEWCNT ?? 0,
      category: ch.CATE,
      live: ch.RESULT !== 0,
      link: `https://play.sooplive.com/${userId}/${broadNo}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const [userId, broadNo] = roomId.split(":");
      const data = await postPlayer(ctx, {
        bid: userId,
        bno: broadNo || "0",
        type: "live",
        pwd: "",
        from_api: "0",
        mode: "landing",
        player_type: "html5",
        stream_type: "common"
      });
      return data.CHANNEL?.RESULT !== 0;
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const [userId, broadNo] = roomId.split(":");
    const data = await postPlayer(ctx, {
      bid: userId,
      bno: broadNo || "0",
      type: "live",
      pwd: "",
      from_api: "0",
      mode: "landing",
      player_type: "html5",
      stream_type: "common"
    });
    const ch = data.CHANNEL;
    if (!ch || ch.RESULT === 0) throw new Error(`SOOP \u4E3B\u64AD ${userId} \u672A\u5728\u76F4\u64AD`);
    const rmd = ch.RMD;
    const cdn = ch.CDN;
    const bno = ch.BNO || broadNo;
    const presets = ch.VIEWPRESET || [];
    const qn = presets.length > 0 ? presets[0].name : "original";
    const qnLabel = presets.length > 0 ? presets[0].label : "\u539F\u753B";
    const aidData = await postPlayer(ctx, {
      bid: userId,
      bno,
      type: "aid",
      pwd: "",
      from_api: "0",
      mode: "landing",
      player_type: "html5",
      stream_type: "common",
      quality: qn
    });
    const aid = aidData.CHANNEL?.AID;
    if (!aid) throw new Error("SOOP \u83B7\u53D6 AID \u5931\u8D25");
    const cdnMapped = CDN_MAP[cdn] || cdn || "gs_cdn_pc_web";
    const assignUrl = `${rmd}/broad_stream_assign.html?return_type=${cdnMapped}&broad_key=${bno}-common-${qn}-hls`;
    const assignRes = await ctx.fetch(assignUrl, { headers: PLAYER_HEADERS, timeout: 2e4 });
    if (!assignRes.ok) throw new Error(`SOOP stream assign HTTP ${assignRes.status}`);
    const assignData = await assignRes.json();
    const viewUrl = assignData.view_url;
    if (!viewUrl) throw new Error("SOOP stream assign \u672A\u8FD4\u56DE view_url");
    const finalUrl = `${viewUrl}?aid=${aid}`;
    const alternatives = [];
    for (const preset of presets) {
      alternatives.push({
        qn: preset.name,
        label: preset.label || preset.name,
        url: finalUrl.replace(`-${qn}-hls`, `-${preset.name}-hls`)
      });
    }
    return ctx.protocols.hlsStream({
      url: finalUrl,
      qn,
      qnLabel,
      alternatives: alternatives.length > 1 ? alternatives : void 0,
      referer: PLAYER_REFERER,
      ua: UA
    });
  }
  return __toCommonJS(soop_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
