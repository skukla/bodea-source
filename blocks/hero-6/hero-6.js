/**
 * Hero-6 — Chronicle Bento Hero
 * AEM Edge Delivery Services block.
 *
 * Table contract (1-column rows; values pipe-delimited where noted):
 *  Row  0  eyebrow label
 *  Row  1  headline (bold → accent green, em → outline stroke)
 *  Row  2  subtitle / description
 *  Row  3  primary CTA link
 *  Row  4  secondary CTA link
 *  Row  5  stat-1  value | label | note
 *  Row  6  stat-2  value | label | note
 *  Row  7  stat-3  value | label | note
 *  Row  8  feature-1  icon | title | description
 *  Row  9  feature-2  icon | title | description
 *  Row 10  feature-3  icon | title | description
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Small HTML element factory. */
function el(tag, cls = '', attrs = {}, children = []) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  children.forEach((c) => { if (c != null) node.append(c); });
  return node;
}

/** SVG element factory. */
function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

/** Read plain text from a block row. */
function rowText(block, idx) {
  const row = block.children[idx];
  if (!row) return '';
  return (row.querySelector('div') || row).innerText?.trim() ?? '';
}

/** Split a block row's text on pipe characters. */
function rowParts(block, idx) {
  return rowText(block, idx).split('|').map((s) => s.trim());
}

/** Read the first anchor element from a block row. */
function rowAnchor(block, idx) {
  return block.children[idx]?.querySelector('a') ?? null;
}

/**
 * Walk the authored headline node, mapping:
 *   <strong> → .h6-headline-accent (green)
 *   <em>     → .h6-headline-outline (stroke text)
 * Avoids innerHTML on authored content.
 */
function transformHeadlineNode(source) {
  const h1 = el('h1', 'h6-headline');
  if (!source) return h1;

  function walk(node, target) {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        target.append(document.createTextNode(child.textContent));
      } else if (child.nodeName === 'STRONG' || child.nodeName === 'B') {
        const span = el('span', 'h6-headline-accent');
        walk(child, span);
        target.append(span);
      } else if (child.nodeName === 'EM' || child.nodeName === 'I') {
        const span = el('span', 'h6-headline-outline');
        walk(child, span);
        target.append(span);
      } else {
        walk(child, target);
      }
    });
  }

  walk(source, h1);
  return h1;
}

/** Build the animated eyebrow pill. */
function buildEyebrow(text) {
  if (!text) return null;
  const dot = el('span', 'h6-eyebrow-dot', { 'aria-hidden': 'true' });
  return el('div', 'h6-eyebrow', {}, [dot, document.createTextNode(` ${text}`)]);
}

/** Build a single stat item. The num element stores data-target for count-up. */
function buildStat(value, label, note) {
  if (!value) return null;
  const numEl = el('div', 'h6-stat-num', { 'data-target': value });
  numEl.textContent = value;
  const labelEl = el('div', 'h6-stat-label', {}, [document.createTextNode(label)]);
  const noteEl = note ? el('div', 'h6-stat-note', {}, [document.createTextNode(note)]) : null;
  return el('div', 'h6-stat', {}, [numEl, labelEl, noteEl].filter(Boolean));
}

/** Build a single feature row with icon, title, and optional description. */
function buildFeature(icon, title, desc) {
  if (!title && !icon) return null;
  const iconEl = el('div', 'h6-feat-icon', { 'aria-hidden': 'true' }, [
    document.createTextNode(icon || '◆'),
  ]);
  const titleEl = el('div', 'h6-feat-title', {}, [document.createTextNode(title || '')]);
  const children = [titleEl];
  if (desc) children.push(el('div', 'h6-feat-desc', {}, [document.createTextNode(desc)]));
  const textWrap = el('div', 'h6-feat-text', {}, children);
  return el('div', 'h6-feat', {}, [iconEl, textWrap]);
}

/**
 * Build the purely decorative orbital SVG animation for the visual bento cell.
 * Three elliptical orbit rings, each with two orbiting dots, plus floating nodes
 * and connecting dashed lines — all driven by SVG animateMotion / animate.
 */
