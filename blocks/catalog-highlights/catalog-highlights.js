/**
 * Catalog Highlights block for EDS document authoring.
 *
 * Table contract (8 columns, typed rows):
 * header:  type | eyebrow | title | subtitle | browse-link | empty | empty | empty
 * product: type | image | badge-text | badge-style | product-name | sku-meta | price | product-link
 */

const BADGE_STYLES = new Set(['new', 'popular', 'sale', 'none']);

const DEFAULT_HEADER = {
  eyebrow: 'Catalog Highlights',
  title: 'Top-performing enterprise hardware',
  subtitle: '',
  browseLink: {
    text: 'Browse full catalog →',
    href: '#',
  },
};

/**
 * Read plain text from an authored cell.
 * @param {HTMLElement | undefined} cell
 * @returns {string}
 */
function cellText(cell) {
  if (!cell) return '';
  return cell.innerText.trim();
}

/**
 * Read link data from an authored cell.
 * If the cell has plain URL text, it is treated as href + text.
 * @param {HTMLElement | undefined} cell
 * @returns {{href: string, text: string, target: string, rel: string} | null}
 */
function readLink(cell) {
  if (!cell) return null;

  const anchor = cell.querySelector('a[href]');
  if (anchor) {
    return {
      href: anchor.getAttribute('href') || '',
      text: anchor.textContent.trim() || anchor.getAttribute('href') || '',
      target: anchor.getAttribute('target') || '',
      rel: anchor.getAttribute('rel') || '',
    };
  }

  const text = cellText(cell);
  if (!text) return null;

  if (/^(https?:\/\/|\/)/i.test(text)) {
    return {
      href: text,
      text,
      target: '',
      rel: '',
    };
  }

  return {
    href: '',
    text,
    target: '',
    rel: '',
  };
}

/**
 * Read image node from an authored cell.
 * @param {HTMLElement | undefined} cell
 * @returns {HTMLElement | null}
 */
function readImageNode(cell) {
  if (!cell) return null;

  const picture = cell.querySelector('picture');
  if (picture) return picture.cloneNode(true);

  const image = cell.querySelector('img');
  if (image) return image.cloneNode(true);

  const raw = cellText(cell);
  if (/^(https?:\/\/|\/)/i.test(raw)) {
    const img = document.createElement('img');
    img.src = raw;
    img.alt = '';
    img.loading = 'lazy';
    return img;
  }

  return null;
}

/**
 * Parse one product row.
 * @param {HTMLElement[]} cells
 * @returns {{
 *   imageNode: HTMLElement | null,
 *   badgeText: string,
 *   badgeStyle: string,
 *   name: string,
 *   skuMeta: string,
 *   price: string,
 *   link: {href: string, text: string, target: string, rel: string} | null,
 * } | null}
 */
function parseProduct(cells) {
  const name = cellText(cells[4]);
  const skuMeta = cellText(cells[5]);
  const price = cellText(cells[6]);
  const badgeText = cellText(cells[2]);
  const badgeStyleRaw = cellText(cells[3]).toLowerCase();
  const badgeStyle = BADGE_STYLES.has(badgeStyleRaw) ? badgeStyleRaw : 'none';

  const product = {
    imageNode: readImageNode(cells[1]),
    badgeText,
    badgeStyle,
    name,
    skuMeta,
    price,
    link: readLink(cells[7]),
  };

  const hasRenderableData = [
    product.imageNode,
    product.badgeText,
    product.name,
    product.skuMeta,
    product.price,
  ].some(Boolean);

  return hasRenderableData ? product : null;
}

/**
 * Tiny element factory.
 * @param {string} tag
 * @param {string} className
 * @param {Array<HTMLElement | Text>} children
 * @returns {HTMLElement}
 */
function el(tag, className = '', children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  children.forEach((child) => {
    if (child) node.append(child);
  });
  return node;
}

/**
 * Build header markup.
 * @param {{
 *   eyebrow: string,
 *   title: string,
 *   titleHtml: string,
 *   subtitle: string,
 *   browseLink: {href: string, text: string, target: string, rel: string} | null,
 * }} header
 * @returns {HTMLElement}
 */
