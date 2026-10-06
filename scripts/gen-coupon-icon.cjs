// 纯 Node.js 生成优惠券 tabBar 图标（81x81 RGBA PNG）
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 81, H = 81;

// ---- PNG 编码 ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function createPNG(pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    pixels.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---- 绘图 ----
function inRoundedRect(x, y, x1, y1, x2, y2, r) {
  if (x < x1 || x > x2 || y < y1 || y > y2) return false;
  if (x < x1 + r && y < y1 + r) return Math.hypot(x - (x1 + r), y - (y1 + r)) <= r;
  if (x > x2 - r && y < y1 + r) return Math.hypot(x - (x2 - r), y - (y1 + r)) <= r;
  if (x < x1 + r && y > y2 - r) return Math.hypot(x - (x1 + r), y - (y2 - r)) <= r;
  if (x > x2 - r && y > y2 - r) return Math.hypot(x - (x2 - r), y - (y2 - r)) <= r;
  return true;
}

function drawCoupon([r, g, b], outPath) {
  const px = Buffer.alloc(W * H * 4); // 默认全透明
  const set = (x, y, pr, pg, pb, pa) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    px[i] = pr; px[i + 1] = pg; px[i + 2] = pb; px[i + 3] = pa;
  };

  const left = 12, right = 69, top = 20, bottom = 61, radius = 6;
  // 主体圆角矩形
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++)
      if (inRoundedRect(x, y, left, top, right, bottom, radius))
        set(x, y, r, g, b, 255);

  // 左右半圆缺口（透明挖空）
  const cy = (top + bottom) >> 1;
  const notchR = 6;
  for (let y = -notchR; y <= notchR; y++)
    for (let x = -notchR; x <= notchR; x++)
      if (x * x + y * y <= notchR * notchR) {
        set(left + x, cy + y, 0, 0, 0, 0);
        set(right + x, cy + y, 0, 0, 0, 0);
      }

  // 中间虚线撕痕（白色半透明）
  const midX = left + 28;
  const dash = 3, gap = 3;
  for (let y = top + 5; y < bottom - 4; y += dash + gap)
    for (let dy = 0; dy < dash; dy++)
      set(midX, y + dy, 255, 255, 255, 200);

  // 右侧白色圆点（金额标识）
  const dotCx = midX + 15, dotCy = cy, dotR = 5;
  for (let y = -dotR; y <= dotR; y++)
    for (let x = -dotR; x <= dotR; x++)
      if (x * x + y * y <= dotR * dotR)
        set(dotCx + x, dotCy + y, 255, 255, 255, 255);

  fs.writeFileSync(outPath, createPNG(px));
  console.log('wrote', outPath);
}

const dir = process.argv[2];
drawCoupon([153, 153, 153], path.join(dir, 'coupon.png'));
drawCoupon([255, 107, 44], path.join(dir, 'coupon-selected.png'));
