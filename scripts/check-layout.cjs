// No-scroll check for the single-screen frame (docs/ROADMAP.md, package A).
//
// Loads every mode, Interval drill and Practice state in a hidden window of
// each size and reports, per state: the page height (must equal the window
// height), the neck's top edge (must not move between modes), the board's
// top, height and string gap, the deck height, and any element that spills
// out of its region (a region clips it, so the page would not scroll but the
// control would be cut off). Open menus spill on purpose.
//
// Start the dev server first (npm run dev), then:
//   ./node_modules/.bin/electron scripts/check-layout.cjs
// Options:
//   --sizes 1440x900,1280x720,960x640,1728x1080   window content sizes
//   --themes dark,light,scholar                     Vibrato dark, Vibrato light, Scholar
//   --only scales,intervals-find                    state names (see STATES)
//   --shots all | name,name                         save JPEG screenshots
//   --out dir                                       results.json and screenshots
//   --url http://localhost:5173/
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = arg('out', path.join(os.tmpdir(), 'vibrato-layout-check'));
fs.mkdirSync(OUT, { recursive: true });
const URL = arg('url', 'http://localhost:5173/');
const SIZES = arg('sizes', '1440x900,1280x720,960x640,1728x1080')
  .split(',').map((s) => s.split('x').map(Number));
const THEMES = arg('themes', 'dark').split(',');
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const SHOTS = arg('shots', '');

// A throwaway profile, so the check never touches your saved app state.
app.setPath('userData', path.join(OUT, 'electron-data'));
if (app.dock) app.dock.hide();

const now = new Date().toISOString();
const draft = (block, review = false) => JSON.stringify({
  version: 1, id: 'measure', startedAt: now, root: 'A', bpm: 72, block,
  elapsed: [0, 0, 0, 0].map((_, i) => (i < block ? [120, 180, 120, 180][i] : i === block && review ? [120, 180, 120, 180][i] : 0)),
  ratings: {}, attempts: [], completed: false,
});
const history = JSON.stringify([0, 1, 2, 3, 4].map((i) => ({
  version: 1, id: `h${i}`, startedAt: now, root: 'A', bpm: 72, block: 3,
  elapsed: [120, 180, 120, 180], ratings: {}, attempts: [], completed: true, finishedAt: now,
})));

const mode = (m) => ({ 'vibrato:study-mode': JSON.stringify(m) });
const clickText = (text, scope = '') => `(() => {
  const root = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : 'document'};
  const el = [...root.querySelectorAll('button, summary, [role=button]')].find(b => b.textContent.trim() === ${JSON.stringify(text)});
  if (!el) return 'missing: ' + ${JSON.stringify(text)};
  el.click(); return 'ok';
})()`;

const STATES = [
  { name: 'notes', store: mode('notes') },
  { name: 'scales', store: { ...mode('scales'), 'vibrato:scale-quality': '"minorPentatonic"' } },
  { name: 'scales-major-caged', store: { ...mode('scales'), 'vibrato:scale-quality': '"major"', 'vibrato:scale-system': '"caged"' } },
  { name: 'chords', store: mode('chords') },
  { name: 'progressions', store: mode('progressions') },
  ...['See', 'Shapes', 'Find', 'Ear', 'Shell chords', 'Guide tones'].map((drill) => ({
    name: `intervals-${drill.toLowerCase().replace(' ', '-')}`, store: mode('intervals'),
    actions: [clickText(drill, '[aria-label="Interval drill"]')],
  })),
  ...['Build it', 'Test it'].map((step) => ({
    name: `intervals-shell-${step.toLowerCase().replace(' ', '-')}`, store: mode('intervals'),
    actions: [clickText('Shell chords', '[aria-label="Interval drill"]'), clickText(step, '[aria-label="Interval drill"]')],
  })),
  { name: 'intervals-ear-all12', store: mode('intervals'),
    actions: [clickText('Ear', '[aria-label="Interval drill"]'), clickText('All 12')] },
  { name: 'theory-circle', store: { ...mode('theory'), 'vibrato:theory-topic': '"circle-of-fifths"' } },
  { name: 'theory-wheel', store: { ...mode('theory'), 'vibrato:theory-topic': '"diatonic-chords"' } },
  { name: 'theory-text', store: { ...mode('theory'), 'vibrato:theory-topic': '"chord-construction"' } },
  { name: 'theory-fretboard', store: { ...mode('theory'), 'vibrato:theory-topic': '"circle-of-fifths"' },
    actions: [clickText('Show on fretboard')] },
  { name: 'scales-panel-closed', store: { ...mode('scales'), 'vibrato:side-panel-open': 'false' } },
  { name: 'scales-drawer', store: mode('scales'), actions: [clickText('Panel')] },
  { name: 'scales-theme-menu', store: mode('scales'), actions: [clickText('Theme')] },
  { name: 'scales-key-menu', store: mode('scales'), actions: [clickText('KeyC')] },
  { name: 'scales-focus', store: mode('scales'), actions: [clickText('Focus')] },
  { name: 'practice-landing', store: { ...mode('practice'), 'vibrato:practice-history-v1': history } },
  ...[0, 1, 2, 3].map((block) => ({
    name: `practice-block${block + 1}`,
    store: { ...mode('practice'), 'vibrato:practice-draft-v1': draft(block) },
  })),
  { name: 'practice-review', store: { ...mode('practice'), 'vibrato:practice-draft-v1': draft(3, true) } },
  { name: 'practice-finished', store: { ...mode('practice'), 'vibrato:practice-draft-v1': draft(3), 'vibrato:practice-history-v1': history },
    actions: [clickText('Finish early'), clickText('Save & finish')] },
];

