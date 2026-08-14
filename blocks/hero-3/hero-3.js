import { createOptimizedPicture } from '../../scripts/aem.js';

function buildUrgencyChip(text) {
  const chip = document.createElement('div');
  chip.className = 'hero-3-urgency hero-3-stagger';

  const dot = document.createElement('span');
  dot.className = 'hero-3-urgency-dot';
  chip.append(dot);
  chip.append(document.createTextNode(` ${text}`));
  return chip;
}

function buildEyebrow(text) {
  const p = document.createElement('p');
  p.className = 'hero-3-eyebrow hero-3-stagger';
  p.textContent = text;
  return p;
}

function buildHeadline(lines) {
  const h1 = document.createElement('h1');
  h1.className = 'hero-3-headline';

  lines.forEach((line, i) => {
    const span = document.createElement('span');
    span.className = 'hero-3-headline-line hero-3-stagger';
    span.textContent = line.text;
    if (line.italic) span.classList.add('italic');
    if (line.indent) span.classList.add('indent');
    span.style.transitionDelay = `${160 + i * 70}ms`;
    h1.append(span);
  });

  const fullText = lines.map((l) => l.text).join(' ');
  h1.setAttribute('aria-label', fullText);
  return h1;
}

function buildSubcopy(text) {
  const p = document.createElement('p');
  p.className = 'hero-3-subcopy hero-3-stagger';
  p.textContent = text;
  return p;
}

function buildCtaRow(buttons) {
  const row = document.createElement('div');
  row.className = 'hero-3-cta-row hero-3-stagger';

  buttons.forEach((btn, i) => {
    const a = document.createElement('a');
    a.href = btn.href || '#';
    a.textContent = btn.label;

    if (btn.href && btn.href !== '#') {
      const isExternal = btn.href.startsWith('http');
      if (isExternal) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    }

    if (i === 0) {
      a.className = 'hero-3-cta-primary';
      const arrow = document.createElement('span');
      arrow.className = 'hero-3-cta-arrow';
      arrow.textContent = '\u2192';
      a.append(arrow);
    } else {
      a.className = 'hero-3-cta-secondary';
    }

    row.append(a);
  });

  return row;
}

function buildTrustRow(items) {
  const row = document.createElement('div');
  row.className = 'hero-3-trust hero-3-stagger';

  items.forEach((item) => {
    const span = document.createElement('span');
    span.className = 'hero-3-trust-item';

    const icon = document.createElement('span');
    icon.className = 'hero-3-trust-icon';
    icon.textContent = item.icon || '\u2192';

    span.append(icon);
    span.append(document.createTextNode(` ${item.text}`));
    row.append(span);
  });

  return row;
}

function buildBadges(items) {
  const row = document.createElement('div');
  row.className = 'hero-3-badges hero-3-stagger';

  items.forEach((item) => {
    const badge = document.createElement('span');
    badge.className = 'hero-3-badge';

    if (item.icon) {
      const icon = document.createElement('span');
      icon.className = 'hero-3-badge-icon';
      icon.textContent = item.icon;
      badge.append(icon);
    }

    badge.append(document.createTextNode(item.text));
    row.append(badge);
  });

  return row;
}

function buildAccentCard(imgSrc, imgAlt, label) {
  const card = document.createElement('div');
  card.className = 'hero-3-accent-card';

  const imgWrap = document.createElement('div');
  imgWrap.className = 'hero-3-accent-card-img';

  const picture = createOptimizedPicture(imgSrc, imgAlt, false, [{ width: '300' }]);
  imgWrap.append(picture);
  card.append(imgWrap);

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className = 'hero-3-card-label';
    labelEl.textContent = label;

    const dot = document.createElement('span');
    dot.className = 'hero-3-card-label-dot';
    labelEl.append(dot);
    card.append(labelEl);
  }

  return card;
}

function parseHeadlineLines(cell) {
  const lines = [];
  const paragraphs = cell.querySelectorAll('p');

  if (paragraphs.length > 0) {
    paragraphs.forEach((p) => {
      const text = p.textContent.trim();
      if (!text) return;
      const hasEm = p.querySelector('em');
      const hasStrong = p.querySelector('strong');
      lines.push({
        text,
        italic: !!hasEm,
        indent: !!hasStrong,
      });
    });
  } else {
    const text = cell.textContent.trim();
    if (text) {
      text.split('\n').filter(Boolean).forEach((line) => {
        lines.push({ text: line.trim(), italic: false, indent: false });
      });
    }
  }

  return lines;
}

