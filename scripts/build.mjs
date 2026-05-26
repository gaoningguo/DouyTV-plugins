/**
 * 构建脚本 —— 把 plugins/*.js 打包成 dist/{id}.js
 *
 * 插件格式要求：每个 .js 必须用 ES module 语法 export const manifest = {...}
 * 以及 export async function resolve / getRecommend / search / ...
 *
 * 用法：
 *   node scripts/build.mjs          # 构建全部
 *   node scripts/build.mjs --only kick  # 只构建 kick
 */
import { readdirSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { build } from "esbuild";

const ROOT = resolve(import.meta.dirname, "..");
const PLUGINS_DIR = join(ROOT, "plugins");
const DIST_DIR = join(ROOT, "dist");

const onlyArg = process.argv.indexOf("--only");
const onlyId = onlyArg !== -1 ? process.argv[onlyArg + 1] : null;

if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });

const files = readdirSync(PLUGINS_DIR)
  .filter((f) => f.endsWith(".js") && !f.startsWith("_"))
  .map((f) => f.replace(/\.js$/, ""))
  .filter((id) => !onlyId || id === onlyId);

if (files.length === 0) {
  console.log("No plugins to build.");
  process.exit(0);
}

const index = [];

for (const id of files) {
  const entry = join(PLUGINS_DIR, `${id}.js`);
  const outfile = join(DIST_DIR, `${id}.js`);
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    globalName: "__plugin__",
    footer: {
      js: "return { manifest: __plugin__.manifest, resolve: __plugin__.resolve, getRecommend: __plugin__.getRecommend, search: __plugin__.search, getCategories: __plugin__.getCategories, getCategoryRooms: __plugin__.getCategoryRooms, getRoomDetail: __plugin__.getRoomDetail, getLiveStatus: __plugin__.getLiveStatus };",
    },
    banner: { js: '"use strict";' },
    outfile,
    platform: "neutral",
    target: "es2020",
    minify: false,
  });

  try {
    const mod = await import(`file://${entry}`);
    const m = mod.manifest;
    if (m?.id && m?.label) {
      index.push({
        id: m.id,
        label: m.label,
        version: m.version ?? "1.0.0",
        adult: m.adult ?? false,
        defaultProxy: m.defaultProxy ?? "direct",
        file: `${id}.js`,
      });
    }
  } catch (e) {
    console.warn(`⚠ ${id}: failed to read manifest:`, e.message);
    index.push({ id, label: id, version: "1.0.0", adult: false, file: `${id}.js` });
  }

  console.log(`✓ ${id} → dist/${id}.js`);
}

writeFileSync(join(DIST_DIR, "index.json"), JSON.stringify(index, null, 2));
console.log(`\n✓ dist/index.json (${index.length} plugins)`);
