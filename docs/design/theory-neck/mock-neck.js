// Mock-up only: draws a vertical neck in the key dial's place in Theory and
// animates the swap, inside the running app so it uses the real look.
(() => {
  const box = document.querySelector('[class*="dialBox"]');
  if (!box) return 'no dial box';
  const dial = box.querySelector('svg');
  const stage = box.parentElement;
  const rect = stage.getBoundingClientRect();
  const W = Math.round(rect.width), H = Math.round(rect.height);

  // Take the dial's own accent colour, so the neck speaks its language.
  const nums = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const colourful = (c) => { const v = nums(c); return v.length >= 3 && Math.max(v[0], v[1], v[2]) - Math.min(v[0], v[1], v[2]) > 25; };
  const count = {};
  dial.querySelectorAll('*').forEach((el) => {
    const cs = getComputedStyle(el);
    for (const c of [cs.stroke, cs.fill]) if (c && c !== 'none' && colourful(c)) count[c] = (count[c] || 0) + 1;
  });
  const gold = (Object.entries(count).sort((a, b) => b[1] - a[1])[0] || ['rgb(232, 214, 140)'])[0];
  const [gr, gg, gb] = nums(gold);
  const g = (a) => `rgba(${gr}, ${gg}, ${gb}, ${a})`;

  // Strings left to right as in a chord chart: low E on the left, nut at the top.
  const strings = [40, 45, 50, 55, 59, 64];
  const names = ['E', 'A', 'D', 'G', 'B', 'e'];
  const gap = Math.min(54, Math.max(40, W * 0.085));
  const neckW = gap * 5;
  const x0 = Math.round((W - neckW) / 2) + 10;
  const xs = strings.map((_, i) => x0 + i * gap);
  const yNames = 30, yOpen = 62, y0 = 86, yEnd = H - 80;
  const L = yEnd - y0;
  const pos = (n) => y0 + (L * (1 - 2 ** (-n / 12))) / 0.5;
  const mid = (n) => (pos(n - 1) + pos(n)) / 2;
  // C major, by root: each note of the key wears its chord's numeral.
  const key = { 0: ['I', 'tonic'], 2: ['ii', 'minor'], 4: ['iii', 'minor'], 5: ['IV', 'major'], 7: ['V', 'major'], 9: ['vi', 'minor'], 11: ['vii°', 'dim'] };

  const marker = (x, y, [label, kind]) => {
    let circle, text;
    if (kind === 'tonic') { circle = 'fill: var(--text-primary)'; text = 'fill: rgb(18, 20, 18)'; }
    else if (kind === 'major') { circle = `fill: ${g(0.34)}; stroke: ${g(0.95)}; stroke-width: 1.3`; text = 'fill: var(--text-primary)'; }
    else if (kind === 'minor') { circle = `fill: ${g(0.07)}; stroke: ${g(0.7)}; stroke-width: 1.1`; text = 'fill: var(--text-primary)'; }
    else { circle = 'fill: rgba(0, 0, 0, 0.25); stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 2.5 2.5'; text = 'fill: var(--text-muted)'; }
    const fs = label.length >= 3 ? 9.5 : 11;
    return `<circle cx="${x}" cy="${y}" r="13.5" style="${circle}"/><text x="${x}" y="${y + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="600" style="${text}">${label}</text>`;
  };

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="font-family: var(--font-sans); display: block">`;
  names.forEach((n, i) => { s += `<text x="${xs[i]}" y="${yNames}" text-anchor="middle" font-size="12" style="fill: var(--text-muted); letter-spacing: .08em">${n}</text>`; });
  for (let n = 1; n <= 12; n++) s += `<line x1="${x0 - 8}" x2="${x0 + neckW + 8}" y1="${pos(n)}" y2="${pos(n)}" stroke-width="${n === 12 ? 1.6 : 1}" style="stroke: var(--text-muted); opacity: ${n === 12 ? 0.6 : 0.35}"/>`;
  s += `<line x1="${x0 - 8}" x2="${x0 + neckW + 8}" y1="${y0}" y2="${y0}" stroke-width="3" style="stroke: var(--text-primary); opacity: .7"/>`;
  xs.forEach((x, i) => { s += `<line x1="${x}" x2="${x}" y1="${y0}" y2="${yEnd}" stroke-width="${1.7 - i * 0.16}" style="stroke: var(--text-primary); opacity: .5"/>`; });
  const cx = x0 + neckW / 2;
  for (const n of [3, 5, 7, 9]) s += `<circle cx="${cx}" cy="${mid(n)}" r="3.5" style="fill: var(--text-muted); opacity: .45"/>`;
  for (const dx of [-gap, gap]) s += `<circle cx="${cx + dx}" cy="${mid(12)}" r="3.5" style="fill: var(--text-muted); opacity: .45"/>`;
  for (let n = 1; n <= 12; n++) s += `<text x="${x0 - 28}" y="${mid(n) + 4}" text-anchor="end" font-size="11" style="fill: var(--text-muted); opacity: ${[3, 5, 7, 9, 12].includes(n) ? 0.95 : 0.5}">${n}</text>`;
  strings.forEach((open, i) => {
    for (let f = 0; f <= 12; f++) {
      const k = key[(open + f) % 12];
      if (k) s += marker(xs[i], f === 0 ? yOpen : mid(f), k);
    }
  });
  const ly = H - 34;
  const items = [['I', 'tonic', 'home'], ['IV', 'major', 'major'], ['ii', 'minor', 'minor'], ['vii°', 'dim', 'diminished']];
  const lx = W / 2 - 226;
  items.forEach(([label, kind, word], i) => {
    const x = lx + i * 118;
    s += marker(x, ly, [label, kind]) + `<text x="${x + 21}" y="${ly + 4}" font-size="11" style="fill: var(--text-muted); letter-spacing: .06em">${word}</text>`;
  });
  s += '</svg>';

  if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
  const overlay = document.createElement('div');
  overlay.innerHTML = s;
  Object.assign(overlay.style, { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', opacity: '0', transform: 'translateY(14px)', transition: 'opacity 280ms ease-out, transform 320ms cubic-bezier(.2,.7,.2,1)', pointerEvents: 'none' });
  stage.appendChild(overlay);
  Object.assign(dial.style, { transition: 'opacity 220ms ease-out, transform 320ms cubic-bezier(.2,.7,.2,1)', transformOrigin: '50% 50%' });

  const btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase() === t);
  const d = btn('dial'), n = btn('neck');
  if (d && n) { const c = d.className; d.className = n.className; n.className = c; }
  const p = [...document.querySelectorAll('p')].find((el) => /seven chords sit in one window/.test(el.textContent));
  if (p) p.textContent = 'The same seven chords, by root, across the whole neck. Find any I: IV and V are always one string away.';

  void overlay.offsetHeight;
  requestAnimationFrame(() => {
    dial.style.opacity = '0';
    dial.style.transform = 'scale(.92) rotate(-10deg)';
    overlay.style.opacity = '1';
    overlay.style.transform = 'none';
  });
  return { W, H, gold, gap: Math.round(gap), caption: !!p, switched: !!(d && n) };
})()
