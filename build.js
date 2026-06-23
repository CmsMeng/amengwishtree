// 许愿树 PWA 构建脚本 (Node.js)
const fs = require('fs');
const path = require('path');

const base = __dirname;
const html = fs.readFileSync(path.join(base, 'src/index.html'), 'utf-8');
const css = fs.readFileSync(path.join(base, 'src/styles.css'), 'utf-8');
const js = fs.readFileSync(path.join(base, 'src/app.js'), 'utf-8');

let result = html;
// 用函数回调代替字符串替换，避免 JS 把 $$ 当转义符吃掉
result = result.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + css + '\n</style>');
result = result.replace('<script src="app.js"></script>', () => '<script>\n' + js + '\n</script>');

const outDir = path.join(base, 'dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'wish-tree.html');
fs.writeFileSync(outFile, result, 'utf-8');

console.log('✅ 构建完成: ' + outFile);
console.log('   ' + result.length + ' bytes');
console.log('   ' + result.split('\n').length + ' lines');
