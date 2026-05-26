/**
 * 虎牙直播插件
 *
 * 协议：FLV (Adobe Flash Video)
 * API：https://mp.huya.com/cache.php?do=profileRoom&...
 */
const REFERER = "https://www.huya.com/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "application/json" };

export const manifest = {
  id: "huya",
  label: "虎牙",
  version: "1.0.0",
  defaultProxy: "direct",
  engine: { netliveApi: 1 },
};

export async function resolve(ctx, { roomId }) {
  const res = await ctx.fetch(
    `https://mp.huya.com/cache.php?do=profileRoom&m=Live&roomid=${encodeURIComponent(roomId)}`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) throw new Error(`Huya HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 200) throw new Error(`Huya 接口错误: ${data.message || data.status}`);

  const stream = data.data?.stream;
  const liveStatus = data.data?.realLiveStatus || data.data?.liveStatus;
  if (liveStatus !== "ON") throw new Error(`Huya 主播 ${roomId} 未开播`);

  const flvInfo = stream?.baseSteamInfoList?.[0];
  if (!flvInfo) throw new Error("Huya 未返回 stream 信息");

  // 拼 FLV URL: sFlvUrl/sStreamName.flv?sFlvAntiCode
  const flvUrl = `${flvInfo.sFlvUrl}/${flvInfo.sStreamName}.${flvInfo.sFlvUrlSuffix}?${flvInfo.sFlvAntiCode}`;

  // 多码率
  const alternatives = [];
  const bitRates = stream?.flv?.rateArray || data.data?.gameLiveInfo?.bitRateInfo;
  if (Array.isArray(bitRates)) {
    for (const br of bitRates) {
      const bitrate = br.iBitRate || br.bitrate || 0;
      const label = br.sDisplayName || br.name || `${bitrate}k`;
      alternatives.push({
        qn: String(bitrate),
        label,
        url: flvUrl + (bitrate ? `&ratio=${bitrate}` : ""),
      });
    }
  }

  return ctx.protocols.flvStream({
    url: flvUrl,
    qn: "0",
    qnLabel: "原画",
    alternatives: alternatives.length > 0 ? alternatives : undefined,
    referer: REFERER,
    ua: UA,
  });
}

export async function getRecommend(ctx, { page, pageSize }) {
  const res = await ctx.fetch(
    `https://www.huya.com/cache.php?m=LiveList&do=getLiveListByPage&tagAll=0&page=${page}`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) throw new Error(`Huya HTTP ${res.status}`);
  const data = await res.json();
  const rooms = data.data?.datas || [];
  const list = rooms.map((r) => ({
    platform: "huya",
    roomId: r.profileRoom || r.privateHost,
    title: r.introduction || r.roomName,
    uname: r.nick,
    avatar: r.avatar180,
    cover: r.screenshot,
    online: parseInt(r.totalCount || "0", 10),
    category: r.gameFullName,
    live: true,
    link: `https://www.huya.com/${r.profileRoom || r.privateHost}`,
  })).filter((r) => r.roomId);
  return { list, hasMore: rooms.length >= pageSize };
}

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
      const data = await fetchJson(
        ctx, 
        `https://live.cdn.huya.com/liveconfig/game/bussLive?bussType=${parent.id}`
      );
      
      const items = data.data ?? [];
      for (const item of items) {
        const gid = item.gid !== undefined ? String(item.gid) : null;
        if (!gid) continue;
        
        out.push({
          id: gid,
          name: item.gameFullName ?? "",
          cover: `https://huyaimg.msstatic.com/cdnimage/game/${gid}-MS.jpg`,
          parent: parent.name,
        });
      }
    } catch (e) {
      console.warn(`[huya] category ${parent.name} failed`, e);
    }
  }
  
  return out;
}