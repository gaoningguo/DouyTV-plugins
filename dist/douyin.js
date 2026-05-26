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

  // plugins/douyin.js
  var douyin_exports = {};
  __export(douyin_exports, {
    getCategories: () => getCategories,
    getCategoryRooms: () => getCategoryRooms,
    getLiveStatus: () => getLiveStatus,
    getRecommend: () => getRecommend,
    getRoomDetail: () => getRoomDetail,
    manifest: () => manifest,
    resolve: () => resolve,
    search: () => search
  });

  // plugins/_abogus.js
  function getABogus(params, userAgent) {
    const fn = new Function("params", "userAgent", ABOGUS_CODE + "\nreturn getABogus(params, userAgent);");
    return fn(params, userAgent);
  }
  var ABOGUS_CODE = `function getABogus(params,userAgent){function rc4_encrypt(plaintext,key){var s=[];for(var i=0;i<256;i++){s[i]=i}var j=0;for(var i=0;i<256;i++){j=(j+s[i]+key.charCodeAt(i%key.length))%256;var temp=s[i];s[i]=s[j];s[j]=temp}var i=0;var j=0;var cipher=[];for(var k=0;k<plaintext.length;k++){i=(i+1)%256;j=(j+s[i])%256;var temp=s[i];s[i]=s[j];s[j]=temp;var t=(s[i]+s[j])%256;cipher.push(String.fromCharCode(s[t]^plaintext.charCodeAt(k)))}return cipher.join("")}function le(e,r){return(e<<(r%=32)|e>>>32-r)>>>0}function de(e){return 0<=e&&e<16?2043430169:16<=e&&e<64?2055708042:void 0}function pe(e,r,t,n){return 0<=e&&e<16?(r^t^n)>>>0:16<=e&&e<64?(r&t|r&n|t&n)>>>0:0}function he(e,r,t,n){return 0<=e&&e<16?(r^t^n)>>>0:16<=e&&e<64?(r&t|~r&n)>>>0:0}function SM3(){this.reg=[];this.chunk=[];this.size=0;this.reset()}SM3.prototype.reset=function(){this.reg[0]=1937774191;this.reg[1]=1226093241;this.reg[2]=388252375;this.reg[3]=3666478592;this.reg[4]=2842636476;this.reg[5]=372324522;this.reg[6]=3817729613;this.reg[7]=2969243214;this.chunk=[];this.size=0};SM3.prototype.write=function(e){var a="string"==typeof e?function(e){var n=encodeURIComponent(e).replace(/%([0-9A-F]{2})/g,function(e,r){return String.fromCharCode("0x"+r)});var a=new Array(n.length);Array.prototype.forEach.call(n,function(e,r){a[r]=e.charCodeAt(0)});return a}(e):e;this.size+=a.length;var f=64-this.chunk.length;if(a.length<f)this.chunk=this.chunk.concat(a);else for(this.chunk=this.chunk.concat(a.slice(0,f));this.chunk.length>=64;)this._compress(this.chunk),f<a.length?this.chunk=a.slice(f,Math.min(f+64,a.length)):this.chunk=[],f+=64};SM3.prototype.sum=function(e,t){e&&(this.reset(),this.write(e));this._fill();for(var f=0;f<this.chunk.length;f+=64)this._compress(this.chunk.slice(f,f+64));var i=null;if(t=="hex"){i="";for(f=0;f<8;f++)i+=se(this.reg[f].toString(16),8,"0")}else for(i=new Array(32),f=0;f<8;f++){var c=this.reg[f];i[4*f+3]=(255&c)>>>0;c>>>=8;i[4*f+2]=(255&c)>>>0;c>>>=8;i[4*f+1]=(255&c)>>>0;c>>>=8;i[4*f]=(255&c)>>>0}return this.reset(),i};SM3.prototype._compress=function(t){if(t<64)return;for(var f=function(e){for(var r=new Array(132),t=0;t<16;t++)r[t]=e[4*t]<<24,r[t]|=e[4*t+1]<<16,r[t]|=e[4*t+2]<<8,r[t]|=e[4*t+3],r[t]>>>=0;for(var n=16;n<68;n++){var a=r[n-16]^r[n-9]^le(r[n-3],15);a=a^le(a,15)^le(a,23);r[n]=(a^le(r[n-13],7)^r[n-6])>>>0}for(n=0;n<64;n++)r[n+68]=(r[n]^r[n+4])>>>0;return r}(t),i=this.reg.slice(0),c=0;c<64;c++){var o=le(i[0],12)+i[4]+le(de(c),c);var s=(o=le(o=(4294967295&o)>>>0,7))^le(i[0],12)>>>0;var u=pe(c,i[0],i[1],i[2]);u=(4294967295&(u=u+i[3]+s+f[c+68]))>>>0;var b=he(c,i[4],i[5],i[6]);b=(4294967295&(b=b+i[7]+o+f[c]))>>>0;i[3]=i[2];i[2]=le(i[1],9);i[1]=i[0];i[0]=u;i[7]=i[6];i[6]=le(i[5],19);i[5]=i[4];i[4]=(b^le(b,9)^le(b,17))>>>0}for(var l=0;l<8;l++)this.reg[l]=(this.reg[l]^i[l])>>>0};SM3.prototype._fill=function(){var a=8*this.size;var f=this.chunk.push(128)%64;for(64-f<8&&(f-=64);f<56;f++)this.chunk.push(0);for(var i=0;i<4;i++){var c=Math.floor(a/4294967296);this.chunk.push(c>>>8*(3-i)&255)}for(i=0;i<4;i++)this.chunk.push(a>>>8*(3-i)&255)};function se(e,r,t){for(;e.length<r;)e=t+e;return e}function result_encrypt(long_str,num){var s_obj={"s0":"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=","s1":"Dkdpgh4ZKsQB80/Mfvw36XI1R25+WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=","s2":"Dkdpgh4ZKsQB80/Mfvw36XI1R25-WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=","s3":"ckdp1h4ZKsUB80/Mfvw36XIgR25+WQAlEi7NLboqYTOPuzmFjJnryx9HVGDaStCe","s4":"Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe"};var constant={"0":16515072,"1":258048,"2":4032,"str":s_obj[num]};var result="";var lound=0;var long_int=get_long_int(lound,long_str);for(var i=0;i<long_str.length/3*4;i++){if(Math.floor(i/4)!==lound){lound+=1;long_int=get_long_int(lound,long_str)}var key=i%4;switch(key){case 0:temp_int=(long_int&constant["0"])>>18;result+=constant["str"].charAt(temp_int);break;case 1:temp_int=(long_int&constant["1"])>>12;result+=constant["str"].charAt(temp_int);break;case 2:temp_int=(long_int&constant["2"])>>6;result+=constant["str"].charAt(temp_int);break;case 3:temp_int=long_int&63;result+=constant["str"].charAt(temp_int);break}}return result}function get_long_int(round,long_str){round=round*3;return(long_str.charCodeAt(round)<<16)|(long_str.charCodeAt(round+1)<<8)|(long_str.charCodeAt(round+2))}function gener_random(random,option){return[(random&255&170)|option[0]&85,(random&255&85)|option[0]&170,(random>>8&255&170)|option[1]&85,(random>>8&255&85)|option[1]&170]}function generate_rc4_bb_str(url_search_params,user_agent,window_env_str){var sm3=new SM3();var start_time=Date.now();var url_search_params_list=sm3.sum(sm3.sum(url_search_params+"cus"));var cus=sm3.sum(sm3.sum("cus"));var ua=sm3.sum(result_encrypt(rc4_encrypt(user_agent,String.fromCharCode.apply(null,[0.00390625,1,14])),"s3"));var end_time=Date.now();var b={8:3,10:end_time,16:start_time,18:44,19:[1,0,1,5]};b[20]=(b[16]>>24)&255;b[21]=(b[16]>>16)&255;b[22]=(b[16]>>8)&255;b[23]=b[16]&255;b[24]=(b[16]/256/256/256/256)>>0;b[25]=(b[16]/256/256/256/256/256)>>0;b[26]=0;b[27]=0;b[28]=0;b[29]=0;b[30]=0;b[31]=1;b[32]=0;b[33]=0;b[34]=0;b[35]=0;b[36]=0;b[37]=14;b[38]=url_search_params_list[21];b[39]=url_search_params_list[22];b[40]=cus[21];b[41]=cus[22];b[42]=ua[23];b[43]=ua[24];b[44]=(b[10]>>24)&255;b[45]=(b[10]>>16)&255;b[46]=(b[10]>>8)&255;b[47]=b[10]&255;b[48]=b[8];b[49]=(b[10]/256/256/256/256)>>0;b[50]=(b[10]/256/256/256/256/256)>>0;b[51]=6241;b[52]=(6241>>24)&255;b[53]=(6241>>16)&255;b[54]=(6241>>8)&255;b[55]=6241&255;b[56]=6383;b[57]=6383&255;b[58]=(6383>>8)&255;b[59]=(6383>>16)&255;b[60]=(6383>>24)&255;var window_env_list=[];for(var index=0;index<window_env_str.length;index++){window_env_list.push(window_env_str.charCodeAt(index))}b[64]=window_env_list.length;b[65]=b[64]&255;b[66]=(b[64]>>8)&255;b[69]=0;b[70]=0;b[71]=0;b[72]=b[18]^b[20]^b[26]^b[30]^b[38]^b[40]^b[42]^b[21]^b[27]^b[31]^b[35]^b[39]^b[41]^b[43]^b[22]^b[28]^b[32]^b[36]^b[23]^b[29]^b[33]^b[37]^b[44]^b[45]^b[46]^b[47]^b[48]^b[49]^b[50]^b[24]^b[25]^b[52]^b[53]^b[54]^b[55]^b[57]^b[58]^b[59]^b[60]^b[65]^b[66]^b[70]^b[71];var bb=[b[18],b[20],b[52],b[26],b[30],b[34],b[58],b[38],b[40],b[53],b[42],b[21],b[27],b[54],b[55],b[31],b[35],b[57],b[39],b[41],b[43],b[22],b[28],b[32],b[60],b[36],b[23],b[29],b[33],b[37],b[44],b[45],b[59],b[46],b[47],b[48],b[49],b[50],b[24],b[25],b[65],b[66],b[70],b[71]];bb=bb.concat(window_env_list).concat(b[72]);return rc4_encrypt(String.fromCharCode.apply(null,bb),String.fromCharCode.apply(null,[121]))}function generate_random_str(){var random_str_list=[];random_str_list=random_str_list.concat(gener_random(Math.random()*10000,[3,45]));random_str_list=random_str_list.concat(gener_random(Math.random()*10000,[1,0]));random_str_list=random_str_list.concat(gener_random(Math.random()*10000,[1,5]));return String.fromCharCode.apply(null,random_str_list)}function generate_a_bogus(url_search_params,user_agent){var result_str=generate_random_str()+generate_rc4_bb_str(url_search_params,user_agent,"1536|747|1536|834|0|30|0|0|1536|834|1536|864|1525|747|24|24|Win32");return result_encrypt(result_str,"s4")+"="}return generate_a_bogus(params,userAgent)}`;

  // plugins/douyin.js
  var UA = "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.97 Safari/537.36 Core/1.116.567.400 QQBrowser/19.7.6764.400";
  var DEFAULT_COOKIE = "ttwid=1%7CB1qls3GdnZhUov9o2NxOMxxYS2ff6OSvEWbv0ytbES4%7C1680522049%7C280d802d6d478e3e78d0c807f7c487e7ffec0ae4e5fdd6a0fe74c3c6af149511";
  var AUTHORITY = "live.douyin.com";
  var REFERER = "https://live.douyin.com";
  var MSTOKEN_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var manifest = {
    id: "douyin",
    label: "\u6296\u97F3",
    version: "1.0.0",
    defaultProxy: "direct",
    engine: { netliveApi: 1 }
  };
  function generateMsToken(length) {
    let out = "";
    for (let i = 0; i < (length || 107); i++) out += MSTOKEN_ALPHA[Math.floor(Math.random() * MSTOKEN_ALPHA.length)];
    return out;
  }
  function signUrl(url) {
    const msToken = generateMsToken(107);
    const withToken = `${url}&msToken=${msToken}`;
    const qs = withToken.split("?")[1] ?? "";
    let aBogus = "";
    try {
      aBogus = getABogus(qs, UA);
    } catch {
    }
    return `${url}&msToken=${encodeURIComponent(msToken)}&a_bogus=${encodeURIComponent(aBogus)}`;
  }
  function defaultHeaders() {
    return { "User-Agent": UA, Referer: REFERER, Authority: AUTHORITY, Cookie: DEFAULT_COOKIE };
  }
  async function fetchJson(ctx, url) {
    const res = await ctx.fetch(url, { headers: defaultHeaders(), timeout: 2e4, http2: true });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function fetchText(ctx, url) {
    const res = await ctx.fetch(url, { headers: defaultHeaders(), timeout: 2e4, http2: true });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  function parseDisplayCount(v) {
    if (v === void 0 || v === null) return void 0;
    if (typeof v === "number") return v;
    const s = String(v);
    if (!s) return void 0;
    const num = parseFloat(s);
    if (isNaN(num)) return void 0;
    if (s.includes("\u4E07")) return Math.round(num * 1e4);
    if (s.includes("\u4EBF")) return Math.round(num * 1e8);
    return Math.round(num);
  }
  function mapPartitionItem(item) {
    const rid = item.web_rid;
    if (!rid) return void 0;
    const room = item.room ?? {};
    return {
      platform: "douyin",
      roomId: String(rid),
      title: room.title ?? "",
      cover: room.cover?.url_list?.[0],
      uname: room.owner?.nickname,
      avatar: room.owner?.avatar_thumb?.url_list?.[0],
      online: parseDisplayCount(room.room_view_stats?.display_value),
      category: item.tag_name ?? "\u70ED\u95E8\u63A8\u8350",
      live: true,
      link: `https://live.douyin.com/${rid}`
    };
  }
  function partitionQuery(partition, partitionType, page) {
    return {
      aid: "6383",
      app_name: "douyin_web",
      live_id: "1",
      device_platform: "web",
      language: "zh-CN",
      enter_from: "link_share",
      cookie_enabled: "true",
      screen_width: "1980",
      screen_height: "1080",
      browser_language: "zh-CN",
      browser_platform: "Win32",
      browser_name: "Edge",
      browser_version: "125.0.0.0",
      browser_online: "true",
      count: "15",
      offset: String((page - 1) * 15),
      partition,
      partition_type: partitionType,
      req_from: "2"
    };
  }
  function buildUrl(base, params) {
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    return `${base}?${qs}`;
  }
  async function getRecommend(ctx, { page }) {
    const url = buildUrl("https://live.douyin.com/webcast/web/partition/detail/room/v2/", partitionQuery("720", "1", page));
    const data = await fetchJson(ctx, signUrl(url));
    const items = data.data?.data ?? [];
    return { list: items.map(mapPartitionItem).filter(Boolean), hasMore: items.length >= 15 };
  }
  function extractCategoryDataJson(source) {
    const startPattern = '{\\"pathname\\":\\"/\\",\\"categoryData\\":';
    const startIndex = source.indexOf(startPattern);
    if (startIndex === -1) return "";
    let openBraces = 0, foundFirst = false;
    for (let i = startIndex; i < source.length; i++) {
      if (source[i] === "{") {
        openBraces++;
        foundFirst = true;
      } else if (source[i] === "}") openBraces--;
      if (foundFirst && openBraces === 0) {
        return source.substring(startIndex, i + 1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    }
    return "";
  }
  async function getCategories(ctx) {
    const html = await fetchText(ctx, "https://live.douyin.com/?from_nav=1");
    const extracted = extractCategoryDataJson(html);
    if (!extracted) return [];
    let parsed;
    try {
      parsed = JSON.parse(extracted);
    } catch {
      return [];
    }
    const out = [];
    for (const item of parsed.categoryData ?? []) {
      const parentTitle = item.partition?.title ?? "";
      const parentId = `${item.partition?.id_str ?? ""},${item.partition?.type ?? ""}`;
      for (const sub of item.sub_partition ?? []) {
        const subId = `${sub.partition?.id_str ?? ""},${sub.partition?.type ?? ""}`;
        if (!subId.startsWith(",")) out.push({ id: subId, name: sub.partition?.title ?? "", parent: parentTitle });
      }
      if (parentId && !parentId.startsWith(",")) out.push({ id: parentId, name: `${parentTitle}-\u5168\u90E8`, parent: parentTitle });
    }
    return out;
  }
  async function getCategoryRooms(ctx, { categoryId, page }) {
    const [partition, partitionType] = categoryId.split(",");
    if (!partition || !partitionType) throw new Error(`\u6296\u97F3 categoryId \u683C\u5F0F\u5E94\u4E3A "id,type"`);
    const url = buildUrl("https://live.douyin.com/webcast/web/partition/detail/room/v2/", partitionQuery(partition, partitionType, page));
    const data = await fetchJson(ctx, signUrl(url));
    const items = data.data?.data ?? [];
    return { list: items.map(mapPartitionItem).filter(Boolean), hasMore: items.length >= 15 };
  }
  async function search(ctx, { keyword, page }) {
    const params = {
      device_platform: "webapp",
      aid: "6383",
      channel: "channel_pc_web",
      search_channel: "aweme_live",
      keyword,
      search_source: "switch_tab",
      query_correct_type: "1",
      is_filter_search: "0",
      from_group_id: "",
      offset: String((page - 1) * 10),
      count: "10",
      pc_client_type: "1",
      version_code: "170400",
      version_name: "17.4.0",
      cookie_enabled: "true",
      screen_width: "1980",
      screen_height: "1080",
      browser_language: "zh-CN",
      browser_platform: "Win32",
      browser_name: "Edge",
      browser_version: "125.0.0.0",
      browser_online: "true",
      engine_name: "Blink",
      engine_version: "125.0.0.0",
      os_name: "Windows",
      os_version: "10",
      cpu_core_num: "12",
      device_memory: "8",
      platform: "PC",
      downlink: "10",
      effective_type: "4g",
      round_trip_time: "100",
      webid: "7382872326016435738"
    };
    const url = buildUrl("https://www.douyin.com/aweme/v1/web/live/search/", params);
    const res = await ctx.fetch(url, {
      headers: { "User-Agent": UA, Authority: "www.douyin.com", Accept: "application/json, text/plain, */*", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8", Cookie: DEFAULT_COOKIE, Referer: `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=live` },
      timeout: 2e4,
      http2: true
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let resp;
    try {
      resp = await res.json();
    } catch {
      throw new Error("\u6296\u97F3\u641C\u7D22\u88AB\u98CE\u63A7");
    }
    const list = [];
    for (const item of resp.data ?? []) {
      const raw = item.lives?.rawdata;
      if (!raw) continue;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      const owner = parsed.owner;
      if (!owner?.web_rid) continue;
      list.push({
        platform: "douyin",
        roomId: owner.web_rid,
        title: parsed.title ?? "",
        cover: parsed.cover?.url_list?.[0],
        uname: owner.nickname,
        avatar: owner.avatar_thumb?.url_list?.[0],
        online: parseDisplayCount(parsed.stats?.total_user_str),
        live: (parsed.status ?? 0) === 2,
        link: `https://live.douyin.com/${owner.web_rid}`
      });
    }
    return { list, hasMore: list.length >= 10 };
  }
  async function fetchEnter(ctx, webRid) {
    const params = { aid: "6383", app_name: "douyin_web", live_id: "1", device_platform: "web", language: "zh-CN", browser_language: "zh-CN", browser_platform: "Win32", browser_name: "Chrome", browser_version: "125.0.0.0", web_rid: webRid, msToken: "" };
    const url = buildUrl("https://live.douyin.com/webcast/room/web/enter/", params);
    const signed = signUrl(url);
    const headers = { "User-Agent": UA, Authority: AUTHORITY, Referer: `https://live.douyin.com/${webRid}`, Cookie: DEFAULT_COOKIE };
    const res = await ctx.fetch(signed, { headers, timeout: 2e4, http2: true });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data;
  }
  async function getRoomDetail(ctx, { roomId }) {
    const data = await fetchEnter(ctx, roomId);
    const r = data?.data?.[0];
    if (!r) throw new Error("\u6296\u97F3\u672A\u8FD4\u56DE\u623F\u95F4\u6570\u636E");
    const live = (r.status ?? 0) === 2;
    return {
      platform: "douyin",
      roomId,
      title: r.title ?? "",
      cover: live ? r.cover?.url_list?.[0] : void 0,
      uname: live ? r.owner?.nickname : data?.user?.nickname,
      avatar: live ? r.owner?.avatar_thumb?.url_list?.[0] : data?.user?.avatar_thumb?.url_list?.[0],
      online: parseDisplayCount(r.room_view_stats?.display_value),
      introduction: r.owner?.signature,
      live,
      link: `https://live.douyin.com/${roomId}`
    };
  }
  async function getLiveStatus(ctx, { roomId }) {
    try {
      const d = await getRoomDetail(ctx, { roomId });
      return d.live;
    } catch {
      return false;
    }
  }
  function pickStreamUrls(stream) {
    const qualities = stream.live_core_sdk_data?.pull_data?.options?.qualities ?? [];
    const streamDataStr = stream.live_core_sdk_data?.pull_data?.stream_data ?? "";
    const alts = [];
    let primary = "", type = "hls";
    if (streamDataStr.startsWith("{")) {
      let parsed = {};
      try {
        parsed = JSON.parse(streamDataStr);
      } catch {
      }
      const qData = parsed.data ?? {};
      for (const q of qualities) {
        const main = q.sdk_key ? qData[q.sdk_key]?.main : void 0;
        const hls = main?.hls, flv = main?.flv;
        if (hls) {
          alts.push({ qn: String(q.level), label: q.name, url: hls });
          if (!primary) {
            primary = hls;
            type = "hls";
          }
        } else if (flv) {
          alts.push({ qn: String(q.level), label: q.name, url: flv });
          if (!primary) {
            primary = flv;
            type = "flv";
          }
        }
      }
    } else {
      const flvList = Object.values(stream.flv_pull_url ?? {});
      const hlsList = Object.values(stream.hls_pull_url_map ?? {});
      for (const q of qualities) {
        const hlsIdx = hlsList.length - q.level, flvIdx = flvList.length - q.level;
        const hlsUrl = hlsIdx >= 0 && hlsIdx < hlsList.length ? hlsList[hlsIdx] : "";
        const flvUrl = flvIdx >= 0 && flvIdx < flvList.length ? flvList[flvIdx] : "";
        const chosen = hlsUrl || flvUrl;
        if (!chosen) continue;
        alts.push({ qn: String(q.level), label: q.name, url: chosen });
        if (!primary) {
          primary = chosen;
          type = hlsUrl ? "hls" : "flv";
        }
      }
    }
    return { primary, type, alts };
  }
  async function resolve(ctx, { roomId }) {
    const data = await fetchEnter(ctx, roomId);
    const r = data?.data?.[0];
    if (!r) throw new Error("\u6296\u97F3\u672A\u8FD4\u56DE\u623F\u95F4\u6570\u636E");
    if ((r.status ?? 0) !== 2) throw new Error("\u6296\u97F3\u76F4\u64AD\u95F4\u672A\u5F00\u64AD");
    const stream = r.stream_url;
    if (!stream) throw new Error("\u6296\u97F3\u672A\u8FD4\u56DE stream_url");
    const picked = pickStreamUrls(stream);
    if (!picked.primary) throw new Error("\u6296\u97F3\u672A\u5339\u914D\u5230\u53EF\u64AD\u6D41");
    const opts = { url: picked.primary, qn: picked.alts[0]?.qn, qnLabel: picked.alts[0]?.label, alternatives: picked.alts.length > 0 ? picked.alts : void 0, referer: REFERER + "/", ua: UA };
    if (picked.type === "flv") return ctx.protocols.flvStream(opts);
    return ctx.protocols.hlsStream(opts);
  }
  return __toCommonJS(douyin_exports);
})();
return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };
