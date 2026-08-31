// 许愿树 PWA 构建脚本 (Node.js)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- 生成 PNG 图标 ----
function genPngIcon() {
  const W = 512, H = 512;
  const pixels = Buffer.alloc(W * H * 4, 0);
  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    if (a === 255) { pixels[i]=r; pixels[i+1]=g; pixels[i+2]=b; pixels[i+3]=255; return; }
    const srcA = a / 255, dstA = pixels[i+3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;
    pixels[i]   = Math.round((r * srcA + pixels[i]   * dstA * (1 - srcA)) / outA);
    pixels[i+1] = Math.round((g * srcA + pixels[i+1] * dstA * (1 - srcA)) / outA);
    pixels[i+2] = Math.round((b * srcA + pixels[i+2] * dstA * (1 - srcA)) / outA);
    pixels[i+3] = Math.round(outA * 255);
  }
  function fillCircle(cx, cy, radius, r, g, b, a) {
    const r2 = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius)), maxX = Math.min(W - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius)), maxY = Math.min(H - 1, Math.ceil(cy + radius));
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) setPixel(x, y, r, g, b, a);
  }
  function fillRoundRect(x, y, w, h, rx, r, g, b, a) {
    const rx2 = rx * rx;
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) {
        let inside = true;
        if (dx < rx && dy < rx && (dx-rx)*(dx-rx) + (dy-rx)*(dy-rx) > rx2) inside = false;
        else if (dx >= w - rx && dy < rx && (dx-(w-1-rx))*(dx-(w-1-rx)) + (dy-rx)*(dy-rx) > rx2) inside = false;
        else if (dx < rx && dy >= h - rx && (dx-rx)*(dx-rx) + (dy-(h-1-rx))*(dy-(h-1-rx)) > rx2) inside = false;
        else if (dx >= w - rx && dy >= h - rx && (dx-(w-1-rx))*(dx-(w-1-rx)) + (dy-(h-1-rx))*(dy-(h-1-rx)) > rx2) inside = false;
        if (inside) setPixel(x + dx, y + dy, r, g, b, a);
      }
  }
  // 绿底
  fillRoundRect(0, 0, W, H, 100, 91, 140, 90, 255);
  // 树冠
  [{cx:256,cy:170,r:130,c:0x7EC87B},{cx:175,cy:230,r:95,c:0x6DAF68},{cx:337,cy:230,r:95,c:0x6DAF68},
   {cx:220,cy:150,r:80,c:0x8FD88D},{cx:298,cy:155,r:75,c:0x8FD88D},{cx:256,cy:120,r:65,c:0xA0E898}]
    .forEach(l => fillCircle(l.cx, l.cy, l.r, (l.c>>16)&0xFF, (l.c>>8)&0xFF, l.c&0xFF, 220));
  // 树干 + 根
  fillRoundRect(236, 285, 40, 140, 10, 196, 149, 106, 255);
  fillRoundRect(220, 400, 72, 30, 14, 160, 114, 74, 255);
  // 编码
  const raw = Buffer.alloc((1 + W * 4) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    pixels.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const cmp = zlib.deflateSync(raw);
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < 256; i++) { let cc = i; for (let k = 0; k < 8; k++) cc = (cc & 1) ? (0xEDB88320 ^ (cc >>> 1)) : (cc >>> 1); crc32.table = crc32.table || []; crc32.table[i] = cc; }
    for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(t, d) {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length, 0);
    const tb = Buffer.from(t), ci = Buffer.concat([tb, d]), crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(ci), 0);
    return Buffer.concat([len, tb, d, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', cmp), chunk('IEND', Buffer.alloc(0))]);
  return 'data:image/png;base64,' + png.toString('base64');
}

// ---- 构建 ----
const base = __dirname;
let html = fs.readFileSync(path.join(base, 'src/index.html'), 'utf-8');
const css = fs.readFileSync(path.join(base, 'src/styles.css'), 'utf-8');
const js = fs.readFileSync(path.join(base, 'src/app.js'), 'utf-8');

// 生成 PNG 图标并替换占位符
const iconDataUri = genPngIcon();
html = html.replace('__ICON_PNG__', () => iconDataUri);
html = html.replace('__MANIFEST_ICON_PNG__', () => encodeURIComponent(iconDataUri));

let result = html;
result = result.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + css + '\n</style>');
result = result.replace('<script src="app.js"></script>', () => '<script>\n' + js + '\n</script>');

const outDir = path.join(base, 'dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'wish-tree.html');
fs.writeFileSync(outFile, result, 'utf-8');

console.log('✅ 构建完成: ' + outFile);
console.log('   ' + result.length + ' bytes');
console.log('   ' + result.split('\n').length + ' lines');
console.log('   🎨 PNG icon: ' + iconDataUri.length + ' chars');
