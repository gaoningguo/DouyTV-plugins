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

  // plugins/twitch.js
  var twitch_exports = {};
  __export(twitch_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });
  var GQL_URL = "https://gql.twitch.tv/gql";
  var CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var REFERER = "https://www.twitch.tv/";
  var HEADERS = { "User-Agent": UA, "Client-ID": CLIENT_ID, Referer: REFERER, "Content-Type": "application/json" };
  var cursorCache = /* @__PURE__ */ new Map();
  var manifest = {
    id: "twitch",
    label: "Twitch",
    version: "1.0.0",
    defaultProxy: "proxy",
    engine: { netliveApi: 1 }
  };
  async function gql(ctx, query, variables) {
    const res = await ctx.fetch(GQL_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ query, variables }),
      timeout: 2e4,
      http2: true
    });
    if (!res.ok) throw new Error(`Twitch HTTP ${res.status}`);
    const body = await res.json();
    if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
    return body.data;
  }
  function mapStream(s) {
    if (!s?.broadcaster) return void 0;
    const login = s.broadcaster.login;
    return {
      platform: "twitch",
      roomId: login,
      title: s.title || "",
      uname: s.broadcaster.displayName,
      cover: s.previewImageURL || void 0,
      avatar: s.broadcaster.profileImageURL || void 0,
      online: s.viewersCount || 0,
      category: s.game?.displayName || s.game?.name,
      live: true,
      link: `https://www.twitch.tv/${login}`
    };
  }
  var Q_TOP = `query($first:Int!,$after:Cursor){streams(first:$first,after:$after){edges{cursor node{id title viewersCount type previewImageURL(width:320,height:180) broadcaster{id login displayName profileImageURL(width:50)} game{id name displayName}}}pageInfo{hasNextPage}}}`;
  async function getRecommend(ctx, { page, pageSize }) {
    const after = page > 1 ? cursorCache.get(`home:${page - 1}`) ?? null : null;
    const data = await gql(ctx, Q_TOP, { first: Math.max(pageSize, 30), after });
    const edges = data.streams?.edges ?? [];
    if (edges.length > 0) cursorCache.set(`home:${page}`, edges[edges.length - 1].cursor);
    const list = edges.map((e) => mapStream(e.node)).filter(Boolean);
    return { list, hasMore: !!data.streams?.pageInfo.hasNextPage };
  }
  var Q_GAMES = `query($first:Int!){games(first:$first){edges{node{id name displayName boxArtURL(width:144,height:192)}}}}`;
  async function getCategories(ctx) {
    const data = await gql(ctx, Q_GAMES, { first: 50 });
    return (data.games?.edges ?? []).map((e) => ({
      id: e.node.id,
      name: e.node.displayName || e.node.name,
      cover: e.node.boxArtURL
    }));
  }
  var Q_GAME_STREAMS = `query($id:ID!,$first:Int!,$after:Cursor){game(id:$id){streams(first:$first,after:$after){edges{cursor node{id title viewersCount type previewImageURL(width:320,height:180) broadcaster{id login displayName profileImageURL(width:50)} game{id name displayName}}}pageInfo{hasNextPage}}}}`;
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const after = page > 1 ? cursorCache.get(`g:${categoryId}:${page - 1}`) ?? null : null;
    const data = await gql(ctx, Q_GAME_STREAMS, { id: categoryId, first: 30, after });
    const edges = data.game?.streams?.edges ?? [];
    if (edges.length > 0) cursorCache.set(`g:${categoryId}:${page}`, edges[edges.length - 1].cursor);
    const list = edges.map((e) => mapStream(e.node)).filter(Boolean);
    return { list, hasMore: !!data.game?.streams?.pageInfo.hasNextPage };
  }
  var Q_SEARCH = `query($q:String!){searchFor(userQuery:$q,platform:"web",target:{index:CHANNEL}){channels{items{id login displayName profileImageURL(width:50) stream{id title viewersCount type previewImageURL(width:320,height:180) game{id name displayName}}}}}}`;
  async function search(ctx, { keyword }) {
    const data = await gql(ctx, Q_SEARCH, { q: keyword });
    const items = data.searchFor?.channels?.items ?? [];
    const list = items.map((it) => ({
      platform: "twitch",
      roomId: it.login,
      title: it.stream?.title || it.displayName,
      uname: it.displayName,
      cover: it.stream?.previewImageURL,
      avatar: it.profileImageURL,
      online: it.stream?.viewersCount ?? 0,
      category: it.stream?.game?.displayName || it.stream?.game?.name,
      live: !!it.stream,
      link: `https://www.twitch.tv/${it.login}`
    }));
    return { list, hasMore: false };
  }
  var Q_USER = `query($login:String!){user(login:$login){id login displayName description profileImageURL(width:70) stream{id title viewersCount type previewImageURL(width:1280,height:720) game{id name displayName}}}}`;
  async function getRoomDetail(ctx, { roomId }) {
    const data = await gql(ctx, Q_USER, { login: roomId.toLowerCase() });
    const u = data.user;
    if (!u) throw new Error(`Twitch ${roomId} \u672A\u627E\u5230`);
    return {
      platform: "twitch",
      roomId: u.login,
      title: u.stream?.title || u.displayName,
      uname: u.displayName,
      avatar: u.profileImageURL,
      cover: u.stream?.previewImageURL,
      online: u.stream?.viewersCount ?? 0,
      category: u.stream?.game?.displayName || u.stream?.game?.name,
      introduction: u.description,
      live: !!u.stream,
      link: `https://www.twitch.tv/${u.login}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const data = await gql(ctx, `query($login:String!){user(login:$login){stream{id}}}`, { login: roomId.toLowerCase() });
      return !!data.user?.stream?.id;
    } catch {
      return false;
    }
  }
  var Q_TOKEN = `query($login:String!){streamPlaybackAccessToken(channelName:$login,params:{platform:"web",playerBackend:"mediaplayer",playerType:"site"}){value signature}}`;
  async function resolve(ctx, { roomId }) {
    const login = roomId.toLowerCase();
    const tk = await gql(ctx, Q_TOKEN, { login });
    const t = tk.streamPlaybackAccessToken;
    if (!t) throw new Error(`Twitch \u672A\u8FD4\u56DE ${login} playback token`);
    const p = Math.floor(1e6 + Math.random() * 9e6);
    const url = new URL(`https://usher.ttvnw.net/api/channel/hls/${login}.m3u8`);
    url.searchParams.set("sig", t.signature);
    url.searchParams.set("token", t.value);
    url.searchParams.set("player", "twitchweb");
    url.searchParams.set("supported_codecs", "avc1");
    url.searchParams.set("fast_bread", "true");
    url.searchParams.set("allow_source", "true");
    url.searchParams.set("p", String(p));
    url.searchParams.set("playlist_include_framerate", "true");
    url.searchParams.set("type", "any");
    url.searchParams.set("cdm", "wv");
    return ctx.protocols.hlsStream({ url: url.toString(), referer: REFERER, ua: UA });
  }
  return __toCommonJS(twitch_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
