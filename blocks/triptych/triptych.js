import { createOptimizedPicture } from '../../scripts/aem.js';

export const TRIPTYCH_DEFAULT_LINES = [
  'When',
  'nature',
  'perfects',
  'something,',
  "we don't",
  'alter it, we',
  'reveal it.',
];

export const TRIPTYCH_DEFAULT_CAPTIONS = [
  "Purity is not created. It's preserved.",
  'Aupale exists not to reinvent, but to respect.',
  'We let time, patience, and precision guide every step.',
  'Materials carry memory long before they carry color.',
  'Each finish is chosen to feel discovered, not manufactured.',
  'Quiet structure lets texture do the speaking.',
  'The final layer should feel gathered over time, not rushed.',
];

export const TRIPTYCH_DEFAULTS = {
  tone: 'sage',
  motion: 'on',
};

const DESKTOP_BREAKPOINT = 768;
const LEGACY_MEDIA_COUNT = 3;
const MAX_MEDIA_COUNT = 7;
const PARALLAX_SPEEDS = [0.08, 0.14, 0.05, 0.11, 0.07, 0.1, 0.06];
const COPY_FIELDS = ['line1', 'line2', 'line3', 'line4', 'line5', 'line6', 'line7'];
const MEDIA_FIELDS = Array.from({ length: MAX_MEDIA_COUNT }, (_, index) => `media${index + 1}`);
const CAPTION_FIELDS = Array.from({ length: MAX_MEDIA_COUNT }, (_, index) => `caption${index + 1}`);
const SUPPORTED_FIELDS = new Set([...COPY_FIELDS, ...MEDIA_FIELDS, ...CAPTION_FIELDS]);
const LEGACY_MEDIA_ROW_INDEXES = Array.from(
  { length: MAX_MEDIA_COUNT },
  (_, index) => COPY_FIELDS.length + (index * 2),
);
const LEGACY_CAPTION_ROW_INDEXES = LEGACY_MEDIA_ROW_INDEXES.map((index) => index + 1);

const BACKGROUND_CARTOGRAPHY = `
  <svg viewBox="0 0 600 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" stroke-width="1" stroke-dasharray="2 4" fill="none">
      <path d="M300 50 C 150 150, 50 300, 100 450 S 250 600, 200 750 S 50 850, 150 950 S 350 1050, 300 1150"/>
      <path d="M400 30 C 500 130, 550 280, 480 420 S 350 550, 420 680 S 550 800, 450 920 S 300 1020, 380 1120"/>
      <path d="M200 80 C 100 180, 80 330, 150 470 S 300 600, 250 730 S 100 850, 200 970 S 400 1070, 350 1170"/>
      <path d="M500 60 C 550 160, 530 310, 460 450 S 350 580, 400 710 S 500 830, 430 950 S 280 1050, 350 1150"/>
      <ellipse cx="180" cy="350" rx="60" ry="40"/>
      <ellipse cx="420" cy="550" rx="45" ry="30"/>
      <ellipse cx="250" cy="800" rx="55" ry="35"/>
      <ellipse cx="380" cy="200" rx="35" ry="25"/>
      <ellipse cx="150" cy="650" rx="40" ry="28"/>
      <ellipse cx="450" cy="850" rx="50" ry="32"/>
      <path d="M100 200 Q 200 180, 250 220 T 400 200"/>
      <path d="M150 500 Q 250 480, 300 520 T 450 500"/>
      <path d="M80 700 Q 180 680, 230 720 T 380 700"/>
      <path d="M200 900 Q 300 880, 350 920 T 500 900"/>
      <circle cx="300" cy="400" r="80"/>
      <circle cx="200" cy="600" r="50"/>
      <circle cx="400" cy="750" r="65"/>
    </g>
  </svg>
`;

const OVAL_CARTOGRAPHY = `
  <svg viewBox="0 0 454 829" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" stroke-dasharray="2 4" fill="none">
      <path d="M227 50 C 120 150, 80 300, 130 400 S 280 500, 220 600 S 100 700, 180 780"/>
      <path d="M320 80 C 380 180, 400 300, 340 420 S 200 520, 270 630 S 380 720, 300 800"/>
      <ellipse cx="200" cy="350" rx="80" ry="50"/>
      <ellipse cx="280" cy="550" rx="60" ry="40"/>
      <path d="M100 250 Q 200 230, 280 270 T 400 250"/>
      <path d="M120 500 Q 220 480, 300 520 T 380 500"/>
      <circle cx="227" cy="415" r="100"/>
    </g>
  </svg>
`;