function parseTrustItems(cell) {
  const items = [];
  const listItems = cell.querySelectorAll('li');

  if (listItems.length > 0) {
    listItems.forEach((li) => {
      const text = li.textContent.trim();
      if (!text) return;
      const match = text.match(/^(.)\s+(.+)$/);
      if (match) {
        items.push({ icon: match[1], text: match[2] });
      } else {
        items.push({ icon: '\u2192', text });
      }
    });
  } else {
    const paragraphs = cell.querySelectorAll('p');
    paragraphs.forEach((p) => {
      const text = p.textContent.trim();
      if (!text) return;
      const match = text.match(/^(.)\s+(.+)$/);
      if (match) {
        items.push({ icon: match[1], text: match[2] });
      } else {
        items.push({ icon: '\u2192', text });
      }
    });
  }

  return items;
}

function parseBadgeItems(cell) {
  const items = [];
  const listItems = cell.querySelectorAll('li');

  if (listItems.length > 0) {
    listItems.forEach((li) => {
      const text = li.textContent.trim();
      if (!text) return;
      const match = text.match(/^(.)\s*(.+)$/);
      if (match) {
        items.push({ icon: match[1], text: match[2] });
      } else {
        items.push({ icon: '', text });
      }
    });
  } else {
    const paragraphs = cell.querySelectorAll('p');
    paragraphs.forEach((p) => {
      const text = p.textContent.trim();
      if (!text) return;
      const match = text.match(/^(.)\s*(.+)$/);
      if (match) {
        items.push({ icon: match[1], text: match[2] });
      } else {
        items.push({ icon: '', text });
      }
    });
  }

  return items;
}

function parseButtons(cell) {
  const buttons = [];
  const anchors = cell.querySelectorAll('a');

  if (anchors.length > 0) {
    anchors.forEach((a) => {
      buttons.push({
        label: a.textContent.trim(),
        href: a.getAttribute('href') || '#',
      });
    });
  } else {
    const paragraphs = cell.querySelectorAll('p');
    paragraphs.forEach((p) => {
      const text = p.textContent.trim();
      if (text) {
        buttons.push({ label: text, href: '#' });
      }
    });
  }

  return buttons;
}

function extractImage(cell) {
  const img = cell?.querySelector('img');
  if (img) return { src: img.src, alt: img.alt || '' };

  const anchor = cell?.querySelector('a[href]');
  if (anchor && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(anchor.href)) {
    return { src: anchor.href, alt: anchor.textContent || '' };
  }

  return null;
}

function initParallax(section, bgLayer, mediaLayer, decorLayer) {
  const prefersReduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  if (prefersReduced) return;

  const speeds = { bg: 0.12, media: 0.32, decor: 0.52 };
  let raf = null;

  function apply() {
    const rect = section.getBoundingClientRect();
    const progress = -rect.top;
    if (bgLayer) bgLayer.style.transform = `translateY(${progress * speeds.bg}px)`;
    if (mediaLayer) mediaLayer.style.transform = `translateY(${progress * speeds.media}px)`;
    if (decorLayer) decorLayer.style.transform = `translateY(${progress * speeds.decor}px)`;
    raf = null;
  }

  window.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });

  apply();
}