function buildHeader(header) {
  const heading = el('div', 'catalog-highlights-header-copy');

  const eyebrow = el('div', 'catalog-highlights-eyebrow', [
    document.createTextNode(header.eyebrow || DEFAULT_HEADER.eyebrow),
  ]);

  const title = el('h2', 'catalog-highlights-title');
  if (header.titleHtml) {
    title.innerHTML = header.titleHtml;
  } else {
    title.textContent = header.title || DEFAULT_HEADER.title;
  }

  heading.append(eyebrow, title);

  if (header.subtitle) {
    heading.append(
      el('p', 'catalog-highlights-subtitle', [document.createTextNode(header.subtitle)]),
    );
  }

  const wrapper = el('div', 'catalog-highlights-header', [heading]);

  if (header.browseLink?.text) {
    if (header.browseLink.href) {
      const browse = el('a', 'catalog-highlights-browse', [
        document.createTextNode(header.browseLink.text),
      ]);
      browse.href = header.browseLink.href;
      if (header.browseLink.target) browse.target = header.browseLink.target;
      if (header.browseLink.rel) browse.rel = header.browseLink.rel;
      wrapper.append(browse);
    } else {
      wrapper.append(
        el('span', 'catalog-highlights-browse is-text', [
          document.createTextNode(header.browseLink.text),
        ]),
      );
    }
  }

  return wrapper;
}

/**
 * Build one product card.
 * @param {{
 *   imageNode: HTMLElement | null,
 *   badgeText: string,
 *   badgeStyle: string,
 *   name: string,
 *   skuMeta: string,
 *   price: string,
 *   link: {href: string, text: string, target: string, rel: string} | null,
 * }} product
 * @returns {HTMLElement}
 */
function buildProductCard(product) {
  const isLinked = Boolean(product.link?.href);
  const card = el(isLinked ? 'a' : 'article', 'catalog-highlights-card');

  if (isLinked) {
    card.classList.add('is-link');
    card.href = product.link.href;
    if (product.link.target) card.target = product.link.target;
    if (product.link.rel) card.rel = product.link.rel;
    if (product.name) card.setAttribute('aria-label', product.name);
  }

  const media = el('div', 'catalog-highlights-media');
  if (product.imageNode) {
    media.append(product.imageNode);
  } else {
    media.append(el('div', 'catalog-highlights-media-fallback', [document.createTextNode('▦')]));
  }

  if (product.badgeText && product.badgeStyle !== 'none') {
    media.append(
      el('span', `catalog-highlights-badge badge-${product.badgeStyle}`, [
        document.createTextNode(product.badgeText),
      ]),
    );
  }

  const body = el('div', 'catalog-highlights-body');
  body.append(el('h3', 'catalog-highlights-name', [document.createTextNode(product.name || 'Untitled Product')]));

  if (product.skuMeta) {
    body.append(el('p', 'catalog-highlights-sku', [document.createTextNode(product.skuMeta)]));
  }

  const footer = el('div', 'catalog-highlights-footer');
  footer.append(
    el('div', 'catalog-highlights-price', [document.createTextNode(product.price || 'Contact Sales')]),
    el('span', 'catalog-highlights-add', [document.createTextNode('+')]),
  );

  body.append(footer);
  card.append(media, body);

  return card;
}

/**
 * Main EDS block decorator.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const rows = [...block.children].map((row) => [...row.children]);

  /**
   * @type {{
   *   eyebrow: string,
   *   title: string,
   *   titleHtml: string,
   *   subtitle: string,
   *   browseLink: {href: string, text: string, target: string, rel: string} | null,
   * } | null}
   */
  let header = null;

  /** @type {Array<ReturnType<typeof parseProduct>>} */
  const products = [];

  rows.forEach((cells) => {
    const type = cellText(cells[0]).toLowerCase();

    if (type === 'header' && !header) {
      header = {
        eyebrow: cellText(cells[1]),
        title: cellText(cells[2]),
        titleHtml: cells[2]?.innerHTML?.trim() || '',
        subtitle: cellText(cells[3]),
        browseLink: readLink(cells[4]),
      };
      return;
    }

    if (type !== 'product') return;

    const product = parseProduct(cells);
    if (product) products.push(product);
  });

  const safeHeader = header || {
    eyebrow: DEFAULT_HEADER.eyebrow,
    title: DEFAULT_HEADER.title,
    titleHtml: '',
    subtitle: DEFAULT_HEADER.subtitle,
    browseLink: DEFAULT_HEADER.browseLink,
  };

  block.textContent = '';

  const inner = el('section', 'catalog-highlights-inner');
  inner.append(buildHeader(safeHeader));

  const grid = el('div', 'catalog-highlights-grid');
  products.forEach((product) => {
    grid.append(buildProductCard(product));
  });

  inner.append(grid);
  block.append(inner);
}
