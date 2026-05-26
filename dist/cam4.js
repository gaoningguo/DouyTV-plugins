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

  // plugins/cam4.js
  var cam4_exports = {};
  __export(cam4_exports, {
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
  var REFERER = "https://www.cam4.com/";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://www.cam4.com", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "Content-Type": "application/json" };
  var GRAPH_URL = "https://www.cam4.com/graph?operation=getGenderPreferencePageData&ssr=false";
  var cache = /* @__PURE__ */ new Map();
  var TTL = 6e4;
  var manifest = {
    id: "cam4",
    label: "Cam4",
    version: "1.0.0",
    adult: true,
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  var QUERY = `query getGenderPreferencePageData($input:BroadcastsInput,$keys:[String!]){broadcasts(input:$input){total items{...on BroadcastItem{id username country profileImageURL preview{src poster sourceType orientation __typename} viewers broadcastType showType realCountry gender tags{name slug i18nValue __typename} __typename}__typename}__typename}}`;
  async function fetchGraph(ctx, gender, offset, first) {
    const body = {
      operationName: "getGenderPreferencePageData",
      variables: { input: { orderBy: "trending", filters: [], gender, cursor: { first, offset } }, keys: ["directory.tab.female"] },
      query: QUERY
    };
    const res = await ctx.fetch(GRAPH_URL, { method: "POST", headers: HEADERS, body: JSON.stringify(body), timeout: 25e3 });
    if (!res.ok) throw new Error(`Cam4 HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(`Cam4: ${json.errors.map((e) => e.message).join(",")}`);
    return { items: json.data?.broadcasts?.items ?? [], total: json.data?.broadcasts?.total ?? 0 };
  }
  async function fetchPage(ctx, gender, offset, first) {
    const key = `${gender}@${offset}`;
    const c = cache.get(key);
    if (c && Date.now() - c.at < TTL) return { items: c.items, total: -1 };
    const r = await fetchGraph(ctx, gender, offset, first);
    cache.set(key, { at: Date.now(), items: r.items });
    return r;
  }
  function mapRoom(x) {
    if (!x.username) return void 0;
    return {
      platform: "cam4",
      roomId: x.username,
      title: x.tags?.map((t) => t.i18nValue || t.name).filter(Boolean).slice(0, 3).join(", ") || x.username,
      uname: x.username,
      avatar: x.profileImageURL,
      cover: x.preview?.poster || x.profileImageURL,
      online: x.viewers ?? 0,
      category: x.broadcastType || x.gender,
      live: x.showType === "PUBLIC_SHOW",
      link: `https://www.cam4.com/${encodeURIComponent(x.username)}`
    };
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const ps = Math.max(1, Math.min(pageSize, 60));
    const offset = (page - 1) * ps;
    const { items, total } = await fetchPage(ctx, "female", offset, ps);
    const list = items.map(mapRoom).filter(Boolean);
    const realTotal = total > 0 ? total : offset + list.length + (list.length === ps ? 1 : 0);
    return { list, hasMore: offset + list.length < realTotal };
  }
  async function getCategories(ctx) {
    return [
      { id: "female", name: "\u5973\u6027" },
      { id: "male", name: "\u7537\u6027" },
      { id: "male_female", name: "\u60C5\u4FA3/\u7EC4\u5408" },
      { id: "trans", name: "TS" }
    ];
  }
  function toGender(c) {
    if (c === "male") return "male";
    if (c === "male_female" || c === "couple") return "male_female";
    if (c === "trans") return "trans";
    return "female";
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const gender = toGender(categoryId);
    const ps = 60;
    const offset = (page - 1) * ps;
    const { items, total } = await fetchPage(ctx, gender, offset, ps);
    const list = items.map(mapRoom).filter(Boolean);
    const realTotal = total > 0 ? total : offset + list.length + (list.length === ps ? 1 : 0);
    return { list, hasMore: offset + list.length < realTotal };
  }
  async function search(ctx, { keyword, page }) {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return { list: [], hasMore: false };
    const [f, m] = await Promise.all([fetchPage(ctx, "female", 0, 60), fetchPage(ctx, "male", 0, 60)]);
    const all = [...f.items, ...m.items];
    const matched = all.filter(
      (x) => x.username?.toLowerCase().includes(kw) || x.tags?.some((t) => (t.slug || t.name || "").toLowerCase().includes(kw))
    );
    const ps = 20;
    const start = (page - 1) * ps;
    return { list: matched.slice(start, start + ps).map(mapRoom).filter(Boolean), hasMore: start + ps < matched.length };
  }
  function findInCache(slug) {
    const lower = slug.toLowerCase();
    for (const e of cache.values()) {
      const hit = e.items.find((x) => x.username?.toLowerCase() === lower);
      if (hit) return hit;
    }
    return void 0;
  }
  async function resolve(ctx, { roomId }) {
    const hit = findInCache(roomId);
    if (hit?.preview?.src) {
      if (hit.showType && hit.showType !== "PUBLIC_SHOW") throw new Error(`Cam4 ${roomId} ${hit.showType}`);
      return ctx.protocols.hlsStream({ url: hit.preview.src, referer: REFERER, ua: UA });
    }
    for (const g of ["female", "male", "male_female", "trans"]) {
      try {
        const { items } = await fetchPage(ctx, g, 0, 60);
        const found = items.find((x) => x.username?.toLowerCase() === roomId.toLowerCase());
        if (found?.preview?.src) return ctx.protocols.hlsStream({ url: found.preview.src, referer: REFERER, ua: UA });
      } catch {
      }
    }
    const info = await ctx.fetch(`https://hu.cam4.com/rest/v1.0/profile/${encodeURIComponent(roomId)}/info`, { headers: HEADERS, timeout: 15e3 });
    if (!info.ok) throw new Error(`Cam4 ${roomId} \u4E0D\u5728\u7EBF`);
    const stream = await ctx.fetch(`https://hu.cam4.com/rest/v1.0/profile/${encodeURIComponent(roomId)}/streamInfo`, { headers: HEADERS, timeout: 2e4 });
    if (!stream.ok) throw new Error(`Cam4 streamInfo HTTP ${stream.status}`);
    const sd = await stream.json();
    if (!sd.cdnURL) throw new Error("Cam4 \u672A\u8FD4\u56DE cdnURL");
    return ctx.protocols.hlsStream({ url: sd.cdnURL, referer: REFERER, ua: UA });
  }
  async function getRoomDetail(ctx, { roomId }) {
    const hit = findInCache(roomId);
    if (hit) {
      const r = mapRoom(hit);
      if (r) return r;
    }
    return { platform: "cam4", roomId, title: roomId, uname: roomId, live: false, link: `https://www.cam4.com/${encodeURIComponent(roomId)}` };
  }
  async function getLiveStatus(ctx, { roomId }) {
    if (findInCache(roomId)) return true;
    try {
      const info = await ctx.fetch(`https://hu.cam4.com/rest/v1.0/profile/${encodeURIComponent(roomId)}/info`, { headers: HEADERS, timeout: 15e3 });
      if (!info.ok) return false;
      const data = await info.json();
      return data.online === true;
    } catch {
      return false;
    }
  }
  return __toCommonJS(cam4_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