function createElement(tag, className = '', attrs = {}, children = [], doc = document) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  Object.entries(attrs).forEach(([key, value]) => {
    node.setAttribute(key, value);
  });
  children.forEach((child) => {
    if (child) node.append(child);
  });
  return node;
}

function getRowCells(row) {
  return row ? [...(row.children || [])] : [];
}

function getRowCell(block, rowIndex, cellIndex = 0) {
  const row = block.children[rowIndex];
  const cells = getRowCells(row);
  return cells[cellIndex] || cells[0] || row || null;
}

function getCellText(cell) {
  return cell?.textContent?.trim() || '';
}

function getRowText(block, rowIndex, cellIndex = 0) {
  return getCellText(getRowCell(block, rowIndex, cellIndex));
}

function getKeyValueSourceCells(block) {
  const rows = [...block.children];
  const cells = {};
  let matchedFields = 0;

  rows.forEach((row) => {
    const rowCells = getRowCells(row);
    if (rowCells.length < 2) return;
    const [, valueCell] = rowCells;

    const fieldName = getCellText(rowCells[0]).toLowerCase();
    if (!SUPPORTED_FIELDS.has(fieldName)) return;

    cells[fieldName] = valueCell;
    matchedFields += 1;
  });

  return matchedFields ? cells : null;
}

function getMediaCount(block, keyValueCells) {
  if (keyValueCells) {
    let highestIndex = 0;

    for (let index = 0; index < MAX_MEDIA_COUNT; index += 1) {
      if (keyValueCells[MEDIA_FIELDS[index]] || keyValueCells[CAPTION_FIELDS[index]]) {
        highestIndex = index + 1;
      }
    }

    return highestIndex || LEGACY_MEDIA_COUNT;
  }

  const authoredMediaRows = Math.floor(
    Math.max(0, block.children.length - COPY_FIELDS.length) / 2,
  );

  return Math.max(
    LEGACY_MEDIA_COUNT,
    Math.min(MAX_MEDIA_COUNT, authoredMediaRows || LEGACY_MEDIA_COUNT),
  );
}

function getTriptychSource(block) {
  if (block._triptychSource) return block._triptychSource;

  const keyValueCells = getKeyValueSourceCells(block);
  const mediaCount = getMediaCount(block, keyValueCells);
  const source = {
    lines: keyValueCells
      ? COPY_FIELDS.map((fieldName) => getCellText(keyValueCells[fieldName]))
      : Array.from({ length: 7 }, (_, index) => getRowText(block, index)),
    media: keyValueCells
      ? MEDIA_FIELDS
        .slice(0, mediaCount)
        .map((fieldName) => extractImageSource(keyValueCells[fieldName]))
      : LEGACY_MEDIA_ROW_INDEXES
        .slice(0, mediaCount)
        .map((rowIndex) => extractImageSource(getRowCell(block, rowIndex))),
    captions: keyValueCells
      ? CAPTION_FIELDS
        .slice(0, mediaCount)
        .map((fieldName) => getCellText(keyValueCells[fieldName]))
      : LEGACY_CAPTION_ROW_INDEXES
        .slice(0, mediaCount)
        .map((rowIndex) => getRowText(block, rowIndex)),
    mediaCount,
  };

  block._triptychSource = source;
  return source;
}

export function collectTriptychLines(block) {
  const lines = getTriptychSource(block).lines.filter(Boolean);
  return lines.length ? lines : [...TRIPTYCH_DEFAULT_LINES];
}

export function normalizeTriptychTone(value) {
  return String(value || '').trim().toLowerCase() === 'stone'
    ? 'stone'
    : TRIPTYCH_DEFAULTS.tone;
}

export function normalizeTriptychMotion(value) {
  return String(value || '').trim().toLowerCase() === 'off'
    ? 'off'
    : TRIPTYCH_DEFAULTS.motion;
}

