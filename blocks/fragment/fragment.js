/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

import { getRootPath } from '@dropins/tools/lib/aem/configs.js';
import { decorateMain } from '../../scripts/scripts.js';
import {
  loadSections,
} from '../../scripts/aem.js';

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {Promise<HTMLElement>} The root element of the fragment
 */
export async function loadFragment(path) {
  if (path && path.startsWith('/') && !path.startsWith('//')) {
    const root = getRootPath().replace(/\/$/, '');
    const url = `${root}${path}.plain.html`;
    const resp = await fetch(url);
    if (resp.ok) {
      const main = document.createElement('main');
      main.innerHTML = await resp.text();

      // reset base path for media to fragment base
      const resetAttributeBase = (tag, attr) => {
        main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      decorateMain(main);
      await loadSections(main);
      return main;
    }
  }
  return null;
}

/**
 * Mounts loaded fragment sections into the page.
 * When the host occupies a dedicated section, replace that section so the
 * fragment sections become top-level siblings under <main>.
 * @param {Element} host The element currently standing in for the fragment
 * @param {HTMLElement} fragment The decorated fragment main
 * @returns {boolean} True when content was mounted
 */
export function mountFragment(host, fragment) {
  if (!host || !fragment) return false;

  const fragmentSections = [...fragment.children]
    .filter((node) => node.nodeType === Node.ELEMENT_NODE);
  if (!fragmentSections.length) return false;

  const hostSection = host.closest('.section');
  let replaceTarget = host;

  while (
    replaceTarget.parentElement
    && replaceTarget.parentElement !== hostSection
    && replaceTarget.parentElement.children.length === 1
  ) {
    replaceTarget = replaceTarget.parentElement;
  }

  const dedicatedSection = hostSection
    && replaceTarget.parentElement === hostSection
    && hostSection.children.length === 1;

  if (dedicatedSection) {
    hostSection.replaceWith(...fragmentSections);
    return true;
  }

  const firstFragmentSection = fragmentSections.find((node) => node.classList?.contains('section'));
  if (hostSection && firstFragmentSection) {
    hostSection.classList.add(...firstFragmentSection.classList);
  }

  replaceTarget.replaceWith(...fragmentSections);
  return true;
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadFragment(path);
  if (fragment) block.replaceChildren(...fragment.childNodes);
}
