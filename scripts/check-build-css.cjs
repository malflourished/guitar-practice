// Guards the built stylesheets against a fault found on 2026-11-21: the
// minifier folded `backdrop-filter` and `-webkit-backdrop-filter` into the
// prefixed property alone, which Electron's Chromium ignores, so the installed
// app had no blur while the dev server did. Run after `vite build`; it fails
// if any prefixed backdrop-filter is left or no real one is found.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'dist', 'assets');
const css = fs.readdirSync(dir).filter((name) => name.endsWith('.css'))
  .map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
const prefixed = (css.match(/-webkit-backdrop-filter:/g) || []).length;
const plain = (css.match(/(?<!-webkit-)backdrop-filter:(?!none)/g) || []).length;
if (prefixed > 0 || plain === 0) {
  console.error(`Built CSS: ${prefixed} prefixed backdrop-filter, ${plain} real ones. The app's blur would be lost.`);
  process.exit(1);
}
console.log(`Built CSS keeps its blur: ${plain} backdrop-filter rules, none prefixed.`);
