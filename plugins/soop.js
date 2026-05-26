/**
 * SOOP (formerly AfreecaTV) 直播插件 —— 韩国 BJ 平台
 * 协议: HLS (stream assign + aid token)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const LIST_REFERER = "https://www.sooplive.co.kr/";
const PLAYER_REFERER = "https://play.sooplive.com/";
const PLAYER_ORIGIN = "https://play.sooplive.com";

const LIST_HEADERS = {
  "User-Agent": UA,
  Referer: LIST_REFERER,
  Accept: "application/json, text/plain, */*",
};

const PLAYER_HEADERS = {
  "User-Agent": UA,
  Referer: PLAYER_REFERER,
  Origin: PLAYER_ORIGIN,
  Accept: "application/json, text/plain, */*",
};

const CDN_MAP = { gs_cdn: "gs_cdn_pc_web", lg_cdn: "lg_cdn_pc_web" };

export const manifest = {
  id: "soop",
  label: "SOOP (韩国 BJ)",
  version: "1.0.0",
  adult: true,
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

function mapRoom(r) {
  if (!r.user_id) return undefined;
  return {
    platform: "soop",
    roomId: `${r.user_id}:${r.broad_no}`,
    title: r.broad_title || r.user_nick || r.user_id,
    uname: r.user_nick || r.user_id,
    cover: r.broad_thumb,
    online: r.current_view_cnt ?? 0,
    category: r.category_name,
    live: true,
    link: `https://play.sooplive.com/${r.user_id}/${r.broad_no}`,
  };
}

async function postPlayer(ctx, body) {
  const form = Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const res = await ctx.fetch("https://live.sooplive.com/afreeca/player_live_api.php", {
    method: "POST",
    headers: { ...PLAYER_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    timeout: 25000,
  });
  if (!res.ok) throw new Error(`SOOP player HTTP ${res.status}`);
  return res.json();
}

export async function getRecommend(ctx, { page, pageSize }) {
  const res = await ctx.fetch(
    `https://live.afreecatv.com/api/main_broad_list_api.php?selectType=action&pageNo=${page}&lang=ko_KR&pageType=home`,
    { headers: LIST_HEADERS, timeout: 25000 }
  );
  if (!res.ok) throw new Error(`SOOP HTTP ${res.status}`);
  const data = await res.json();
  const broads = data.broad || [];
  return { list: broads.map(mapRoom).filter(Boolean), hasMore: broads.length >= 20 };
}

export async function search(ctx, { keyword, page }) {
  const res = await ctx.fetch(
    `https://live.afreecatv.com/api/main_broad_list_api.php?selectType=action&pageNo=1&lang=ko_KR&pageType=home`,
    { headers: LIST_HEADERS, timeout: 25000 }
  );
  if (!res.ok) return { list: [], hasMore: false };
  const data = await res.json();
  const broads = data.broad || [];
  const kw = keyword.toLowerCase();
  const filtered = broads
    .filter((r) => (r.user_nick || "").toLowerCase().includes(kw) || (r.broad_title || "").toLowerCase().includes(kw) || (r.user_id || "").toLowerCase().includes(kw))
    .map(mapRoom)
    .filter(Boolean);
  return { list: filtered, hasMore: false };
}

export async function getCategories(ctx) {
  return [
    { id: "action", name: "热门" },
    { id: "new", name: "新人" },
    { id: "adult19", name: "19+" },
    { id: "dance", name: "댄스" },
    { id: "uniform", name: "制服" },
  ];
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const res = await ctx.fetch(
    `https://live.afreecatv.com/api/main_broad_list_api.php?selectType=${encodeURIComponent(categoryId)}&pageNo=${page}&lang=ko_KR&pageType=home`,
    { headers: LIST_HEADERS, timeout: 25000 }
  );
  if (!res.ok) throw new Error(`SOOP HTTP ${res.status}`);
  const data = await res.json();
  const broads = data.broad || [];
  return { list: broads.map(mapRoom).filter(Boolean), hasMore: broads.length >= 20 };
}

export async function getRoomDetail(ctx, { roomId }) {
  const [userId, broadNo] = roomId.split(":");
  const data = await postPlayer(ctx, {
    bid: userId,
    bno: broadNo || "0",
    type: "live",
    pwd: "",
    from_api: "0",
    mode: "landing",
    player_type: "html5",
    stream_type: "common",
  });
  const ch = data.CHANNEL;
  if (!ch || ch.RESULT === 0) throw new Error(`SOOP 房间 ${roomId} 未找到`);
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
    link: `https://play.sooplive.com/${userId}/${broadNo}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
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
      stream_type: "common",
    });
    return data.CHANNEL?.RESULT !== 0;
  } catch {
    return false;
  }
}

export async function resolve(ctx, { roomId }) {
  const [userId, broadNo] = roomId.split(":");

  // Step 1: Get channel info (RMD, CDN, BNO, VIEWPRESET)
  const data = await postPlayer(ctx, {
    bid: userId,
    bno: broadNo || "0",
    type: "live",
    pwd: "",
    from_api: "0",
    mode: "landing",
    player_type: "html5",
    stream_type: "common",
  });
  const ch = data.CHANNEL;
  if (!ch || ch.RESULT === 0) throw new Error(`SOOP 主播 ${userId} 未在直播`);

  const rmd = ch.RMD;
  const cdn = ch.CDN;
  const bno = ch.BNO || broadNo;
  const presets = ch.VIEWPRESET || [];

  // Pick best quality
  const qn = presets.length > 0 ? presets[0].name : "original";
  const qnLabel = presets.length > 0 ? presets[0].label : "原画";

  // Step 2: Get AID token
  const aidData = await postPlayer(ctx, {
    bid: userId,
    bno: bno,
    type: "aid",
    pwd: "",
    from_api: "0",
    mode: "landing",
    player_type: "html5",
    stream_type: "common",
    quality: qn,
  });
  const aid = aidData.CHANNEL?.AID;
  if (!aid) throw new Error("SOOP 获取 AID 失败");

  // Step 3: Stream assign
  const cdnMapped = CDN_MAP[cdn] || cdn || "gs_cdn_pc_web";
  const assignUrl = `${rmd}/broad_stream_assign.html?return_type=${cdnMapped}&broad_key=${bno}-common-${qn}-hls`;
  const assignRes = await ctx.fetch(assignUrl, { headers: PLAYER_HEADERS, timeout: 20000 });
  if (!assignRes.ok) throw new Error(`SOOP stream assign HTTP ${assignRes.status}`);
  const assignData = await assignRes.json();
  const viewUrl = assignData.view_url;
  if (!viewUrl) throw new Error("SOOP stream assign 未返回 view_url");

  // Step 4: Final URL
  const finalUrl = `${viewUrl}?aid=${aid}`;

  // Build alternatives
  const alternatives = [];
  for (const preset of presets) {
    alternatives.push({
      qn: preset.name,
      label: preset.label || preset.name,
      url: finalUrl.replace(`-${qn}-hls`, `-${preset.name}-hls`),
    });
  }

  return ctx.protocols.hlsStream({
    url: finalUrl,
    qn,
    qnLabel,
    alternatives: alternatives.length > 1 ? alternatives : undefined,
    referer: PLAYER_REFERER,
    ua: UA,
  });
}
