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
  var manifest = {
    id: "cam4",
    label: "Cam4",
    version: "1.0.0",
    adult: true,
    engine: { netliveApi: 1 }
  };
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.cam4.com/";
  var ORIGIN = "https://www.cam4.com";
  var GRAPH_URL = "https://cam4.com/graph?operation=getGenderPreferencePageData&ssr=false";
  var COMMON_HEADERS = {
    "User-Agent": UA,
    Referer: REFERER,
    Origin: ORIGIN,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json"
  };
  var GRAPH_QUERY = `query getGenderPreferencePageData($input: BroadcastsInput, $keys: [String!]) {
  i18n {
    id
    values: translate(keys: $keys)
    __typename
  }
  user {
    id
    accessControl {
      id
      isLogged
      isGuest
      isGold
      isSFWMode
      __typename
    }
    isBroadcastApproved
    savedFilters {
      id
      name
      gender
      filters {
        id
        name
        category
        slug
        i18nKey
        i18nValue
        __typename
      }
      __typename
    }
    userModals {
      action
      count
      dateAdded
      modalType
      updatedAt
      __typename
    }
    __typename
  }
  appData {
    id
    banner {
      id
      isVisible
      title
      titleColor
      body
      bodyColor
      backgroundURL
      actionURL
      __typename
    }
    __typename
  }
  broadcasts(input: $input) {
    total
    items {
      ... on BroadcastItem {
        id
        username
        country
        sexualOrientation
        profileImageURL
        preview {
          sourceType
          src
          poster
          orientation
          __typename
        }
        viewers
        verified
        broadcastType
        showType
        hasNewBroadcasterBadge
        hasLiveTouchBadge
        hasBoostBadge
        hasDailyAwardBadge
        hasViewerCountBadge
        realCountry
        gender
        tags {
          name
          slug
          i18nKey
          i18nValue
          __typename
        }
        __typename
      }
      __typename
    }
    order {
      name
      i18nKey
      i18nValue
      value
      __typename
    }
    filterCategories {
      id
      name
      i18nKey
      i18nValue
      __typename
    }
    filters {
      id
      category
      i18nValue
      name
      slug
      __typename
    }
    tags {
      name
      slug
      i18nValue
      __typename
    }
    __typename
  }
}`;
  var GRAPH_KEYS = [
    "directory.tab.female",
    "profile.profile.gender.female",
    "metatags.metatags.female.h1",
    "directory.h1.title.female.top"
  ];
  async function fetchGraph(ctx, gender, offset, first) {
    const body = {
      operationName: "getGenderPreferencePageData",
      variables: {
        input: {
          orderBy: "trending",
          filters: [],
          gender,
          cursor: { first, offset }
        },
        keys: GRAPH_KEYS
      },
      query: GRAPH_QUERY
    };
    const res = await ctx.fetch(GRAPH_URL, {
      method: "POST",
      headers: COMMON_HEADERS,
      body: JSON.stringify(body),
      timeout: 25e3,
      http2: true
    });
    if (!res.ok) throw new Error("Cam4 graph HTTP " + res.status);
    const text = await res.text();
    if (!text.trim()) throw new Error("Cam4 graph empty body");
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error("Cam4 graph JSON parse failed: " + e.message + " - " + text.slice(0, 200));
    }
    if (json.errors?.length) {
      throw new Error("Cam4 graph errors: " + json.errors.map((e) => e.message).join(","));
    }
    return {
      items: json.data?.broadcasts?.items ?? [],
      total: json.data?.broadcasts?.total ?? 0
    };
  }
  function mapRoom(x) {
    const slug = x.username;
    if (!slug) return void 0;
    return {
      platform: "cam4",
      roomId: slug,
      title: x.tags?.map((t) => t.i18nValue || t.name).filter(Boolean).slice(0, 3).join(", ") || slug,
      uname: slug,
      avatar: x.profileImageURL,
      cover: x.preview?.poster || x.profileImageURL,
      online: x.viewers ?? 0,
      category: x.broadcastType || x.gender,
      live: x.showType === "PUBLIC_SHOW",
      link: "https://www.cam4.com/" + encodeURIComponent(slug)
    };
  }
  var cache = /* @__PURE__ */ new Map();
  var CACHE_TTL_MS = 6e4;
  function cacheKey(gender, offset) {
    return gender + "@" + offset;
  }
  async function fetchPage(ctx, gender, offset, first) {
    const key = cacheKey(gender, offset);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.at < CACHE_TTL_MS) {
      return { items: cached.items, total: -1 };
    }
    const res = await fetchGraph(ctx, gender, offset, first);
    cache.set(key, { at: now, items: res.items });
    return res;
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const p = Math.max(1, page);
    const ps = Math.max(1, Math.min(pageSize, 60));
    const offset = (p - 1) * ps;
    const { items, total } = await fetchPage(ctx, "female", offset, ps);
    const list = items.map(mapRoom).filter((r) => !!r);
    const realTotal = total > 0 ? total : offset + list.length + (list.length === ps ? 1 : 0);
    return { list, hasMore: offset + list.length < realTotal };
  }
  var PRESET_CATEGORIES = [
    { id: "female", name: "Female" },
    { id: "male", name: "Male" },
    { id: "male_female", name: "Couple" },
    { id: "trans", name: "Trans" }
  ];
  async function getCategories(ctx) {
    return PRESET_CATEGORIES;
  }
  function categoryToGender(categoryId) {
    switch (categoryId) {
      case "male":
        return "male";
      case "male_female":
      case "couple":
        return "male_female";
      case "trans":
        return "trans";
      default:
        return "female";
    }
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const gender = categoryToGender(categoryId);
    const pageSize = 60;
    const p = Math.max(1, page);
    const offset = (p - 1) * pageSize;
    const { items, total } = await fetchPage(ctx, gender, offset, pageSize);
    const list = items.map(mapRoom).filter((r) => !!r);
    const realTotal = total > 0 ? total : offset + list.length + (list.length === pageSize ? 1 : 0);
    return { list, hasMore: offset + list.length < realTotal };
  }
  async function search(ctx, { keyword, page }) {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return { list: [], hasMore: false };
    const [f, m] = await Promise.all([
      fetchPage(ctx, "female", 0, 60),
      fetchPage(ctx, "male", 0, 60)
    ]);
    const all = [...f.items, ...m.items];
    const matched = all.filter((x) => {
      if (x.username?.toLowerCase().includes(kw)) return true;
      return x.tags?.some(
        (t) => (t.slug || t.name || "").toLowerCase().includes(kw)
      ) ?? false;
    });
    const pageSize = 20;
    const start = (Math.max(1, page) - 1) * pageSize;
    const slice = matched.slice(start, start + pageSize);
    return {
      list: slice.map(mapRoom).filter((r) => !!r),
      hasMore: start + pageSize < matched.length
    };
  }
  function findInCache(slug) {
    const lower = slug.toLowerCase();
    for (const e of cache.values()) {
      const hit = e.items.find((x) => x.username?.toLowerCase() === lower);
      if (hit) return hit;
    }
    return void 0;
  }
  async function getRoomDetail(ctx, { roomId }) {
    const hit = findInCache(roomId);
    if (hit) {
      const room = mapRoom(hit);
      if (room) return room;
    }
    try {
      const { items } = await fetchPage(ctx, "female", 0, 60);
      const found = items.find((x) => x.username?.toLowerCase() === roomId.toLowerCase());
      if (found) {
        const room = mapRoom(found);
        if (room) return room;
      }
    } catch {
    }
    return {
      platform: "cam4",
      roomId,
      title: roomId,
      uname: roomId,
      live: await getLiveStatus(ctx, { roomId }),
      link: "https://www.cam4.com/" + encodeURIComponent(roomId)
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    if (findInCache(roomId)) return true;
    try {
      const info = await ctx.fetch(
        "https://hu.cam4.com/rest/v1.0/profile/" + encodeURIComponent(roomId) + "/info",
        {
          method: "GET",
          headers: COMMON_HEADERS,
          timeout: 15e3,
          http2: true
        }
      );
      if (!info.ok) return false;
      const data = await info.json() ?? {};
      return data.online === true;
    } catch {
      return false;
    }
  }
  async function resolve(ctx, { roomId }) {
    const hit = findInCache(roomId);
    if (hit?.preview?.src) {
      if (hit.showType && hit.showType !== "PUBLIC_SHOW") {
        throw new Error("Cam4 broadcaster " + roomId + " is " + hit.showType + " (non-public)");
      }
      return ctx.protocols.hlsStream({
        url: hit.preview.src,
        qn: "auto",
        qnLabel: "Auto",
        referer: REFERER,
        ua: UA
      });
    }
    for (const g of ["female", "male", "male_female", "trans"]) {
      try {
        const { items } = await fetchPage(ctx, g, 0, 60);
        const found = items.find((x) => x.username?.toLowerCase() === roomId.toLowerCase());
        if (found?.preview?.src) {
          return ctx.protocols.hlsStream({
            url: found.preview.src,
            qn: "auto",
            qnLabel: "Auto",
            referer: REFERER,
            ua: UA
          });
        }
      } catch {
      }
    }
    const info = await ctx.fetch(
      "https://hu.cam4.com/rest/v1.0/profile/" + encodeURIComponent(roomId) + "/info",
      { method: "GET", headers: COMMON_HEADERS, timeout: 15e3, http2: true }
    );
    if (info.status === 403) throw new Error("Cam4 broadcaster " + roomId + " geo-restricted");
    if (!info.ok) throw new Error("Cam4 info HTTP " + info.status);
    const infoData = await info.json() ?? {};
    if (!infoData.online) throw new Error("Cam4 broadcaster " + roomId + " offline");
    const stream = await ctx.fetch(
      "https://hu.cam4.com/rest/v1.0/profile/" + encodeURIComponent(roomId) + "/streamInfo",
      { method: "GET", headers: COMMON_HEADERS, timeout: 2e4, http2: true }
    );
    if (stream.status === 204) throw new Error("Cam4 broadcaster " + roomId + " offline");
    if (!stream.ok) throw new Error("Cam4 streamInfo HTTP " + stream.status);
    const sd = await stream.json() ?? {};
    if (!sd.cdnURL) throw new Error("Cam4 no cdnURL");
    return ctx.protocols.hlsStream({
      url: sd.cdnURL,
      qn: "auto",
      qnLabel: "Auto",
      referer: REFERER,
      ua: UA
    });
  }
  return __toCommonJS(cam4_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
