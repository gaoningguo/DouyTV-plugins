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

  // plugins/huya.js
  var huya_exports = {};
  __export(huya_exports, {
    getRecommend: () => getRecommend,
    manifest: () => manifest,
    resolve: () => resolve
  });
  var REFERER = "https://www.huya.com/";
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  var HEADERS = { "User-Agent": UA, Referer: REFERER, Accept: "application/json" };
  var manifest = {
    id: "huya",
    label: "\u864E\u7259",
    version: "1.0.0",
    defaultProxy: "direct",
    engine: { netliveApi: 1 }
  };
  async function resolve(ctx, { roomId }) {
    const res = await ctx.fetch(
      `https://mp.huya.com/cache.php?do=profileRoom&m=Live&roomid=${encodeURIComponent(roomId)}`,
      { headers: HEADERS, timeout: 2e4 }
    );
    if (!res.ok) throw new Error(`Huya HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 200) throw new Error(`Huya \u63A5\u53E3\u9519\u8BEF: ${data.message || data.status}`);
    const stream = data.data?.stream;
    const liveStatus = data.data?.realLiveStatus || data.data?.liveStatus;
    if (liveStatus !== "ON") throw new Error(`Huya \u4E3B\u64AD ${roomId} \u672A\u5F00\u64AD`);
    const flvInfo = stream?.baseSteamInfoList?.[0];
    if (!flvInfo) throw new Error("Huya \u672A\u8FD4\u56DE stream \u4FE1\u606F");
    const flvUrl = `${flvInfo.sFlvUrl}/${flvInfo.sStreamName}.${flvInfo.sFlvUrlSuffix}?${flvInfo.sFlvAntiCode}`;
    const alternatives = [];
    const bitRates = stream?.flv?.rateArray || data.data?.gameLiveInfo?.bitRateInfo;
    if (Array.isArray(bitRates)) {
      for (const br of bitRates) {
        const bitrate = br.iBitRate || br.bitrate || 0;
        const label = br.sDisplayName || br.name || `${bitrate}k`;
        alternatives.push({
          qn: String(bitrate),
          label,
          url: flvUrl + (bitrate ? `&ratio=${bitrate}` : "")
        });
      }
    }
    return ctx.protocols.flvStream({
      url: flvUrl,
      qn: "0",
      qnLabel: "\u539F\u753B",
      alternatives: alternatives.length > 0 ? alternatives : void 0,
      referer: REFERER,
      ua: UA
    });
  }
  async function getRecommend(ctx, { page, pageSize }) {
    const res = await ctx.fetch(
      `https://www.huya.com/cache.php?m=LiveList&do=getLiveListByPage&tagAll=0&page=${page}`,
      { headers: HEADERS, timeout: 2e4 }
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
      link: `https://www.huya.com/${r.profileRoom || r.privateHost}`
    })).filter((r) => r.roomId);
    return { list, hasMore: rooms.length >= pageSize };
  }
  return __toCommonJS(huya_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