export function readTriptychConfig(block, view = window) {
  const section = block.closest?.('.section');
  const toneValue = section?.dataset?.triptychTone || block.dataset.triptychTone;
  const motionValue = section?.dataset?.triptychMotion || block.dataset.triptychMotion;
  const tone = normalizeTriptychTone(toneValue);
  const motion = normalizeTriptychMotion(motionValue);
  const reducedMotion = Boolean(view.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const motionEnabled = motion === 'on' && !reducedMotion;
  const desktopViewport = Number(view.innerWidth || 0) >= DESKTOP_BREAKPOINT;

  return {
    tone,
    motion,
    reducedMotion,
    motionEnabled,
    parallaxEnabled: motionEnabled && desktopViewport,
  };
}

export function extractImageSource(cell) {
  if (!cell) return null;

  const pictureImage = cell.querySelector('picture img');
  if (pictureImage) {
    return {
      src: pictureImage.getAttribute('src') || pictureImage.src || '',
      alt: pictureImage.getAttribute('alt') || pictureImage.alt || '',
    };
  }

  const image = cell.querySelector('img');
  if (image) {
    return {
      src: image.getAttribute('src') || image.src || '',
      alt: image.getAttribute('alt') || image.alt || '',
    };
  }

  const link = cell.querySelector('a[href]');
  const linkedSource = link?.getAttribute('href')?.trim();
  if (linkedSource && /\.(avif|gif|ico|jpe?g|png|svg|webp)(\?.*)?$/i.test(linkedSource)) {
    return {
      src: linkedSource,
      alt: link.textContent?.trim() || '',
    };
  }

  const rawText = cell.textContent?.trim();
  if (rawText && /^([./]{0,2}\/|\/)[^\s]+\.(avif|gif|ico|jpe?g|png|svg|webp)(\?.*)?$/i.test(rawText)) {
    return {
      src: rawText,
      alt: '',
    };
  }

  return null;
}

function buildDecorativeLayer(className, markup, doc) {
  const layer = createElement('div', className, { 'aria-hidden': 'true' }, [], doc);
  layer.innerHTML = markup;
  return layer;
}

function buildCopy(lines, motionEnabled, doc) {
  const copy = createElement('div', 'triptych-copy', {}, [], doc);

  lines.forEach((line, index) => {
    const outer = createElement('span', 'triptych-line', {}, [], doc);
    const inner = createElement(
      'span',
      'triptych-line-inner',
      {},
      [doc.createTextNode(line)],
      doc,
    );

    inner.style?.setProperty('--triptych-line-delay', `${0.56 + (index * 0.11)}s`);
    if (!motionEnabled) inner.classList?.add('is-static');
    outer.append(inner);
    copy.append(outer);
  });

  return copy;
}

function buildMediaAsset(source, mediaIndex, doc) {
  const frame = createElement('div', 'triptych-media-frame', {}, [], doc);

  if (source?.src) {
    const picture = createOptimizedPicture(
      source.src,
      source.alt || `Triptych media ${mediaIndex + 1}`,
      mediaIndex === 0,
      [
        { media: '(min-width: 1400px)', width: '780' },
        { media: '(min-width: 768px)', width: '620' },
        { width: '460' },
      ],
    );
    picture.classList.add('triptych-picture');
    frame.append(picture);
    return { frame, hasImage: true };
  }

  console.warn(`triptych: media${mediaIndex + 1} is missing a valid image source.`);
  frame.append(
    createElement(
      'div',
      `triptych-media-placeholder triptych-media-placeholder--${mediaIndex + 1}`,
      { 'aria-hidden': 'true' },
      [],
      doc,
    ),
  );

  return { frame, hasImage: false };
}

function buildMediaCard(source, mediaIndex, motionEnabled, doc) {
  const article = createElement(
    'article',
    `triptych-media triptych-media--${mediaIndex + 1}`,
    {},
    [],
    doc,
  );
  article.dataset.parallaxSpeed = `${PARALLAX_SPEEDS[mediaIndex]}`;

  const card = createElement('div', 'triptych-media-card', {}, [], doc);
  const { frame, hasImage } = buildMediaAsset(source.media[mediaIndex], mediaIndex, doc);
  const captionValue = source.captions[mediaIndex] || TRIPTYCH_DEFAULT_CAPTIONS[mediaIndex];

  if (!hasImage) {
    article.classList.add('is-placeholder');
  }

  if (!motionEnabled) {
    article.classList.add('is-visible');
  }

  card.append(frame);

  if (captionValue) {
    const caption = createElement('p', 'triptych-caption', {}, [], doc);
    const captionInner = createElement(
      'span',
      'triptych-caption-inner',
      {},
      [doc.createTextNode(captionValue)],
      doc,
    );
    card.append(caption);
    caption.append(captionInner);
  }

  article.append(card);
  return article;
}

function revealTargetsImmediately(targets) {
  targets.forEach((target) => target.classList.add('is-visible'));
}

export default function decorate(block) {
  if (typeof block._triptychCleanup === 'function') {
    block._triptychCleanup();
    delete block._triptychCleanup;
  }

  const doc = block.ownerDocument || document;
  const view = doc.defaultView || window;
  const config = readTriptychConfig(block, view);
  const source = getTriptychSource(block);
  const lines = collectTriptychLines(block);
  let motionState = 'reduced';

  if (config.motionEnabled) {
    motionState = 'on';
  } else if (config.motion === 'off') {
    motionState = 'off';
  }

  block.dataset.tone = config.tone;
  block.dataset.motion = motionState;

  const scene = createElement('div', 'triptych-scene', {}, [], doc);
  const shell = createElement('div', 'triptych-shell', {}, [], doc);
  const ovalWrap = createElement('div', 'triptych-oval-wrap', {}, [], doc);
  const oval = createElement('div', 'triptych-oval', {}, [], doc);
  const mediaGrid = createElement('div', 'triptych-media-grid', {}, [], doc);

  if (!config.motionEnabled) {
    oval.classList.add('is-visible');
  }

  oval.append(
    buildDecorativeLayer('triptych-oval-cartography', OVAL_CARTOGRAPHY, doc),
    buildCopy(lines, config.motionEnabled, doc),
  );

  ovalWrap.append(oval);
  shell.append(
    buildDecorativeLayer('triptych-cartography', BACKGROUND_CARTOGRAPHY, doc),
    ovalWrap,
  );

  Array.from({ length: source.mediaCount }, (_, index) => index).forEach((index) => {
    mediaGrid.append(buildMediaCard(source, index, config.motionEnabled, doc));
  });

  shell.append(mediaGrid);
  scene.append(shell);
  block.replaceChildren(scene);

  const mediaCards = [...block.querySelectorAll('.triptych-media')];
  const revealable = [oval, ...mediaCards];

  let observer;
  if (config.motionEnabled && typeof view.IntersectionObserver === 'function') {
    observer = new view.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.16,
      rootMargin: '0px 0px -10% 0px',
    });

    revealable.forEach((target) => observer.observe(target));
  } else {
    revealTargetsImmediately(revealable);
  }

  let frameId = 0;
  let frameQueued = false;
  let scrollHandler;
  const scheduleFrame = view.requestAnimationFrame?.bind(view)
    || ((callback) => callback());
  const cancelFrame = view.cancelAnimationFrame?.bind(view)
    || (() => {});

  const updateParallax = () => {
    const rect = typeof block.getBoundingClientRect === 'function'
      ? block.getBoundingClientRect()
      : { top: 0 };

    mediaCards.forEach((card) => {
      const speed = Number.parseFloat(card.dataset.parallaxSpeed || '0');
      const offset = Math.round(rect.top * speed * -100) / 100;
      card.style?.setProperty('--triptych-parallax-offset', `${offset}px`);
    });

    frameQueued = false;
  };

  if (config.parallaxEnabled && mediaCards.length) {
    scrollHandler = () => {
      if (frameQueued) return;
      frameQueued = true;
      frameId = scheduleFrame(updateParallax) || 0;
    };

    view.addEventListener?.('scroll', scrollHandler, { passive: true });
    updateParallax();
  } else {
    mediaCards.forEach((card) => {
      card.style?.setProperty('--triptych-parallax-offset', '0px');
    });
  }

  block._triptychCleanup = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (scrollHandler) {
      view.removeEventListener?.('scroll', scrollHandler);
      scrollHandler = null;
    }

    if (frameId) {
      cancelFrame(frameId);
      frameId = 0;
    }

    frameQueued = false;
  };
}