function buildOrbital() {
  const uid = Math.random().toString(36).slice(2, 9);
  const wrap = el('div', 'h6-orbital', { 'aria-hidden': 'true', role: 'presentation' });

  const svg = svgEl('svg', {
    viewBox: '-220 -220 440 440',
    xmlns: SVG_NS,
    'aria-hidden': 'true',
    focusable: 'false',
  });

  // ── Defs ────────────────────────────────────────────────────
  const defs = svgEl('defs');

  const grad = svgEl('radialGradient', {
    id: `h6-cg-${uid}`, cx: '50%', cy: '50%', r: '50%',
  });
  [
    { offset: '0%', color: '#2ebe7a', opacity: '1' },
    { offset: '55%', color: '#1a6640', opacity: '0.5' },
    { offset: '100%', color: '#2ebe7a', opacity: '0' },
  ].forEach(({ offset, color, opacity }) => {
    const stop = svgEl('stop', { offset, 'stop-color': color, 'stop-opacity': opacity });
    grad.append(stop);
  });
  defs.append(grad);

  const glowFilter = svgEl('filter', {
    id: `h6-gf-${uid}`, x: '-50%', y: '-50%', width: '200%', height: '200%',
  });
  const feBlur = svgEl('feGaussianBlur', { stdDeviation: '3', result: 'blur' });
  const feMerge = svgEl('feMerge');
  const feMerge1 = svgEl('feMergeNode', { in: 'blur' });
  const feMerge2 = svgEl('feMergeNode', { in: 'SourceGraphic' });
  feMerge.append(feMerge1, feMerge2);
  glowFilter.append(feBlur, feMerge);
  defs.append(glowFilter);

  svg.append(defs);

  // ── Orbit rings ─────────────────────────────────────────────
  const orbits = [
    {
      rx: 88, ry: 34, rotate: -18, dur: '8s', color: '#2ebe7a', dotR: 5.5,
    },
    {
      rx: 148, ry: 58, rotate: 28, dur: '13s', color: '#5fd49f', dotR: 4,
    },
    {
      rx: 200, ry: 78, rotate: -42, dur: '20s', color: '#a8edcc', dotR: 3,
    },
  ];

  orbits.forEach(({
    rx, ry, rotate, dur, color, dotR,
  }, i) => {
    const pathId = `h6-op-${uid}-${i}`;
    const durNum = parseFloat(dur);
    const halfDur = `${(durNum / 2).toFixed(1)}s`;

    const g = svgEl('g', { transform: `rotate(${rotate})` });

    const path = svgEl('path', {
      id: pathId,
      d: `M ${rx},0 A ${rx},${ry} 0 1 0 ${-rx},0 A ${rx},${ry} 0 1 0 ${rx},0`,
      fill: 'none',
      stroke: 'rgba(46,190,122,0.2)',
      'stroke-width': '1',
    });
    g.append(path);

    [dur, dur].forEach((d, j) => {
      const dot = svgEl('circle', {
        r: String(j === 0 ? dotR : dotR - 1),
        fill: color,
        'fill-opacity': j === 0 ? '0.9' : '0.45',
        filter: j === 0 ? `url(#h6-gf-${uid})` : '',
      });
      const motion = svgEl('animateMotion', {
        dur: d,
        repeatCount: 'indefinite',
        ...(j === 1 ? { begin: `-${halfDur}` } : {}),
      });
      const mpath = svgEl('mpath');
      mpath.setAttributeNS(XLINK_NS, 'xlink:href', `#${pathId}`);
      motion.append(mpath);
      dot.append(motion);
      g.append(dot);
    });

    svg.append(g);
  });

  // ── Floating nodes ──────────────────────────────────────────
  const floatNodes = [
    {
      cx: 62, cy: -115, r: 6, dur: '4.2s',
    },
    {
      cx: -125, cy: 28, r: 4, dur: '5.6s',
    },
    {
      cx: 105, cy: 92, r: 5, dur: '3.8s',
    },
    {
      cx: -68, cy: -148, r: 3.5, dur: '6.1s',
    },
    {
      cx: 170, cy: -42, r: 3, dur: '4.8s',
    },
    {
      cx: -155, cy: -85, r: 2.5, dur: '7s',
    },
  ];

  floatNodes.forEach(({
    cx, cy, r, dur,
  }) => {
    const circle = svgEl('circle', {
      cx: String(cx),
      cy: String(cy),
      r: String(r),
      fill: '#2ebe7a',
      'fill-opacity': '0.45',
    });
    const anim = svgEl('animate', {
      attributeName: 'fill-opacity',
      values: '0.45;0.85;0.45',
      dur,
      repeatCount: 'indefinite',
    });
    circle.append(anim);
    svg.append(circle);
  });

  // ── Dashed connection lines from nodes to center ─────────────
  const connLines = [
    { x1: 62, y1: -115 },
    { x1: -125, y1: 28 },
    { x1: 105, y1: 92 },
  ];

  connLines.forEach(({ x1, y1 }) => {
    svg.append(svgEl('line', {
      x1: String(x1),
      y1: String(y1),
      x2: '0',
      y2: '0',
      stroke: 'rgba(46,190,122,0.1)',
      'stroke-width': '1',
      'stroke-dasharray': '4 7',
    }));
  });

  // ── Central sphere ──────────────────────────────────────────
  const centerGlow = svgEl('circle', {
    cx: '0', cy: '0', r: '30', fill: `url(#h6-cg-${uid})`,
  });
  const pulseSphere = svgEl('animate', {
    attributeName: 'r',
    values: '30;38;30',
    dur: '3.2s',
    repeatCount: 'indefinite',
  });
  centerGlow.append(pulseSphere);
  svg.append(centerGlow);

  svg.append(svgEl('circle', {
    cx: '0',
    cy: '0',
    r: '7',
    fill: '#2ebe7a',
    filter: `url(#h6-gf-${uid})`,
  }));
  svg.append(svgEl('circle', {
    cx: '0', cy: '0', r: '4', fill: '#e8faf2',
  }));

  wrap.append(svg);
  return wrap;
}

