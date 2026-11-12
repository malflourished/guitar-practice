/*
 * Key dial: one circle for keys and chords. A design mock-up for vibrato~;
 * see README.md in this folder.
 *
 * Framework-free so the mock-up opens straight from disk. The app version
 * should be a React component with this geometry, with the music logic
 * (spelling, the windows, borrowed and dominant chords) moved into
 * src/lib/music and tested in all twelve keys.
 */
(function (global) {
  'use strict';

  /* ── Music ──────────────────────────────────────────────────────────── */

  const LETTERS = 'CDEFGAB';
  const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const MINOR = [0, 2, 3, 5, 7, 8, 10];
  /** Major keys clockwise from the top, as the dial prints them. */
  const PRIMARY = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  /** The one position printed both ways: six sharps or six flats. */
  const ALTERNATE = { 6: 'G♭' };

  const mod = (n, m) => ((n % m) + m) % m;

  function parse(name) {
    let acc = 0;
    for (const ch of name.slice(1)) acc += ch === '♯' ? 1 : ch === '♭' ? -1 : 0;
    return { letter: name[0], acc };
  }

  function pitch(name) {
    const { letter, acc } = parse(name);
    return mod(NATURAL[letter] + acc, 12);
  }

  /** Position of a major key on the dial: 0 is C at the top, then clockwise in fifths. */
  const posOf = (major) => mod(pitch(major) * 7, 12);

  const write = (letter, acc) => letter + (acc > 0 ? '♯'.repeat(acc) : '♭'.repeat(-acc));

  /** Spell a scale letter by letter, so every degree gets its own letter name. */
  function scale(tonic, steps) {
    const start = LETTERS.indexOf(parse(tonic).letter);
    const root = pitch(tonic);
    return steps.map((step, degree) => {
      const letter = LETTERS[(start + degree) % 7];
      let acc = mod(root + step - NATURAL[letter], 12);
      if (acc > 6) acc -= 12;
      return write(letter, acc);
    });
  }

  /** How hard a scale is to read: one point per accidental, a lot for a double. */
  const readingCost = (notes) =>
    notes.reduce((total, note) => {
      const acc = Math.abs(parse(note).acc);
      return total + acc + (acc > 1 ? 100 : 0);
    }, 0);

  /** The name for a tonic whose scale is easiest to read (D♭ minor becomes C♯ minor). */
  function simplest(tonic, steps) {
    const p = pitch(tonic);
    let best = tonic;
    let bestCost = readingCost(scale(tonic, steps));
    for (const letter of LETTERS) {
      let acc = mod(p - NATURAL[letter], 12);
      if (acc > 6) acc -= 12;
      if (Math.abs(acc) > 1) continue;
      const name = write(letter, acc);
      const cost = readingCost(scale(name, steps));
      if (cost < bestCost) {
        best = name;
        bestCost = cost;
      }
    }
    return best;
  }

  function signature(major) {
    const notes = scale(major, MAJOR);
    const sharps = notes.filter((n) => n.includes('♯')).length;
    const flats = notes.filter((n) => n.includes('♭')).length;
    if (sharps) return `${sharps}♯`;
    if (flats) return `${flats}♭`;
    return '0';
  }

  const NUMERALS = {
    major: ['IV', 'I', 'V', 'ii', 'vi', 'iii', 'vii°'],
    minor: ['VI', 'III', 'VII', 'iv', 'i', 'v', 'ii°'],
    fromParallelMinor: ['♭VI', '♭III', '♭VII', 'iv', 'i', 'v', 'ii°'],
    fromParallelMajor: ['IV', 'I', 'V', 'ii', 'vi', 'iii', 'vii°'],
  };

  /**
   * The seven chords of a key signature, by ring and position. Majors IV I V
   * sit side by side on the outer ring, their relative minors (ii vi iii)
   * directly inside, and vii° under V. The same shape fits every key.
   */
  function windowCells(major, numerals) {
    const k = posOf(major);
    const n = scale(major, MAJOR);
    return [
      ['major', k - 1, n[3]],
      ['major', k, n[0]],
      ['major', k + 1, n[4]],
      ['minor', k - 1, `${n[1]}m`],
      ['minor', k, `${n[5]}m`],
      ['minor', k + 1, `${n[2]}m`],
      ['dim', k + 1, `${n[6]}°`],
    ].map(([ring, pos, label], i) => ({ ring, pos: mod(pos, 12), label, numeral: numerals[i] }));
  }

  /** Everything the dial shows for a state: { key, mode, view }. */
  function describe(state) {
    const major = state.key;
    const k = posOf(major);
    const notes = scale(major, MAJOR);
    const minorMode = state.mode === 'minor';
    const tonic = minorMode ? notes[5] : major;
    const sig = signature(major);
    const main = windowCells(major, minorMode ? NUMERALS.minor : NUMERALS.major);
    for (const cell of main) cell.home = cell.ring === state.mode && cell.pos === k;

    let extra = [];
    let ghost = null;
    let caption;
    const turning = 'Clockwise adds a sharp (the new 7th). Counter-clockwise adds a flat (the new 4th).';

    // A parallel key may be respelled to stay readable (G♭ minor is written F♯ minor);
    // the captions then use that spelling throughout, so the example chords match.
    if (state.view === 'borrowed' && !minorMode) {
      const parallel = simplest(major, MINOR);
      extra = windowCells(scale(parallel, MINOR)[2], NUMERALS.fromParallelMinor);
      ghost = -90;
      const [flatSix, , flatSeven] = extra;
      caption = [
        `Three steps counter-clockwise is ${parallel} minor: the same home, in the dark.`,
        `♭VI, ♭VII and iv are the chords most often borrowed. Try ${parallel} – ${flatSix.label} – ${flatSeven.label} – ${parallel}.`,
      ];
    } else if (state.view === 'borrowed') {
      const parallel = simplest(tonic, MAJOR);
      extra = windowCells(parallel, NUMERALS.fromParallelMajor);
      ghost = 90;
      const [four, , five] = extra;
      caption = [
        `Three steps clockwise is ${parallel} major, the same home in daylight.`,
        `Its V, ${five.label}, gives the minor key a leading tone. Its IV, ${four.label}, is the Dorian colour: try ${parallel}m – ${four.label} – ${parallel}m.`,
      ];
    } else if (state.view === 'dominants') {
      const names = minorMode ? ['V/VII', 'V/iv', 'V', 'V/v'] : ['V/V', 'V/ii', 'V/vi', 'V/iii'];
      const roots = [notes[1], notes[5], notes[2], notes[6]];
      extra = roots.map((root, i) => ({ ring: 'major', pos: mod(k + 2 + i, 12), label: `${root}7`, numeral: names[i] }));
      ghost = 'dominants';
      caption = minorMode
        ? [
            'Clockwise of the window sit the dominants.',
            `${notes[2]}7 is the V that pulls hardest to ${tonic} minor. ${notes[5]}7 leads to iv, ${notes[6]}7 to v.`,
          ]
        : [
            'Clockwise of V sit the secondary dominants.',
            `Walk them back, ${notes[6]}7 → ${notes[2]}7 → ${notes[5]}7 → ${notes[1]}7 → ${notes[4]}7 → ${major}, and each chord falls a fifth into the next.`,
          ];
    } else {
      caption = minorMode
        ? [`${tonic} minor shares ${major} major's window: the same seven chords, with home moved to i.`, turning]
        : [`${major} major's seven chords sit in one window. Turn the dial: the same shape fits every key.`, turning];
    }

    return {
      state: { ...state },
      k,
      major,
      tonic,
      sig,
      main,
      extra,
      ghost,
      caption,
      plate: {
        key: tonic,
        sub: (minorMode ? 'MINOR' : 'MAJOR') + (sig === '0' ? '' : ` · ${sig}`),
        rel: minorMode ? `relative ${major} major` : `relative ${notes[5]} minor`,
      },
    };
  }

  /* ── Drawing ────────────────────────────────────────────────────────── */

  const NS = 'http://www.w3.org/2000/svg';
  const C = 500; // centre of the 1000 × 1000 view box
  const RINGS = {
    major: { r0: 336, r1: 430, font: 44, gap: 9 },
    minor: { r0: 256, r1: 336, font: 30, gap: 7 },
    dim: { r0: 196, r1: 256, font: 22, gap: 6 },
  };
  const SMALL = 20; // numerals, alternates and key signatures
  const CAP = 0.72; // Inter's cap height as a share of the font size

  const STYLE = `
.kd{font-family:Inter,system-ui,sans-serif;overflow:visible;-webkit-user-select:none;user-select:none}
.kd text{text-anchor:middle;fill:var(--kd-ink)}
.kd .hair{fill:none;stroke:var(--kd-ink);vector-effect:non-scaling-stroke}
.kd .tick{stroke:var(--kd-ink);vector-effect:non-scaling-stroke}
.kd .sig{font-size:20px;font-weight:400;letter-spacing:.04em;fill-opacity:.42;transition:fill-opacity .3s}
.kd .sig.home{fill:var(--kd-accent);fill-opacity:1}
.kd .label{font-weight:300;transition:fill-opacity .35s,transform .5s cubic-bezier(.2,.7,.2,1)}
.kd .major .label{font-size:44px;fill-opacity:.58}
.kd .minor .label{font-size:30px;fill-opacity:.42}
.kd .dim .label{font-size:22px;fill-opacity:.3}
.kd .alt{font-size:20px;font-weight:300;fill-opacity:.32;transition:opacity .3s}
.kd .cell:not(.lit):not(.lit2):hover .label{fill-opacity:.85}
.kd .cell.lit .label{fill-opacity:1;font-weight:400}
.kd .cell.lit2 .label{fill:var(--kd-accent-2);fill-opacity:1;font-weight:400}
.kd .cell.home .label{fill:var(--kd-accent)}
.kd .hit{fill:transparent;cursor:pointer}
.kd .dim .hit{cursor:default}
.kd .cell:focus{outline:none}
.kd .cell:focus-visible .label{fill-opacity:1}
.kd .win{fill:var(--kd-window);stroke:var(--kd-accent);stroke-width:1.5;vector-effect:non-scaling-stroke}
.kd .home-cell{fill:var(--kd-home,var(--kd-window));stroke:none}
.kd .sep{fill:none;stroke:var(--kd-accent);stroke-opacity:.3;vector-effect:non-scaling-stroke}
.kd .ghost{fill:none;stroke:var(--kd-accent-2);stroke-width:1.25;stroke-dasharray:5 6;vector-effect:non-scaling-stroke;opacity:0;transition:opacity .4s}
.kd .ghost.on{opacity:.8}
.kd .home-tick{stroke:var(--kd-accent);stroke-width:2.5;vector-effect:non-scaling-stroke}
.kd .numerals{transition:opacity .3s}
.kd .numeral{font-size:20px;font-weight:400;letter-spacing:.06em;fill:var(--kd-accent);fill-opacity:.78}
.kd .numeral.home{fill-opacity:1}
.kd .numeral.secondary{fill:var(--kd-accent-2);fill-opacity:.9}
.kd .plate-key{font-size:150px;font-weight:300;letter-spacing:-.02em}
.kd .plate-sub{font-size:20px;font-weight:400;letter-spacing:.2em;fill-opacity:.6}
.kd .plate-rel{font-size:22px;font-weight:300;fill-opacity:.45}
`;

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
    if (parent) parent.appendChild(node);
    return node;
  }

  const rad = (deg) => (deg * Math.PI) / 180;
  const point = (r, deg) => [C + r * Math.sin(rad(deg)), C - r * Math.cos(rad(deg))];
  const pt = (r, deg) => point(r, deg).map((v) => v.toFixed(2)).join(' ');
  const arc = (r, a0, a1) => `M${pt(r, a0)} A${r} ${r} 0 0 1 ${pt(r, a1)}`;
  const sector = (r0, r1, a0, a1) =>
    `M${pt(r1, a0)} A${r1} ${r1} 0 0 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0} ${r0} 0 0 0 ${pt(r0, a0)} Z`;
  /** The window at the top of the dial: three columns over both rings, plus vii° under V. */
  const windowShape = () =>
    `M${pt(430, -45)} A430 430 0 0 1 ${pt(430, 45)} L${pt(196, 45)} A196 196 0 0 0 ${pt(196, 15)} L${pt(256, 15)} A256 256 0 0 0 ${pt(256, -45)} Z`;

  function defaultLabel(ring, p) {
    if (ring === 'major') return PRIMARY[p];
    const notes = scale(PRIMARY[p], MAJOR);
    return ring === 'minor' ? `${notes[5]}m` : `${notes[2]}°`;
  }

  const defaultSignature = (p) => (p === 6 ? '6♯ 6♭' : signature(PRIMARY[p]));

  function mount(container, options = {}) {
    const state = { key: 'C', mode: 'major', view: 'key', ...(options.initial || {}) };
    const reduced = Boolean(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const svg = el('svg', {
      viewBox: '0 0 1000 1000',
      class: 'kd',
      role: 'group',
      'aria-label': 'Circle of fifths with the chords of the selected key',
    });
    el('style', {}, svg).textContent = STYLE;

    // Bezel: ring lines, minute ticks and key signatures.
    const bezel = el('g', {}, svg);
    for (const [r, opacity] of [[430, 0.24], [336, 0.13], [256, 0.11], [196, 0.22]]) {
      el('circle', { cx: C, cy: C, r, class: 'hair', 'stroke-opacity': opacity }, bezel);
    }
    for (let i = 0; i < 60; i += 1) {
      const long = i % 5 === 0;
      const [x1, y1] = point(long ? 437 : 443, i * 6);
      const [x2, y2] = point(long ? 452 : 448, i * 6);
      el('line', { x1, y1, x2, y2, class: 'tick', 'stroke-opacity': long ? 0.5 : 0.2 }, bezel);
    }
    const sigs = PRIMARY.map((_, p) => {
      const [x, y] = point(476, p * 30);
      return el('text', { x, y: y + (SMALL * CAP) / 2, class: 'sig' }, bezel);
    });

    // The window, drawn at the top and turned to the key.
    const turn = el('g', {}, svg);
    const ghostBorrowed = el('path', { d: windowShape(), class: 'ghost' }, turn);
    const ghostDominants = el('path', { d: sector(336, 430, 45, 165), class: 'ghost' }, turn);
    el('path', { d: windowShape(), class: 'win' }, turn);
    const homeCell = el('path', { class: 'home-cell' }, turn);
    el(
      'path',
      {
        d: `${arc(336, -45, 45)} ${arc(256, 15, 45)} M${pt(256, -15)} L${pt(430, -15)} M${pt(256, 15)} L${pt(430, 15)}`,
        class: 'sep',
      },
      turn,
    );
    const [hx1, hy1] = point(424, 0);
    const [hx2, hy2] = point(462, 0);
    el('line', { x1: hx1, y1: hy1, x2: hx2, y2: hy2, class: 'home-tick' }, turn);

    // One cell per ring and position: a hit area and an upright label.
    const cellLayer = el('g', {}, svg);
    const cells = [];
    for (const ring of ['major', 'minor', 'dim']) {
      const spec = RINGS[ring];
      const rc = (spec.r0 + spec.r1) / 2;
      const capL = spec.font * CAP;
      const capS = SMALL * CAP;
      for (let p = 0; p < 12; p += 1) {
        const [x, y] = point(rc, p * 30);
        const clickable = ring !== 'dim';
        const g = el('g', { class: `cell ${ring}` }, cellLayer);
        if (clickable) {
          g.setAttribute('tabindex', '0');
          g.setAttribute('role', 'button');
        }
        el('path', { d: sector(spec.r0, spec.r1, p * 30 - 15, p * 30 + 15), class: 'hit' }, g);
        const text = defaultLabel(ring, p);
        const label = el('text', { x, y: y + capL / 2, class: 'label' }, g);
        label.textContent = text;
        let alt = null;
        let rest = '';
        if (ALTERNATE[p] && clickable) {
          const shift = (spec.gap + capS) / 2;
          rest = `translate(0px, ${-shift}px)`;
          alt = el('text', { x, y: y + capL / 2 - shift + spec.gap + capS, class: 'alt' }, g);
          alt.textContent = ring === 'major' ? ALTERNATE[p] : `${scale(ALTERNATE[p], MAJOR)[5]}m`;
        }
        label.style.transform = rest;
        const height = capS + spec.gap + capL;
        const cell = {
          ring,
          pos: p,
          g,
          label,
          alt,
          text,
          rest,
          lit: `translate(0px, ${(capS + spec.gap) / 2}px)`,
          x,
          numeralY: y - height / 2 + capS,
        };
        if (clickable) {
          g.setAttribute('aria-label', `${text} ${ring}`);
          g.addEventListener('click', () => select(ring, p));
          g.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              select(ring, p);
            }
          });
        }
        cells.push(cell);
      }
    }

    const numerals = el('g', { class: 'numerals' }, svg);
    const plateKey = el('text', { x: C, y: C + 16, class: 'plate-key' }, svg);
    const plateSub = el('text', { x: C, y: C + 64, class: 'plate-sub' }, svg);
    const plateRel = el('text', { x: C, y: C + 98, class: 'plate-rel' }, svg);
    container.appendChild(svg);

    let angle = null;
    let frame = 0;
    function rotateTo(target, animate) {
      cancelAnimationFrame(frame);
      const delta = angle === null ? 0 : mod(target - angle + 180, 360) - 180;
      if (angle === null || !animate || reduced || Math.abs(delta) < 0.01) {
        angle = angle === null ? target : angle + delta;
        turn.setAttribute('transform', `rotate(${angle} ${C} ${C})`);
        return Promise.resolve();
      }
      const start = angle;
      const duration = 380 + Math.abs(delta) * 2.2;
      const t0 = performance.now();
      return new Promise((resolve) => {
        const tick = (now) => {
          const t = Math.min(1, (now - t0) / duration);
          angle = start + delta * (1 - Math.pow(1 - t, 3));
          turn.setAttribute('transform', `rotate(${angle} ${C} ${C})`);
          if (t < 1) frame = requestAnimationFrame(tick);
          else resolve();
        };
        frame = requestAnimationFrame(tick);
      });
    }

    let token = 0;
    function update(animate) {
      const info = describe(state);
      token += 1;
      const mine = token;

      // Quiet everything, turn the window, then light the chords it lands on.
      for (const cell of cells) {
        cell.g.classList.remove('lit', 'lit2', 'home');
        cell.label.textContent = cell.text;
        cell.label.style.transform = cell.rest;
        if (cell.alt) cell.alt.style.opacity = '';
      }
      numerals.style.opacity = '0';
      sigs.forEach((sig, p) => {
        sig.textContent = p === info.k ? info.sig : defaultSignature(p);
        sig.classList.toggle('home', p === info.k);
      });
      plateKey.textContent = info.plate.key;
      plateSub.textContent = info.plate.sub;
      plateRel.textContent = info.plate.rel;
      ghostBorrowed.classList.toggle('on', state.view === 'borrowed');
      if (typeof info.ghost === 'number') ghostBorrowed.setAttribute('transform', `rotate(${info.ghost} ${C} ${C})`);
      ghostDominants.classList.toggle('on', state.view === 'dominants');
      homeCell.setAttribute('d', state.mode === 'minor' ? sector(256, 336, -15, 15) : sector(336, 430, -15, 15));

      rotateTo(info.k * 30, animate).then(() => {
        if (mine !== token) return;
        while (numerals.firstChild) numerals.firstChild.remove();
        const lit = [...info.extra.map((c) => [c, 'lit2']), ...info.main.map((c) => [c, 'lit'])];
        for (const [c, kind] of lit) {
          const cell = cells.find((x) => x.ring === c.ring && x.pos === c.pos);
          cell.g.classList.remove('lit', 'lit2');
          cell.g.classList.add(kind);
          if (c.home) cell.g.classList.add('home');
          cell.label.textContent = c.label;
          cell.label.style.transform = cell.lit;
          if (cell.alt) cell.alt.style.opacity = '0';
          const numeral = el(
            'text',
            { x: cell.x, y: cell.numeralY, class: `numeral${kind === 'lit2' ? ' secondary' : ''}${c.home ? ' home' : ''}` },
            numerals,
          );
          numeral.textContent = c.numeral;
        }
        // Commit the hidden state first so the fade runs without waiting for a frame.
        void numerals.getBoundingClientRect();
        numerals.style.opacity = '1';
      });

      if (options.onChange) options.onChange(info);
    }

    function select(ring, p) {
      const here = posOf(state.key) === p;
      let key = PRIMARY[p];
      if (here && state.mode === ring && ALTERNATE[p]) key = state.key === PRIMARY[p] ? ALTERNATE[p] : PRIMARY[p];
      else if (here) key = state.key;
      state.key = key;
      state.mode = ring;
      update(true);
    }

    function step(direction) {
      state.key = PRIMARY[mod(posOf(state.key) + direction, 12)];
      update(true);
    }

    update(false);

    return {
      get state() {
        return { ...state };
      },
      set(next) {
        Object.assign(state, next);
        update(true);
      },
      step,
      element: svg,
    };
  }

  global.KeyDial = { mount, describe, scale, posOf, PRIMARY };
})(window);
