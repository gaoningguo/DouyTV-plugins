/**
 * DreamCam 直播插件 —— Nanocosmos 系 VR/2D 成人 cam
 * 协议: HLS (video2D)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://dreamcam.com/";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Origin: "https://dreamcam.com", Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };

export const manifest = {
  id: "dreamcam",
  label: "DreamCam",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

async function fetchList(ctx, offset, limit) {
  const qs = new URLSearchParams({
    partnerId: "dreamcam_oauth2",
    limit: String(limit),
    offset: String(offset),
    "show-offline": "false",
    "tag-categories": "girls",
    "stream-types": "video2D,video3D",
    "include-tags": "false",
    "include-tip-menu": "false",
    "include-favorites": "false",
  });
  const res = await ctx.fetch(`https://bss.dreamcamtrue.com/api/clients/v1/broadcasts?${qs.toString()}`, { headers: HEADERS, timeout: 30000, http2: true });
  if (!res.ok) throw new Error(`DreamCam HTTP ${res.status}`);
  return res.json();
}

function getHls(b) {
  const s = b.streams?.find((x) => x.streamType === "video2D");
  return s?.url?.startsWith("http") ? s.url : undefined;
}

function getThumb(b) {
  return b.thumbnailsUrl?.preview2D || b.thumbnailsUrl?.preview3D || b.modelProfilePhotoUrl;
}

function mapRoom(b) {
  if (!b.modelNickname) return undefined;
  return {
    platform: "dreamcam",
    roomId: b.modelNickname,
    title: b.broadcastTextStatus || b.modelNickname,
    uname: b.modelNickname,
    avatar: b.modelProfilePhotoUrl,
    cover: getThumb(b),
    online: b.broadcastMembersCount ?? 0,
    category: b.modelSex,
    live: (b.broadcastStatus ?? "").toLowerCase() === "public",
    link: `https://dreamcam.com/cams/${encodeURIComponent(b.modelNickname)}`,
  };
}

export async function getRecommend(ctx, { page, pageSize }) {
  const limit = Math.min(Math.max(pageSize, 24), 64);
  const offset = Math.max(page - 1, 0) * limit;
  const data = await fetchList(ctx, offset, limit);
  const arr = data.pageItems ?? [];
  const total = data.totalCount ?? 0;
  return { list: arr.map(mapRoom).filter(Boolean), hasMore: arr.length > 0 && offset + arr.length < total };
}

async function findBroadcast(ctx, nickname) {
  const LIMIT = 64;
  for (let p = 0; p < 3; p++) {
    const data = await fetchList(ctx, p * LIMIT, LIMIT);
    const arr = data.pageItems ?? [];
    const found = arr.find((b) => b.modelNickname?.toLowerCase() === nickname.toLowerCase());
    if (found) return found;
    if (arr.length < LIMIT) break;
  }
  return undefined;
}

export async function resolve(ctx, { roomId }) {
  const b = await findBroadcast(ctx, roomId);
  if (!b) throw new Error(`DreamCam 未找到 ${roomId}`);
  const status = (b.broadcastStatus ?? "").toLowerCase();
  if (status !== "public") throw new Error(`DreamCam ${roomId} 状态 ${status}`);
  const hls = getHls(b);
  if (!hls) throw new Error(`DreamCam ${roomId} 只有 VR 流`);
  return ctx.protocols.hlsStream({ url: hls, referer: REFERER, ua: UA });
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const b = await findBroadcast(ctx, roomId);
    return (b?.broadcastStatus ?? "").toLowerCase() === "public";
  } catch { return false; }
}
