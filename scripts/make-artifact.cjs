// Builds one self-contained HTML page of the web game (for the shareable playable link).
// Usage: node scripts/make-artifact.cjs <out.html>
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

execSync('npx vite build --mode artifact', { stdio: 'inherit' });
const dir = 'dist-artifact';
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const assets = fs.readdirSync(path.join(dir, 'assets'));
const js = assets.filter((f) => f.endsWith('.js'));
if (js.length !== 1) throw new Error(`expected one JS file, got ${js.join(', ')}`);
const css = fs.readFileSync(path.join(dir, 'assets', assets.find((f) => f.endsWith('.css'))), 'utf8');
const code = fs.readFileSync(path.join(dir, 'assets', js[0]), 'utf8');
if (code.includes('</script')) throw new Error('script contains a closing tag');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/\s*<script type="module"[^>]*><\/script>/, '');
const out = `<title>Patikaç</title>\n<style>${css}</style>\n${body}\n<script type="module">${code}</script>\n`;
fs.writeFileSync(process.argv[2], out);
console.log(`${process.argv[2]}: ${(out.length / 1024).toFixed(0)} KB`);
