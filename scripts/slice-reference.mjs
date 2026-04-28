#!/usr/bin/env node
/**
 * 把 public/assets/reference.jpg 按 4 列布局切出 16 张圆形 PNG。
 * 顺序与 server.js 的 gifts 数组完全一致。
 *
 * 依赖：sharp（在沙盒/本机首次执行时会自动安装）
 *
 * 用法：
 *   node scripts/slice-reference.mjs                     # 用默认坐标
 *   node scripts/slice-reference.mjs --y0=830 --gap=312  # 微调
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const refPathCandidates = [
  path.join(root, 'public/assets/reference.jpg'),
  path.join(root, 'public/assets/reference.png'),
  path.join(root, 'public/assets/reference.webp')
];
const outDir = path.join(root, 'public/assets/gifts');

const giftIdsInOrder = [
  // 行 1 普通礼物
  'lollipop', 'tiramisu', 'confession-bouquet', 'strawberry-cake',
  // 行 2 普通礼物
  'dreamcatcher', 'hot-air-balloon', 'bear-box', 'ferrari',
  // 行 3 冠名礼物（带边框）
  'diamond-ring', 'ferris-wheel', 'cupid-arrow', 'carousel',
  // 行 4 特殊礼物（带边框）
  'unicorn', 'sweet-date', 'romantic-castle', 'world-tour'
];

/** 解析命令行参数，例：--y0=830 --gap=312 */
const args = Object.fromEntries(
  process.argv.slice(2)
    .map((arg) => arg.replace(/^-+/, '').split('='))
    .map(([k, v]) => [k, v ?? 'true'])
);

async function findReference() {
  for (const p of refPathCandidates) {
    try { await fs.access(p); return p; } catch {}
  }
  return null;
}

async function ensureSharp() {
  try {
    return (await import('sharp')).default;
  } catch (err) {
    console.error('sharp 未安装。请先执行: npm install sharp');
    process.exit(1);
  }
}

(async () => {
  const refPath = await findReference();
  if (!refPath) {
    console.error('找不到参考图。请把图保存为 public/assets/reference.jpg / .png / .webp 后再跑。');
    process.exit(1);
  }
  const sharp = await ensureSharp();
  const meta = await sharp(refPath).metadata();
  console.log(`[ref] ${refPath}  ${meta.width} × ${meta.height}`);

  // 默认坐标按你贴的参考图（约 1067 × 2253，4 列、4 行图标）估算。
  // 如果尺寸不同，会按比例自动缩放。
  const W = Number(args.refW || 1067);
  const H = Number(args.refH || 2253);
  const sx = meta.width / W;
  const sy = meta.height / H;

  // 4 列圆心 X（参考宽 1067 下）
  const colsX = [180, 410, 660, 900].map((x) => Math.round(x * sx));
  // 4 行圆心 Y（参考高 2253 下）—— 行 1: 普通; 行 2: 普通; 行 3: 冠名; 行 4: 特殊
  const rowsY = [1100, 1390, 1700, 2080].map((y) => Math.round(y * sy));

  // 圆半径（约 110px @ ref 宽 1067）
  const r = Math.round(Number(args.r || 110) * Math.min(sx, sy));
  const size = r * 2;

  await fs.mkdir(outDir, { recursive: true });

  for (let i = 0; i < giftIdsInOrder.length; i++) {
    const id = giftIdsInOrder[i];
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = colsX[col];
    const cy = rowsY[row];
    const left = Math.max(0, cx - r);
    const top = Math.max(0, cy - r);
    const width = Math.min(size, meta.width - left);
    const height = Math.min(size, meta.height - top);

    const circleSvg = Buffer.from(
      `<svg width="${width}" height="${height}"><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 2}" fill="#fff"/></svg>`
    );

    const out = path.join(outDir, `${id}.png`);
    await sharp(refPath)
      .extract({ left, top, width, height })
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .png()
      .toFile(out);

    console.log(`✓ ${id}.png  ←  ${left},${top}  ${width}×${height}`);
  }

  console.log(`\n切图完成 → ${outDir}`);
  console.log('如果位置不准，加 --refW/--refH/--r/--y0/... 等参数微调，或直接编辑脚本里的 colsX / rowsY。');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
