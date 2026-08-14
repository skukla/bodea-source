import { events } from '@dropins/tools/event-bus.js';
import { getPersonalizationData } from '@dropins/storefront-personalization/api.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { IS_DA, IS_UE } from '../../scripts/commerce.js';
import { loadFragment } from '../fragment/fragment.js';
import {
  evaluateSegmentVisibility,
  normalizeRuntimeSegments,
  parseCustomerSegments,
} from './customer-segment-personalization-block.utils.js';

const personalizationBlocks = [];
let listenersBound = false;

function toClassName(name) {
  return typeof name === 'string'
    ? name
      .toLowerCase()
      .replace(/[^0-9a-z]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    : '';
}

function normalizeFragmentPath(path) {
  if (typeof path !== 'string') {
    return '';
  }

  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return '';
  }

  if (trimmedPath.startsWith('/')) {
    return trimmedPath;
  }

  try {
    return new URL(trimmedPath, window.location.href).pathname;
  } catch (error) {
    return trimmedPath;
  }
}

function getInlineContent(block) {
  const contentRow = [...block.querySelectorAll(':scope > div')].find((row) => {
    const [labelCell] = row.children;
    return toClassName(labelCell?.textContent) === 'content';
  });

  const contentCell = contentRow?.children?.[1];
  if (!contentCell) {
    return null;
  }

  const container = document.createElement('div');
  container.append(...contentCell.childNodes);
  return container;
}

/**
 * Hiding is this block's correct runtime behaviour, but it makes the block
 * unselectable and indistinguishable from a broken one while authoring — and
 * "no segments exist yet" is the steady state until someone creates them by
 * hand (the import API cannot seed customer segments). So in Universal Editor
 * and DA preview the block always stays visible, as `enrichment.js` does.
 * @param {HTMLElement} block
 * @param {boolean} visible
 */
function setBlockVisibility(block, visible) {
  const authoring = IS_UE || IS_DA;
  block.hidden = !visible && !authoring;
  block.setAttribute('aria-hidden', `${!visible && !authoring}`);
  block.classList.toggle('is-authoring-preview', authoring && !visible);
}

function getRuntimeSegments() {
  return normalizeRuntimeSegments(getPersonalizationData().segments);
}

function updateCustomerSegmentPersonalizationBlocks() {
  const runtimeSegments = getRuntimeSegments();

  personalizationBlocks
    .filter((instance) => instance.block.isConnected)
    .forEach((instance) => {
      const { visible } = evaluateSegmentVisibility(instance.segments, runtimeSegments);
      setBlockVisibility(instance.block, visible);
    });
}

function bindListeners() {
  if (listenersBound) {
    return;
  }

  listenersBound = true;
  events.on('personalization/updated', () => updateCustomerSegmentPersonalizationBlocks());
}

export default async function decorate(block) {
  setBlockVisibility(block, false);

  const blockConfig = readBlockConfig(block);
  const hostSection = block.closest('.section');
  const segmentIds = parseCustomerSegments(blockConfig['customer-segments']);
  const visibilityState = evaluateSegmentVisibility(segmentIds, []);

  if (visibilityState.misconfigured) {
    console.warn(visibilityState.warning, block);
    if (IS_UE || IS_DA) {
      block.textContent = '';
      const hint = document.createElement('p');
      hint.className = 'customer-segment-personalization-block__hint';
      hint.textContent = 'Add a customer-segments row (comma-separated Adobe Commerce segment IDs) so this block can appear for matching shoppers.';
      block.appendChild(hint);
    }
    return;
  }

  const fragmentPath = normalizeFragmentPath(blockConfig.fragment);
  const fragmentContent = fragmentPath ? await loadFragment(fragmentPath) : null;
  const content = fragmentContent || getInlineContent(block);
  const contentContainer = document.createElement('div');

  if (content) {
    if (content.matches?.('main')) {
      contentContainer.append(...content.childNodes);
    } else {
      contentContainer.append(content);
    }
  }

  hostSection?.classList.toggle(
    'customer-segment-personalization-block-container--fragment',
    Boolean(fragmentContent),
  );

  block.replaceChildren(contentContainer);

  personalizationBlocks.push({
    block,
    segments: segmentIds,
  });

  bindListeners();
  updateCustomerSegmentPersonalizationBlocks();
}