/**
 * Hero 3 — Split Parallax Glass Edition
 *
 * Expected authored rows (all optional except row 1):
 *  Row 1: urgency | eyebrow
 *  Row 2: headline (paragraphs; em = italic, strong = indent)
 *  Row 3: subcopy text
 *  Row 4: CTA buttons (links)
 *  Row 5: trust items (list or paragraphs with leading icon char)
 *  Row 6: badges (list or paragraphs with leading icon char)
 *  Row 7: main image | vertical rail text
 *  Row 8: accent card 1 image | accent card 1 label
 *  Row 9: accent card 2 image | accent card 2 label
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) {
    console.warn('hero-3: No content rows found.');
    return;
  }

  const cells = rows.map((row) => [...row.children]);

  const urgencyText = cells[0]?.[0]?.textContent?.trim() || '';
  const eyebrowText = cells[0]?.[1]?.textContent?.trim() || '';
  const headlineLines = cells[1] ? parseHeadlineLines(cells[1][0]) : [];
  const subcopyText = cells[2]?.[0]?.textContent?.trim() || '';
  const ctaButtons = cells[3] ? parseButtons(cells[3][0]) : [];
  const trustItems = cells[4] ? parseTrustItems(cells[4][0]) : [];
  const badgeItems = cells[5] ? parseBadgeItems(cells[5][0]) : [];
  const mainImage = cells[6] ? extractImage(cells[6][0]) : null;
  const railText = cells[6]?.[1]?.textContent?.trim() || '';
  const accent1Image = cells[7] ? extractImage(cells[7][0]) : null;
  const accent1Label = cells[7]?.[1]?.textContent?.trim() || '';
  const accent2Image = cells[8] ? extractImage(cells[8][0]) : null;
  const accent2Label = cells[8]?.[1]?.textContent?.trim() || '';

  block.classList.add('hero-3-motion');
  block.textContent = '';

  const bgLayer = document.createElement('div');
  bgLayer.className = 'hero-3-bg-layer';
  bgLayer.setAttribute('aria-hidden', 'true');
  block.append(bgLayer);

  if (railText) {
    const rail = document.createElement('div');
    rail.className = 'hero-3-vert-rail';
    rail.setAttribute('aria-hidden', 'true');
    rail.textContent = railText;
    block.append(rail);
  }

  const inner = document.createElement('div');
  inner.className = 'hero-3-inner';

  const textCol = document.createElement('div');
  textCol.className = 'hero-3-text-col';

  if (urgencyText) textCol.append(buildUrgencyChip(urgencyText));
  if (eyebrowText) textCol.append(buildEyebrow(eyebrowText));
  if (headlineLines.length) textCol.append(buildHeadline(headlineLines));
  if (subcopyText) textCol.append(buildSubcopy(subcopyText));
  if (ctaButtons.length) textCol.append(buildCtaRow(ctaButtons));
  if (trustItems.length) textCol.append(buildTrustRow(trustItems));
  if (badgeItems.length) textCol.append(buildBadges(badgeItems));

  inner.append(textCol);

  const mediaCol = document.createElement('div');
  mediaCol.className = 'hero-3-media-col';

  if (mainImage) {
    const mediaMain = document.createElement('div');
    mediaMain.className = 'hero-3-media-main';

    const picture = createOptimizedPicture(
      mainImage.src,
      mainImage.alt,
      true,
      [
        { media: '(min-width: 1200px)', width: '900' },
        { media: '(min-width: 768px)', width: '700' },
        { width: '500' },
      ],
    );
    mediaMain.append(picture);

    const rotatedLabel = document.createElement('div');
    rotatedLabel.className = 'hero-3-rotated-label';
    rotatedLabel.setAttribute('aria-hidden', 'true');
    rotatedLabel.textContent = eyebrowText.split('\u00B7')[0]?.trim() || 'Featured';
    mediaMain.append(rotatedLabel);

    mediaCol.append(mediaMain);
  }

  const decorLayer = document.createElement('div');
  decorLayer.className = 'hero-3-decor-layer';
  decorLayer.setAttribute('aria-hidden', 'true');

  if (accent1Image) {
    decorLayer.append(buildAccentCard(accent1Image.src, accent1Image.alt, accent1Label));
  }
  if (accent2Image) {
    decorLayer.append(buildAccentCard(accent2Image.src, accent2Image.alt, accent2Label));
  }

  mediaCol.append(decorLayer);

  const colorSlab = document.createElement('div');
  colorSlab.className = 'hero-3-color-slab';
  colorSlab.setAttribute('aria-hidden', 'true');
  mediaCol.append(colorSlab);

  inner.append(mediaCol);
  block.append(inner);

  requestAnimationFrame(() => {
    setTimeout(() => {
      block.classList.add('hero-3-entered');
    }, 60);
  });

  initParallax(
    block,
    bgLayer,
    block.querySelector('.hero-3-media-main'),
    decorLayer,
  );
}
