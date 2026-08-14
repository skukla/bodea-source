import { events } from '@dropins/tools/event-bus.js';
import { getPersonalizationData } from '@dropins/storefront-personalization/api.js';
import { readBlockConfig } from '../../scripts/aem.js';
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

function setBlockVisibility(block, visible) {
  block.hidden = !visible;
  block.setAttribute('aria-hidden', `${!visible}`);
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
