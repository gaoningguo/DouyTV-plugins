/**
 * 虎牙直播插件 —— FLV 流 + buildAntiCode 签名
 */
import CryptoJS from "crypto-js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REFERER = "https://www.huya.com/";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "*/*" };

export const manifest = {
  id: "huya",
  label: "虎牙",
  version: "1.0.0",
  defaultProxy: "direct",
  engine: { netliveApi: 1 },
};

function rotl64Low32(t) {
  const low = t >>> 0;
  return ((low << 8) | (low >>> 24)) >>> 0;
}

function base64Decode(s) {
  try { return atob(decodeURIComponent(s)); }
  catch { try { return atob(s); } catch { return ""; } }
}

function md5Hex(s) {
  return CryptoJS.MD5(s).toString(CryptoJS.enc.Hex);
}

function parseQuery(qs) {
  const out = {};
  for (const seg of qs.split("&")) {
    if (!seg) continue;
    const idx = seg.indexOf("=");
    if (idx < 0) { out[seg] = ""; continue; }
    out[seg.slice(0, idx)] = seg.slice(idx + 1);
  }
  return out;
}

function buildAntiCode(streamName, presenterUid, antiCode) {
  const map = parseQuery(antiCode);
  if (!map.fm) return antiCode;
  const ctype = map.ctype ?? "huya_pc_exe";
  const platformId = parseInt(map.t ?? "0", 10);
  const isWap = platformId === 103;
  const now = Date.now();
  const seqId = presenterUid + now;
  const secretHash = md5Hex(`${seqId}|${ctype}|${platformId}`);
  const convertUid = rotl64Low32(presenterUid);
  const calcUid = isWap ? presenterUid : convertUid;
  const fm = base64Decode(decodeURIComponent(map.fm));
  const secretPrefix = (fm.split("_")[0] ?? "") || "";
  const wsTime = map.wsTime ?? "";
  const secretStr = `${secretPrefix}_${calcUid}_${streamName}_${secretHash}_${wsTime}`;
  const wsSecret = md5Hex(secretStr);
  const ct = Math.floor((parseInt(wsTime || "0", 16) + Math.random()) * 1000);
  const uuid = Math.floor((((ct % 1e10) + Math.random()) * 1e3) % 0xffffffff);
  const params = { wsSecret, wsTime, seqid: seqId, ctype, ver: "1", fs: map.fs ?? "", fm: encodeURIComponent(map.fm), t: platformId };
  if (isWap) { params.uid = presenterUid; params.uuid = uuid; }
  else { params.u = convertUid; }
  return Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&");
}