const THEME_STORE = {
  dark: { 'guitar-practice-ui-theme': 'vibrato', 'guitar-practice-vibrato-canvas': 'dark' },
  light: { 'guitar-practice-ui-theme': 'vibrato', 'guitar-practice-vibrato-canvas': 'light' },
  scholar: { 'guitar-practice-ui-theme': 'scholar', 'guitar-practice-vibrato-canvas': 'dark' },
};

const MEASURE = `(() => {
  const rect = (el) => el ? el.getBoundingClientRect() : null;
  const neck = document.querySelector('.fretboardStage');
  const svg = document.querySelector('[data-fretboard-grid] svg');
  const regions = [...document.querySelectorAll('[data-region]')];
  const clipped = [];
  const viewport = { top: 0, left: 0, bottom: innerHeight, right: innerWidth };
  const describe = (el) => (el.getAttribute('aria-label') || el.className?.baseVal || el.className || el.tagName).toString().slice(0, 40) + ' ' + (el.textContent || '').trim().slice(0, 30);
  const check = (scope, box, label) => {
    for (const el of scope.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width * r.height <= 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[data-region="side"]') && label !== 'side') continue;
      const over = Math.max(r.bottom - box.bottom, r.right - box.right, box.top - r.top, box.left - r.left);
      if (over > 1) clipped.push(label + ': ' + describe(el) + ' +' + Math.round(over));
    }
  };
  for (const reg of regions) {
    if (reg.dataset.region === 'side') continue;
    check(reg, reg.getBoundingClientRect(), reg.dataset.region);
  }
  // Anything outside the window (side panel scroll content excluded).
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width * r.height <= 1) continue;
    if (el.closest('[data-region="side"]')) continue;
    if (getComputedStyle(el).position === 'fixed') continue;
    if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1) { clipped.push('window: ' + describe(el) + ' bottom ' + Math.round(r.bottom)); }
  }
  const side = document.querySelector('[data-region="side"]');
  const strings = svg ? [...svg.querySelectorAll('line')].filter(l => l.getAttribute('y1') === l.getAttribute('y2')) : [];
  const ys = strings.map(l => Number(l.getAttribute('y1'))).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
  return {
    page: document.documentElement.scrollHeight,
    pageW: document.documentElement.scrollWidth,
    win: innerHeight,
    neckTop: neck ? Math.round(rect(neck).top * 10) / 10 : null,
    boardTop: svg ? Math.round(rect(svg).top * 10) / 10 : null,
    boardH: svg ? Math.round(rect(svg).height) : null,
    gap: ys.length > 1 ? Math.round((ys[1] - ys[0]) * 10) / 10 : null,
    deckH: (() => { const d = document.querySelector('[data-region="deck"]'); return d ? Math.round(rect(d).height) : null; })(),
    side: side ? { w: Math.round(rect(side).width), scroll: side.scrollHeight > side.clientHeight } : null,
    clipped: [...new Set(clipped)].slice(0, 8),
    clippedCount: clipped.length,
  };
})()`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const win = new BrowserWindow({
    show: false, useContentSize: true, width: 1440, height: 900,
    webPreferences: { backgroundThrottling: false },
  });
  const results = [];
  let loads = 0;
  for (const [w, h] of SIZES) {
    win.setContentSize(w, h);
    for (const theme of THEMES) {
      for (const state of STATES) {
        if (ONLY && !ONLY.includes(state.name)) continue;
        // Set storage on a same-origin page that runs no app code, so the app's
        // own mount effects cannot write the previous state back over it.
        await win.loadURL(`${URL}favicon.svg?n=${++loads}`);
        const store = { ...THEME_STORE[theme], ...state.store };
        await win.webContents.executeJavaScript(`(() => {
          const keep = new Set(${JSON.stringify(Object.keys(store))});
          for (const k of Object.keys(localStorage)) if (k.startsWith('vibrato:') && !k.startsWith('vibrato:texture') && !keep.has(k)) localStorage.removeItem(k);
          const s = ${JSON.stringify(store)};
          for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
        })()`);
        await wait(400);
        await win.loadURL(`${URL}?n=${++loads}`);
        await wait(700);
        for (const action of state.actions || []) {
          const res = await win.webContents.executeJavaScript(`try { ${action} } catch (e) { 'error: ' + e.message }`);
          if (res !== 'ok') console.error(state.name, res);
          await wait(350);
        }
        await wait(300);
        const m = await win.webContents.executeJavaScript(MEASURE);
        m.mode = await win.webContents.executeJavaScript(`localStorage.getItem('vibrato:study-mode')`);
        const row = { size: `${w}x${h}`, theme, state: state.name, ...m };
        results.push(row);
        const flag = m.page !== m.win || m.pageW !== w || m.clippedCount ? '  <-- CHECK' : '';
        console.log(`${row.size} ${theme} ${state.name.padEnd(26)} [${m.mode}] page ${m.page}/${m.win} neckTop ${m.neckTop} boardTop ${m.boardTop} boardH ${m.boardH} gap ${m.gap} deck ${m.deckH} clipped ${m.clippedCount}${flag}`);
        if (m.clippedCount) console.log('    ' + m.clipped.join('\n    '));
        if (SHOTS === 'all' || SHOTS.split(',').includes(state.name)) {
          const image = await win.webContents.capturePage();
          fs.writeFileSync(path.join(OUT, `${w}x${h}-${theme}-${state.name}.jpg`), image.toJPEG(80));
        }
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  app.quit();
}

app.whenReady().then(run).catch((error) => { console.error(error); app.exit(1); });
