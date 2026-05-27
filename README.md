# DouyTV Plugins

DouyTV 网络直播插件库 — 30 个直播平台的独立 JS 插件。

## 项目概述

本仓库为 [DouyTV](https://github.com/user/DouyTV) 提供网络直播平台支持。每个平台（B站/斗鱼/虎牙/Twitch/YouTube 等）是一个独立的 JavaScript 插件文件，通过 DouyTV 的插件订阅系统自动下载和更新。

插件在 DouyTV 客户端内以沙箱方式运行（`new Function` 隔离），通过标准化的 `ctx` 对象访问网络请求、协议构造等能力，无需修改主程序即可扩展新平台。

## 使用方式

在 DouyTV 中：**设置 → 直播管理 → 网络直播 → 添加订阅**，输入本仓库地址：

```
https://github.com/gaoningguo/DouyTV-plugins
```

即可自动导入全部平台插件，并每 12 小时自动同步更新。

## 已支持平台

### 普通平台（12 个）

| 平台 | 文件 | 代理 |
|------|------|------|
| 哔哩哔哩 | bilibili.js | direct |
| 斗鱼 | douyu.js | direct |
| 虎牙 | huya.js | direct |
| 抖音 | douyin.js | direct |
| 快手 | kuaishou.js | direct |
| 网易 CC | cc.js | direct |
| Twitch | twitch.js | proxy |
| YouTube | youtube.js | proxy |
| Kick | kick.js | proxy |
| Trovo | trovo.js | proxy |
| Bigo Live | bigo.js | proxy |
| 17 Live | live17.js | proxy |

### 成人平台（18 个）

| 平台 | 文件 | 代理 |
|------|------|------|
| Chaturbate | chaturbate.js | proxy |
| Stripchat | stripchat.js | proxy |
| BongaCams | bongacams.js | proxy |
| CamSoda | camsoda.js | proxy |
| MyFreeCams | myfreecams.js | proxy |
| Flirt4Free | flirt4free.js | proxy |
| Streamate | streamate.js | proxy |
| Cam4 | cam4.js | proxy |
| Cams.com | camscom.js | proxy |
| XLoveCam | xlovecam.js | proxy |
| DreamCam | dreamcam.js | proxy |
| AmateurTV | amateurtv.js | proxy |
| ManyVids | manyvids.js | proxy |
| Fansly Live | fansly.js | proxy |
| FC2 Live | fc2live.js | proxy |
| PandaTV (韩国) | pandalive.js | proxy |
| SOOP (韩国) | soop.js | proxy |
| SexChat HU | sexchathu.js | proxy |

## 插件开发

### 文件结构

```
plugins/{platform}.js   — 源文件（ES module，开发时编辑这里）
dist/{platform}.js      — 构建产物（IIFE 包装，运行时执行）
dist/index.json         — 插件索引清单（DouyTV 订阅系统读取）
scripts/build.mjs       — esbuild 构建脚本
```

### 插件格式

每个插件文件必须 `return` 一个对象，包含 `manifest` 和至少一个 `resolve` 函数：

```javascript
return {
  manifest: {
    id: "my-platform",       // 唯一标识，用作 key
    label: "我的平台",        // 显示名称
    version: "1.0.0",        // 版本号
    adult: false,            // 是否成人内容（默认隐藏）
    defaultProxy: "direct",  // "direct" | "proxy"（默认网络策略）
  },

  // 必须：解析房间号 → 播放流
  async resolve(ctx, { roomId }) {
    const data = await ctx.fetch(`https://api.example.com/room/${roomId}`);
    const json = await data.json();
    return ctx.protocols.hlsStream({
      url: json.streamUrl,
      referer: "https://example.com",
    });
  },

  // 可选：推荐列表
  async getRecommend(ctx, { page, pageSize }) {
    // return { list: [...], hasMore: true }
  },

  // 可选：搜索
  async search(ctx, { keyword, page }) {
    // return { list: [...], hasMore: true }
  },

  // 可选：分类列表
  async getCategories(ctx) {
    // return [{ id, name, icon? }]
  },

  // 可选：分类下的房间
  async getCategoryRooms(ctx, { categoryId, page }) {
    // return { list: [...], hasMore: true }
  },

  // 可选：房间详情
  async getRoomDetail(ctx, { roomId }) {
    // return { title, streamerName, avatar?, viewerCount?, ... }
  },

  // 可选：在线状态
  async getLiveStatus(ctx, { roomId }) {
    // return { isLive: true }
  },
};
```

### ctx 对象

插件通过 `ctx` 访问宿主能力：

| 方法 | 说明 |
|------|------|
| `ctx.fetch(url, init?)` | HTTP 请求（走 Rust 绕 CORS，自动应用代理设置） |
| `ctx.invoke(cmd, args)` | 调用预定义 Tauri 命令（白名单限制） |
| `ctx.protocols.hlsStream(url, opts?)` | 构造 HLS 播放流对象 |
| `ctx.protocols.flvStream(url, opts?)` | 构造 FLV 播放流对象 |
| `ctx.protocols.mp4Stream(url, opts?)` | 构造 MP4 播放流对象 |
| `ctx.protocols.webrtcStream(url, opts?)` | 构造 WebRTC 播放流对象 |
| `ctx.log.info/warn/error(msg)` | 日志输出 |
| `ctx.utils.buildUrl(base, params)` | URL 拼接 |
| `ctx.utils.sleep(ms)` | 延时 |
| `ctx.utils.base64Encode/Decode(str)` | Base64 编解码 |

### 构建

```bash
npm install
npm run build           # 构建全部插件 → dist/
npm run build:one kick  # 只构建单个插件
```

构建使用 esbuild，将 ES module 源文件打包为 IIFE 格式（自包含，无外部依赖），同时生成 `dist/index.json` 索引。

### 添加新平台

1. 在 `plugins/` 下创建 `{platform-id}.js`
2. 实现 `manifest` + `resolve`（最小可用）
3. 运行 `npm run build:one {platform-id}` 验证
4. 提交 PR，CI 会自动构建并更新 `dist/`

## License

MIT