async function fetchRoomInfoFromHtml(ctx, roomId) {
  const res = await ctx.fetch(`https://m.huya.com/${encodeURIComponent(roomId)}`, {
    headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    timeout: 25000,
  });
  if (!res.ok) throw new Error(`虎牙 HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/window\.HNF_GLOBAL_INIT\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/) ||
    html.match(/window\.HNF_GLOBAL_INIT\s*=\s*(\{[\s\S]*?\})\s*;/);
  let jsonText = m?.[1];
  if (!jsonText) return fetchRoomInfoViaBetard(ctx, roomId);
  jsonText = jsonText.replace(/function.*?\(.*?\).\{[\s\S]*?\}/g, '""');
  let jsonObj;
  try { jsonObj = JSON.parse(jsonText); }
  catch { return fetchRoomInfoViaBetard(ctx, roomId); }
  const topSidMatch = html.match(/lChannelId":([0-9]+)/);
  jsonObj.topSid = topSidMatch ? parseInt(topSidMatch[1], 10) : 0;
  return jsonObj;
}

// 【修复1】恢复对兜底接口的数据结构映射，确保 Resolve 的读取路径不会报错
async function fetchRoomInfoViaBetard(ctx, roomId) {
  const res = await ctx.fetch(
    `https://mp.huya.com/cache.php?do=profileRoom&m=Live&roomid=${encodeURIComponent(roomId)}`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) throw new Error(`虎牙 HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 200) throw new Error(`虎牙 接口错误: ${data.message || data.status}`);
  
  const baseList = data.data?.stream?.baseSteamInfoList ?? [];
  return {
    roomInfo: {
      tLiveInfo: {
        sIntroduction: data.data.liveData?.introduction,
        sScreenshot: data.data.liveData?.screenshot,
        lTotalCount: data.data.liveData?.userCount,
        lProfileRoom: roomId,
        sGameFullName: data.data.liveData?.gameFullName,
        tLiveStreamInfo: {
          vStreamInfo: { value: baseList },
        },
      },
      tProfileInfo: {
        sNick: data.data.profileInfo?.nick,
        sAvatar180: data.data.profileInfo?.avatar180,
      },
      eLiveStatus: (data.data.liveStatus === "ON" || data.data.liveStatus === "REPLAY") ? 2 : 0,
    },
    topSid: 0,
  };
}

export async function resolve(ctx, { roomId }) {
  let info = await fetchRoomInfoFromHtml(ctx, roomId);
  let lines = info.roomInfo?.tLiveInfo?.tLiveStreamInfo?.vStreamInfo?.value ?? [];
  const presenterUid = info.topSid ?? 0;

  if (lines.length === 0) {
    try {
      const fallback = await fetchRoomInfoViaBetard(ctx, roomId);
      const fbLines = fallback.roomInfo?.tLiveInfo?.tLiveStreamInfo?.vStreamInfo?.value ?? [];
      if (fbLines.length > 0) {
        info = fallback;
        lines = fbLines;
      }
    } catch {}
  }

  if (lines.length === 0) {
    // 【修复2】修正 eLiveStatus 的读取层级，它是 roomInfo 的直接子属性
    const isLive = info.roomInfo?.eLiveStatus === 2;
    if (!isLive) throw new Error("虎牙直播间未开播");
    throw new Error("虎牙 vStreamInfo 为空（风控限制，请稍后重试）");
  }

  let chosen;
  for (const line of lines) {
    if (line.sFlvUrl && line.sFlvAntiCode && line.sStreamName) { chosen = line; break; }
  }
  if (!chosen) throw new Error("虎牙未匹配到可播流");

  const anti = buildAntiCode(chosen.sStreamName, presenterUid, chosen.sFlvAntiCode);
  const url = `${chosen.sFlvUrl}/${chosen.sStreamName}.flv?${anti}&codec=264`;
  const biterates = info.roomInfo?.tLiveInfo?.tLiveStreamInfo?.vBitRateInfo?.value ?? [];
  const alternatives = biterates
    .filter((b) => b.sDisplayName && !b.sDisplayName.includes("HDR"))
    .map((b) => ({ qn: String(b.iBitRate ?? 0), label: b.sDisplayName, url: b.iBitRate === 0 ? url : "" }));

  return ctx.protocols.flvStream({
    url, qn: "0", qnLabel: alternatives.find((a) => a.qn === "0")?.label ?? "原画",
    alternatives: alternatives.length > 0 ? alternatives : undefined,
    referer: REFERER, ua: UA,
  });
}

export async function getRecommend(ctx, { page, pageSize }) {
  const res = await ctx.fetch(
    `https://www.huya.com/cache.php?m=LiveList&do=getLiveListByPage&tagAll=0&page=${page}`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) throw new Error(`虎牙 HTTP ${res.status}`);
  const data = await res.json();
  const rooms = data.data?.datas || [];
  
  const list = rooms.map((r) => {
    // 【修复4】找回原版针对无后缀图片的防盗链/缩放处理
    let cover = r.screenshot || "";
    if (cover && !cover.includes("?")) {
      cover += "?x-oss-process=style/w338_h190&";
    }
    return {
      platform: "huya", roomId: String(r.profileRoom || r.privateHost),
      title: r.introduction || r.roomName, uname: r.nick,
      avatar: r.avatar180, cover,
      online: parseInt(r.totalCount || "0", 10),
      category: r.gameFullName, live: true,
      link: `https://www.huya.com/${r.profileRoom || r.privateHost}`,
    };
  }).filter((r) => r.roomId);
  
  return { list, hasMore: rooms.length >= 20 };
}

// 【修复5】将分类接口改回了你 TS 源码中使用的并发抓取逻辑
const PARENT_CATS = [
  { id: "1", name: "网游" },
  { id: "2", name: "单机" },
  { id: "8", name: "娱乐" },
  { id: "3", name: "手游" },
];

export async function getCategories(ctx) {
  const out = [];
  for (const parent of PARENT_CATS) {
    try {
      const res = await ctx.fetch(`https://live.cdn.huya.com/liveconfig/game/bussLive?bussType=${parent.id}`, { headers: HEADERS, timeout: 20000 });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.data || []) {
        if (item.gid !== undefined && item.gid !== null) {
          out.push({
            id: String(item.gid),
            name: item.gameFullName || "",
            cover: `https://huyaimg.msstatic.com/cdnimage/game/${item.gid}-MS.jpg`,
            parent: parent.name,
          });
        }
      }
    } catch (e) {
      // ignore warning
    }
  }
  return out;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const res = await ctx.fetch(
    `https://www.huya.com/cache.php?m=LiveList&do=getLiveListByPage&tagAll=0&gameId=${encodeURIComponent(categoryId)}&page=${page}`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) throw new Error(`虎牙 HTTP ${res.status}`);
  const data = await res.json();
  const rooms = data.data?.datas || [];
  
  const list = rooms.map((r) => {
    let cover = r.screenshot || "";
    if (cover && !cover.includes("?")) {
      cover += "?x-oss-process=style/w338_h190&";
    }
    return {
      platform: "huya", roomId: String(r.profileRoom || r.privateHost),
      title: r.introduction || r.roomName, uname: r.nick,
      avatar: r.avatar180, cover,
      online: parseInt(r.totalCount || "0", 10),
      category: r.gameFullName, live: true,
      link: `https://www.huya.com/${r.profileRoom || r.privateHost}`,
    };
  }).filter((r) => r.roomId);
  
  return { list, hasMore: rooms.length >= 20 };
}