/**
 * Animate stat numbers from zero to their target value using
 * IntersectionObserver so the count-up fires when the cell enters
 * the viewport.
 */
function initCountUp(container) {
  const nums = container.querySelectorAll('.h6-stat-num[data-target]');
  if (!nums.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);

        const { target } = entry;
        const raw = target.dataset.target || '';
        const numericStr = raw.replace(/[^0-9.]/g, '');
        const suffix = raw.slice(numericStr.length);
        const end = parseFloat(numericStr);

        if (Number.isNaN(end)) return;

        const duration = 1800;
        const decimals = numericStr.includes('.') ? (numericStr.split('.')[1]?.length ?? 1) : 0;
        const startTime = performance.now();

        function tick(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - (1 - progress) ** 3;
          target.textContent = `${(eased * end).toFixed(decimals)}${suffix}`;
          if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      });
    },
    { threshold: 0.5 },
  );

  nums.forEach((num) => observer.observe(num));
}

/**
 * Main EDS block decorator.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  // ── Read authored content ────────────────────────────────────
  const eyebrow = rowText(block, 0);
  const titleSource = block.children[1]?.querySelector('div') ?? null;
  const subtitle = rowText(block, 2);
  const ctaPrimary = rowAnchor(block, 3);
  const ctaSecondary = rowAnchor(block, 4);
  const stats = [5, 6, 7].map((i) => rowParts(block, i));
  const features = [8, 9, 10].map((i) => rowParts(block, i));

  // ── Copy cell ────────────────────────────────────────────────
  const headline = transformHeadlineNode(titleSource);
  const subtitleEl = subtitle
    ? el('p', 'h6-subtitle', {}, [document.createTextNode(subtitle)])
    : null;

  const actions = el('div', 'h6-actions');
  if (ctaPrimary) {
    ctaPrimary.className = 'h6-cta-primary';
    actions.append(ctaPrimary);
  }
  if (ctaSecondary) {
    ctaSecondary.className = 'h6-cta-secondary';
    actions.append(ctaSecondary);
  }

  const copyCell = el('div', 'h6-cell h6-cell-copy', {}, [
    buildEyebrow(eyebrow),
    headline,
    subtitleEl,
    actions.children.length ? actions : null,
  ].filter(Boolean));

  // ── Stats cell ───────────────────────────────────────────────
  const statsCell = el('div', 'h6-cell h6-cell-stats');
  const statsHeader = el('div', 'h6-stats-header', {}, [
    el('span', 'h6-stats-title', {}, [document.createTextNode('Platform metrics')]),
    el('span', 'h6-stats-live', {}, [document.createTextNode('Live')]),
  ]);
  statsCell.append(statsHeader);

  stats.forEach(([value, label, note]) => {
    const stat = buildStat(value, label ?? '', note ?? '');
    if (stat) statsCell.append(stat);
  });

  // ── Features cell ────────────────────────────────────────────
  const featuresCell = el('div', 'h6-cell h6-cell-features');
  const featsHeader = el('h3', 'h6-feats-heading', {}, [
    document.createTextNode('Why enterprise teams choose us'),
  ]);
  featuresCell.append(featsHeader);

  features.forEach(([icon, title, desc]) => {
    const feat = buildFeature(icon, title, desc ?? '');
    if (feat) featuresCell.append(feat);
  });

  // ── Visual cell (generative orbital decoration) ──────────────
  const visualCell = el(
    'div',
    'h6-cell h6-cell-visual',
    { 'aria-hidden': 'true' },
    [buildOrbital()],
  );

  // ── Assemble bento grid ──────────────────────────────────────
  const bento = el('div', 'h6-bento', {}, [
    copyCell,
    statsCell,
    featuresCell,
    visualCell,
  ]);

  block.textContent = '';
  block.append(bento);

  initCountUp(block);
}
