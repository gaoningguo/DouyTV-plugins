/**
 * Kick.com 直播插件
 *
 * 协议：HLS (master m3u8 + ABR variants)
 * API：https://kick.com/api/v2/channels/{slug}
 */
const REFERER = "https://kick.com/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  Referer: REFERER,
  Origin: "https://kick.com",
  Accept: "application/json, text/plain, */*",
};

function parseMaster(text, masterUrl) {
  const lines = text.split("\n");
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const urlLine = (lines[i + 1] || "").trim();
    if (!urlLine || urlLine.startsWith("#")) continue;
    const bw = parseInt((line.match(/BANDWIDTH=(\d+)/) || [])[1] || "0", 10);
    const res = (line.match(/RESOLUTION=([^\s,]+)/) || [])[1] || "";
    const absUrl = urlLine.startsWith("http") ? urlLine : new URL(urlLine, masterUrl).toString();
    variants.push({ qn: res || String(bw), label: res || `${Math.round(bw / 1000)}k`, url: absUrl, bandwidth: bw });
  }
  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return variants;
}

export const manifest = {
  id: "kick",
  label: "Kick",
  version: "1.0.0",
  defaultProxy: "proxy",
  engine: { netliveApi: 1 },
};

export async function resolve(ctx, { roomId }) {
  const res = await ctx.fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(roomId)}`, {
    headers: HEADERS,
    timeout: 20000,
  });
  if (!res.ok) throw new Error(`Kick HTTP ${res.status}`);
  const data = await res.json();
  const playbackUrl = data.playback_url || data.livestream?.playback_url;
  if (!playbackUrl) throw new Error(`Kick 主播 ${roomId} 未在直播`);

  // 拉 master m3u8 解析 variants
  let alternatives;
  try {
    const m3u8Res = await ctx.fetch(playbackUrl, { headers: { "User-Agent": UA, Referer: REFERER } });
    if (m3u8Res.ok) {
      const text = await m3u8Res.text();
      const vars = parseMaster(text, playbackUrl);
      if (vars.length > 1) {
        alternatives = [{ qn: "auto", label: "自适应", url: playbackUrl }, ...vars];
      }
    }
  } catch {}

  const top = alternatives?.[1];
  return ctx.protocols.hlsStream({
    url: top?.url ?? playbackUrl,
    qn: top?.qn ?? "auto",
    qnLabel: top?.label ?? "自适应",
    alternatives,
    referer: REFERER,
    ua: UA,
  });
}

export async function getRecommend(ctx, { page, pageSize }) {
  const limit = Math.max(pageSize, 25);
  const offset = (page - 1) * limit;
  const res = await ctx.fetch(
    `https://kick.com/api/v2/channels?page=${page}&limit=${limit}&sort=viewers&subcategory=&category=`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) throw new Error(`Kick HTTP ${res.status}`);
  const data = await res.json();
  const channels = data.data || data.channels || data || [];
  const list = channels.map((ch) => ({
    platform: "kick",
    roomId: ch.slug || ch.user?.username || "",
    title: ch.livestream?.session_title || ch.slug || "",
    uname: ch.user?.username || ch.slug,
    cover: ch.livestream?.thumbnail?.url || ch.banner_image?.url,
    online: ch.livestream?.viewer_count ?? 0,
    category: ch.livestream?.categories?.[0]?.name,
    live: !!ch.livestream,
    link: `https://kick.com/${ch.slug}`,
  })).filter((r) => r.roomId);
  return { list, hasMore: channels.length >= limit };
}

export async function search(ctx, { keyword, page }) {
  const res = await ctx.fetch(
    `https://kick.com/api/v2/search?query=${encodeURIComponent(keyword)}`,
    { headers: HEADERS, timeout: 20000 }
  );
  if (!res.ok) return { list: [], hasMore: false };
  const data = await res.json();
  const channels = data.channels || [];
  const list = channels.map((ch) => ({
    platform: "kick",
    roomId: ch.slug || "",
    title: ch.slug || "",
    uname: ch.slug,
    cover: ch.banner_image?.url,
    online: ch.livestream?.viewer_count ?? 0,
    live: !!ch.livestream,
    link: `https://kick.com/${ch.slug}`,
  })).filter((r) => r.roomId);
  return { list, hasMore: false };
}