export async function search(ctx, { keyword, page }) {
  // 【修复3】恢复 start 偏移量计算和 hasMore 下一页判断
  const start = (page - 1) * 20;
  const res = await ctx.fetch(
    `https://search.cdn.huya.com/?m=Search&do=getSearchContent&q=${encodeURIComponent(keyword)}&uid=0&v=4&typ=-5&livestate=0&rows=20&start=${start}`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) return { list: [], hasMore: false };
  const data = await res.json();
  const items = data.response?.["3"]?.docs || [];
  
  const list = items.map((r) => {
    let cover = r.game_screenshot || "";
    if (cover && !cover.includes("?")) {
      cover += "?x-oss-process=style/w338_h190&";
    }
    return {
      platform: "huya", roomId: String(r.room_id || r.uid),
      title: r.game_introduction || r.game_roomName || r.game_nick,
      uname: r.game_nick, avatar: r.game_imgUrl || r.game_avatarUrl180,
      cover, 
      online: typeof r.game_total_count === "string" ? parseInt(r.game_total_count, 10) || 0 : (r.game_total_count ?? 0),
      category: r.gameName, live: true,
      link: `https://www.huya.com/${r.room_id || r.uid}`,
    };
  }).filter((r) => r.roomId);
  
  const numFound = data.response?.["3"]?.numFound ?? 0;
  return { list, hasMore: numFound > page * 20 };
}

export async function getRoomDetail(ctx, { roomId }) {
  const info = await fetchRoomInfoFromHtml(ctx, roomId);
  const live = info.roomInfo?.tLiveInfo;
  const profile = info.roomInfo?.tProfileInfo;
  return {
    platform: "huya", roomId,
    title: live?.sIntroduction || live?.sRoomName || roomId,
    uname: profile?.sNick || roomId,
    avatar: profile?.sAvatar180,
    cover: live?.sScreenshot,
    online: live?.lTotalCount ?? 0,
    category: live?.sGameFullName,
    live: info.roomInfo?.eLiveStatus === 2, // 【修复2】修正状态判断路径
    link: `https://www.huya.com/${roomId}`,
  };
}

export async function getLiveStatus(ctx, { roomId }) {
  try {
    const info = await fetchRoomInfoFromHtml(ctx, roomId);
    return info.roomInfo?.eLiveStatus === 2; // 【修复2】修正状态判断路径
  } catch { return false; }
}