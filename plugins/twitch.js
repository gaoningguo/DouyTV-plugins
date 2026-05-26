/**
 * Twitch 直播插件 —— 走匿名 GraphQL (gql.twitch.tv/gql)
 * 协议: HLS (master m3u8 + ABR variants)
 */
const GQL_URL = "https://gql.twitch.tv/gql";
const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.twitch.tv/";
const HEADERS = { "User-Agent": UA, "Client-ID": CLIENT_ID, Referer: REFERER, "Content-Type": "application/json" };

const cursorCache = new Map();

export const manifest = {
  id: "twitch",
  label: "Twitch",
  version: "1.0.0",
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

async function gql(ctx, query, variables) {
  const res = await ctx.fetch(GQL_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
    timeout: 20000,
    http2: true,
  });
  if (!res.ok) throw new Error(`Twitch HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data;
}

function mapStream(s) {
  if (!s?.broadcaster) return undefined;
  const login = s.broadcaster.login;
  return {
    platform: "twitch",
    roomId: login,
    title: s.title || "",
    uname: s.broadcaster.displayName,
    cover: s.previewImageURL || undefined,
    avatar: s.broadcaster.profileImageURL || undefined,
    online: s.viewersCount || 0,
    category: s.game?.displayName || s.game?.name,
    live: true,
    link: `https://www.twitch.tv/${login}`,
  };
}

const Q_TOP = `query($first:Int!,$after:Cursor){streams(first:$first,after:$after){edges{cursor node{id title viewersCount type previewImageURL(width:320,height:180) broadcaster{id login displayName profileImageURL(width:50)} game{id name displayName}}}pageInfo{hasNextPage}}}`;

export async function getRecommend(ctx, { page, pageSize }) {
  const after = page > 1 ? cursorCache.get(`home:${page - 1}`) ?? null : null;
  const data = await gql(ctx, Q_TOP, { first: Math.max(pageSize, 30), after });
  const edges = data.streams?.edges ?? [];
  if (edges.length > 0) cursorCache.set(`home:${page}`, edges[edges.length - 1].cursor);
  const list = edges.map((e) => mapStream(e.node)).filter(Boolean);
  return { list, hasMore: !!data.streams?.pageInfo.hasNextPage };
}

const Q_GAMES = `query($first:Int!){games(first:$first){edges{node{id name displayName boxArtURL(width:144,height:192)}}}}`;

export async function getCategories(ctx) {
  const data = await gql(ctx, Q_GAMES, { first: 50 });
  return (data.games?.edges ?? []).map((e) => ({
    id: e.node.id,
    name: e.node.displayName || e.node.name,
    cover: e.node.boxArtURL,
  }));
}

const Q_GAME_STREAMS = `query($id:ID!,$first:Int!,$after:Cursor){game(id:$id){streams(first:$first,after:$after){edges{cursor node{id title viewersCount type previewImageURL(width:320,height:180) broadcaster{id login displayName profileImageURL(width:50)} game{id name displayName}}}pageInfo{hasNextPage}}}}`;

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const after = page > 1 ? cursorCache.get(`g:${categoryId}:${page - 1}`) ?? null : null;
  const data = await gql(ctx, Q_GAME_STREAMS, { id: categoryId, first: 30, after });
  const edges = data.game?.streams?.edges ?? [];
  if (edges.length > 0) cursorCache.set(`g:${categoryId}:${page}`, edges[edges.length - 1].cursor);
  const list = edges.map((e) => mapStream(e.node)).filter(Boolean);
  return { list, hasMore: !!data.game?.streams?.pageInfo.hasNextPage };
}

const Q_SEARCH = `query($q:String!){searchFor(userQuery:$q,platform:"web",target:{index:CHANNEL}){channels{items{id login displayName profileImageURL(width:50) stream{id title viewersCount type previewImageURL(width:320,height:180) game{id name displayName}}}}}}`;

export async function search(ctx, { keyword }) {
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
    link: `https://www.twitch.tv/${it.login}`,
  }));
  return { list, hasMore: false };
}

const Q_USER = `query($login:String!){user(login:$login){id login displayName description profileImageURL(width:70) stream{id title viewersCount type previewImageURL(width:1280,height:720) game{id name displayName}}}}`;

export async function getRoomDetail(ctx, { roomId }) {
  const data = await gql(ctx, Q_USER, { login: roomId.toLowerCase() });
  const u = data.user;
  if (!u) throw new Error(`Twitch ${roomId} 未找到`);
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
    link: `https://www.twitch.tv/${u.login}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const data = await gql(ctx, `query($login:String!){user(login:$login){stream{id}}}`, { login: roomId.toLowerCase() });
    return !!data.user?.stream?.id;
  } catch { return false; }
}

const Q_TOKEN = `query($login:String!){streamPlaybackAccessToken(channelName:$login,params:{platform:"web",playerBackend:"mediaplayer",playerType:"site"}){value signature}}`;

export async function resolve(ctx, { roomId }) {
  const login = roomId.toLowerCase();
  const tk = await gql(ctx, Q_TOKEN, { login });
  const t = tk.streamPlaybackAccessToken;
  if (!t) throw new Error(`Twitch 未返回 ${login} playback token`);
  const p = Math.floor(1_000_000 + Math.random() * 9_000_000);
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
