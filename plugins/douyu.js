/**
 * 斗鱼直播插件 —— 签名 + getH5Play
 * 协议: FLV / HLS
 */
import CryptoJS from "crypto-js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.43";
const REFERER = "https://www.douyu.com/";

export const manifest = {
  id: "douyu",
  label: "斗鱼",
  version: "1.0.0",
  defaultProxy: "direct",
  engine: { netliveApi: 1 },
};

async function fetchJson(ctx, url, opts) {
  const headers = { "User-Agent": UA, Referer: REFERER, ...(opts?.headers ?? {}) };
  const res = await ctx.fetch(url, { method: opts?.method ?? "GET", headers, body: opts?.body, timeout: 20000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function randomDid(length) {
  let out = "";
  for (let i = 0; i < (length || 32); i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function mapRoom(item) {
  if (item.type !== undefined && item.type !== 1) return undefined;
  const rid = item.rid;
  if (rid === undefined || rid === null) return undefined;
  const av = item.av ?? "";
  return {
    platform: "douyu",
    roomId: String(rid),
    title: item.rn ?? "",
    uname: item.nn,
    cover: item.rs16,
    avatar: av ? `https://apic.douyucdn.cn/upload/${av}_middle.jpg` : undefined,
    online: typeof item.ol === "string" ? parseInt(item.ol, 10) || 0 : item.ol,
    category: item.c2name,
    live: true,
    link: `https://www.douyu.com/${rid}`,
  };
}

export async function getRecommend(ctx, { page }) {
  const data = await fetchJson(ctx, `https://www.douyu.com/japi/weblist/apinc/allpage/6/${page}`);
  const list = (data.data?.rl ?? []).map(mapRoom).filter(Boolean);
  return { list, hasMore: page < (data.data?.pgcnt ?? 0) };
}

export async function getCategories(ctx) {
  const data = await fetchJson(ctx, "https://m.douyu.com/api/cate/list");
  const parents = data.data?.cate1Info ?? [];
  const children = data.data?.cate2Info ?? [];
  const sorted = [...parents].sort((a, b) => a.cate1Id - b.cate1Id);
  const out = [];
  for (const p of sorted) {
    for (const c of children) {
      if (c.cate1Id !== p.cate1Id) continue;
      out.push({ id: String(c.cate2Id), name: c.cate2Name, cover: c.icon, parent: p.cate1Name });
    }
  }
  return out;
}

export async function getCategoryRooms(ctx, { categoryId, page }) {
  const data = await fetchJson(ctx, `https://www.douyu.com/gapi/rkc/directory/mixList/2_${categoryId}/${page}`);
  const list = (data.data?.rl ?? []).map(mapRoom).filter(Boolean);
  return { list, hasMore: page < (data.data?.pgcnt ?? 0) };
}

export async function search(ctx, { keyword, page }) {
  const did = randomDid();
  const url = `https://www.douyu.com/japi/search/api/searchShow?kw=${encodeURIComponent(keyword)}&page=${page}&pageSize=20`;
  const data = await fetchJson(ctx, url, { headers: { Referer: "https://www.douyu.com/search/", Cookie: `dy_did=${did};acf_did=${did}` } });
  if (data.error !== 0 && data.error !== undefined) throw new Error(data.msg || `斗鱼错误码 ${data.error}`);
  const queryList = data.data?.relateShow ?? [];
  const list = queryList.map((item) => {
    const isLive = (typeof item.isLive === "string" ? parseInt(item.isLive, 10) : item.isLive) === 1;
    const roomType = typeof item.roomType === "string" ? parseInt(item.roomType, 10) : item.roomType ?? 0;
    return {
      platform: "douyu",
      roomId: String(item.rid ?? ""),
      title: item.roomName ?? "",
      cover: item.roomSrc,
      uname: item.nickName,
      avatar: item.avatar,
      category: item.cateName,
      online: typeof item.hot === "string" ? parseInt(item.hot, 10) || 0 : item.hot,
      live: isLive && roomType === 0,
      link: item.rid ? `https://www.douyu.com/${item.rid}` : undefined,
    };
  });
  return { list, hasMore: queryList.length > 0 };
}

export async function getRoomDetail(ctx, { roomId }) {
  const data = await fetchJson(ctx, `https://www.douyu.com/betard/${roomId}`, { headers: { Referer: `https://www.douyu.com/${roomId}` } });
  const r = data.room;
  if (!r) throw new Error("斗鱼未返回房间详情");
  return {
    platform: "douyu",
    roomId: String(r.room_id ?? roomId),
    title: r.room_name ?? "",
    cover: r.room_pic,
    uname: r.owner_name,
    avatar: r.owner_avatar,
    introduction: r.show_details,
    category: r.second_lvl_name,
    online: r.room_biz_all?.hot ? parseInt(r.room_biz_all.hot, 10) || 0 : undefined,
    live: r.show_status === 1,
    link: `https://www.douyu.com/${roomId}`,
  };
}

async function signRoom(ctx, rid) {
  const res = await fetchJson(ctx, `https://www.douyu.com/swf_api/homeH5Enc?rids=${rid}`, { headers: { Referer: `https://www.douyu.com/${rid}` } });
  const html = res.data?.[`room${rid}`];
  if (!html) throw new Error("斗鱼签名脚本未返回");
  const stripped = html.replace(/eval.*?;}/, "strc;}");
  const did = "10000000000000000000000000001501";
  const time = String(Math.floor(Date.now() / 1000));
  try {
    const fn = new Function("CryptoJS", "rid", "did", "time", `"use strict";\n${stripped}\nreturn ub98484234(rid, did, time);`);
    const result = fn(CryptoJS, rid, did, time);
    if (typeof result !== "string" || !result) throw new Error("ub98484234 返回非法值");
    return result;
  } catch (e) {
    throw new Error(`斗鱼签名脚本执行失败：${e.message}`);
  }
}

async function postH5Play(ctx, roomId, args, rate, cdn) {
  const body = `${args}&cdn=${cdn ?? ""}&rate=${rate ?? 0}&ver=Douyu_223061205&iar=1&ive=1&hevc=0&fa=0`;
  const res = await ctx.fetch(`https://www.douyu.com/lapi/live/getH5Play/${roomId}`, {
    method: "POST",
    headers: { "User-Agent": UA, Referer: `https://www.douyu.com/${roomId}`, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
    timeout: 20000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function unescapeHtml(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export async function resolve(ctx, { roomId }) {
  const args = await signRoom(ctx, roomId);
  const meta = await postH5Play(ctx, roomId, args, -1, "");
  if (meta.error !== 0 && meta.error !== undefined) throw new Error(meta.msg || `斗鱼 error ${meta.error}`);
  const cdnList = (meta.data?.cdnsWithName ?? []).map((c) => c.cdn).filter(Boolean);
  cdnList.sort((a, b) => (a.startsWith("scdn") ? 1 : 0) - (b.startsWith("scdn") ? 1 : 0));
  const multirates = meta.data?.multirates ?? [];
  if (multirates.length === 0) throw new Error("斗鱼 multirates 为空（房间未开播）");
  const defaultRate = meta.data?.rate ?? multirates[0].rate;
  const firstCdn = cdnList[0] ?? "";
  const play = await postH5Play(ctx, roomId, args, defaultRate, firstCdn);
  if (play.error !== 0 && play.error !== undefined) throw new Error(play.msg || `斗鱼 error ${play.error}`);
  const rtmpUrl = play.data?.rtmp_url;
  const rtmpLive = play.data?.rtmp_live;
  if (!rtmpUrl || !rtmpLive) throw new Error("斗鱼未返回 rtmp_url / rtmp_live");
  const finalUrl = `${rtmpUrl}/${unescapeHtml(rtmpLive)}`;
  const alternatives = multirates.filter((r) => r.name && r.rate !== undefined).map((r) => ({
    qn: String(r.rate), label: r.name, url: r.rate === defaultRate ? finalUrl : "",
  }));
  if (finalUrl.includes(".m3u8")) {
    return ctx.protocols.hlsStream({ url: finalUrl, qn: String(defaultRate), qnLabel: multirates.find((r) => r.rate === defaultRate)?.name, alternatives: alternatives.length > 0 ? alternatives : undefined, referer: `https://www.douyu.com/${roomId}`, ua: UA });
  }
  return ctx.protocols.flvStream({ url: finalUrl, qn: String(defaultRate), qnLabel: multirates.find((r) => r.rate === defaultRate)?.name, alternatives: alternatives.length > 0 ? alternatives : undefined, referer: `https://www.douyu.com/${roomId}`, ua: UA });
}
