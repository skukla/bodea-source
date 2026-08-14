import { events } from '@dropins/tools/event-bus.js';
import { getPersonalizationData } from '@dropins/storefront-personalization/api.js';
import { createOptimizedPicture, getMetadata } from '../../scripts/aem.js';
import { rootLink } from '../../scripts/commerce.js';
/* eslint-disable import/extensions */
import {
  BLOCK_NAME,
  OBSERVED_SESSION_KEY,
  buildAnalyticsPayload,
  normalizeBlockConfig,
  normalizeConfigKey,
  resolveHeroState,
  resolveStateContent,
  shouldHideBlock,
} from './vip-hero.utils.mjs';
/* eslint-enable import/extensions */

function createElement(tag, className = '', attributes = {}) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  Object.entries(attributes).forEach(([name, value]) => {
    if (value === undefined || value === null || value === '') return;
    element.setAttribute(name, value);
  });

  return element;
}

function setRichText(element, html) {
  element.innerHTML = html;
  return element;
}

function extractRawConfig(block) {
  return [...block.querySelectorAll(':scope > div')].reduce((accumulator, row) => {
    const [labelCell, valueCell] = row.children;
    if (!labelCell || !valueCell) {
      return accumulator;
    }

    const key = normalizeConfigKey(labelCell.textContent);
    const image = valueCell.querySelector('img');
    const anchor = valueCell.querySelector('a');

    if (key === 'media-image') {
      accumulator[key] = image?.src || valueCell.textContent.trim();
      if (image?.alt && !accumulator['media-image-alt']) {
        accumulator['media-image-alt'] = image.alt;
      }
      return accumulator;
    }

    if (key.endsWith('body') || key.endsWith('disclaimer')) {
      accumulator[key] = valueCell.innerHTML.trim();
      return accumulator;
    }

    if (key.endsWith('href') && anchor) {
      accumulator[key] = anchor.href;
      return accumulator;
    }

    if (key === 'media-image-alt') {
      accumulator[key] = valueCell.textContent.trim() || image?.alt || '';
      return accumulator;
    }

    accumulator[key] = valueCell.textContent.trim();
    return accumulator;
  }, {});
}

function resolveHref(href) {
  const normalized = String(href || '').trim();
  if (!normalized) return '';
  if (normalized.startsWith('/')) return rootLink(normalized);
  return normalized;
}

function getExperimentId() {
  return document.documentElement.dataset.experiment
    || document.body?.dataset?.experiment
    || document.querySelector('[data-experiment]')?.dataset?.experiment
    || getMetadata('experiment')
    || null;
}

function getObservedPersonalization() {
  try {
    return window.sessionStorage.getItem(OBSERVED_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

function setObservedPersonalization() {
  try {
    window.sessionStorage.setItem(OBSERVED_SESSION_KEY, 'true');
  } catch {
    // ignore storage failures
  }
}

function pushAnalyticsEvent(eventName, payload) {
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push({
    event: eventName,
    eventInfo: {
      ...payload,
      timestamp: new Date().toISOString(),
    },
  });
}

function createCta(href, text, className, slotName) {
  const resolvedHref = resolveHref(href);
  if (!resolvedHref || !text) return null;

  const link = createElement('a', className, {
    href: resolvedHref,
    'data-cta-slot': slotName,
  });
  link.textContent = text;
  return link;
}

function buildShell(config, resolvedState) {
  const content = resolveStateContent(config, resolvedState);
  const shell = createElement('section', 'vip-hero-shell', {
    'data-state-content': resolvedState === 'non-qualified' ? 'fallback' : resolvedState,
  });

  const media = createElement('div', 'vip-hero-media');
  if (config.media.image) {
    const picture = createOptimizedPicture(config.media.image, config.media.alt, true, [
      { media: '(min-width: 1200px)', width: '2400' },
      { media: '(min-width: 768px)', width: '1600' },
      { width: '900' },
    ]);
    const image = picture.querySelector('img');
    if (image) {
      image.loading = 'eager';
      image.fetchPriority = 'high';
      image.decoding = 'async';
      image.alt = config.media.alt || image.alt || '';
    }
    media.append(picture);
  }

  const scrim = createElement('div', 'vip-hero-scrim', { 'aria-hidden': 'true' });
  const frame = createElement('div', 'vip-hero-frame');
  const panel = createElement('div', 'vip-hero-panel');

  if (content.eyebrow) {
    const eyebrow = createElement('p', 'vip-hero-eyebrow');
    eyebrow.textContent = content.eyebrow;
    panel.append(eyebrow);
  }

  if (content.headline) {
    const headline = createElement('h1', 'vip-hero-headline');
    headline.textContent = content.headline;
    panel.append(headline);
  }

  if (content.body) {
    panel.append(setRichText(createElement('div', 'vip-hero-body'), content.body));
  }

  if (content.proofs.length) {
    const proofList = createElement('ul', 'vip-hero-proof-list');
    content.proofs.forEach((proof) => {
      const item = createElement('li', 'vip-hero-proof-item');
      item.textContent = proof;
      proofList.append(item);
    });
    panel.append(proofList);
  }

  const primaryCta = createCta(
    content.primaryCtaHref,
    content.primaryCtaText,
    'vip-hero-cta vip-hero-cta-primary',
    'primary',
  );
  const secondaryCta = createCta(
    content.secondaryCtaHref,
    content.secondaryCtaText,
    'vip-hero-cta vip-hero-cta-secondary',
    'secondary',
  );

  if (primaryCta || secondaryCta) {
    const actions = createElement('div', 'vip-hero-actions');
    if (primaryCta) actions.append(primaryCta);
    if (secondaryCta) actions.append(secondaryCta);
    panel.append(actions);
  }

  if (content.disclaimer) {
    panel.append(setRichText(createElement('div', 'vip-hero-disclaimer'), content.disclaimer));
  }

  frame.append(panel);
  shell.append(media, scrim, frame);
  return shell;
}

export default async function decorate(block) {
  if (typeof block._vipHeroCleanup === 'function') {
    block._vipHeroCleanup();
    delete block._vipHeroCleanup;
  }

  const config = normalizeBlockConfig(extractRawConfig(block));
  const hostSection = block.closest('.section');
  const experimentId = getExperimentId();
  const impressionStates = new Set();
  let hasObservedPersonalization = getObservedPersonalization();
  let isInViewport = false;
  let currentState = '';

  if (events.lastPayload('personalization/updated') !== undefined) {
    hasObservedPersonalization = true;
    setObservedPersonalization();
  }

  hostSection?.classList.add('vip-hero-section');
  block.classList.add(...config.classes.split(' '));
  block.dataset.blockId = BLOCK_NAME;
  block.dataset.audienceKey = config.audienceKey || '';
  block.dataset.promoRuleId = config.promoRuleId || '';

  const fireImpression = (resolvedState) => {
    if (
      !isInViewport
      || impressionStates.has(resolvedState)
      || shouldHideBlock(resolvedState, config.fallbackMode)
    ) {
      return;
    }

    impressionStates.add(resolvedState);
    pushAnalyticsEvent('vip-hero-impression', buildAnalyticsPayload({
      resolvedState,
      audienceKey: config.audienceKey,
      promoRuleId: config.promoRuleId,
      experimentId,
    }));
  };

  const render = () => {
    const personalizationData = getPersonalizationData();
    const resolvedState = resolveHeroState({
      authenticated: events.lastPayload('authenticated'),
      hasObservedPersonalization,
      audienceKey: config.audienceKey,
      segments: personalizationData?.segments,
    });

    const isHidden = shouldHideBlock(resolvedState, config.fallbackMode);
    block.dataset.resolvedState = resolvedState;
    block.classList.toggle('is-pending', resolvedState === 'pending');
    block.classList.toggle('is-qualified', resolvedState === 'qualified');
    block.classList.toggle('is-anonymous', resolvedState === 'anonymous');
    block.classList.toggle('is-non-qualified', resolvedState === 'non-qualified');

    if (hostSection) {
      hostSection.hidden = isHidden;
    }

    block.hidden = isHidden;
    block.setAttribute('aria-hidden', `${isHidden}`);

    if (!isHidden) {
      block.replaceChildren(buildShell(config, resolvedState));
    } else {
      block.replaceChildren();
    }

    if (resolvedState !== currentState) {
      currentState = resolvedState;
      pushAnalyticsEvent('vip-hero-state', buildAnalyticsPayload({
        resolvedState,
        audienceKey: config.audienceKey,
        promoRuleId: config.promoRuleId,
        experimentId,
      }));
    }

    fireImpression(resolvedState);
  };

  const handleAuthenticated = () => {
    render();
  };

  const handlePersonalizationUpdate = () => {
    hasObservedPersonalization = true;
    setObservedPersonalization();
    render();
  };

  const handleClick = (event) => {
    const cta = event.target.closest('a[data-cta-slot]');
    if (!cta || !block.contains(cta)) return;

    pushAnalyticsEvent('vip-hero-cta-click', buildAnalyticsPayload({
      resolvedState: currentState || 'pending',
      audienceKey: config.audienceKey,
      promoRuleId: config.promoRuleId,
      experimentId,
      ctaSlot: cta.dataset.ctaSlot || null,
      href: cta.getAttribute('href'),
    }));
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      isInViewport = entry.isIntersecting;
      if (entry.isIntersecting) {
        fireImpression(currentState || block.dataset.resolvedState || 'pending');
      }
    });
  }, {
    threshold: 0.35,
  });

  const authenticatedSubscription = events.on('authenticated', handleAuthenticated, { eager: true });
  const personalizationSubscription = events.on('personalization/updated', handlePersonalizationUpdate, { eager: true });

  block.addEventListener('click', handleClick);
  observer.observe(block);
  render();

  block._vipHeroCleanup = () => {
    authenticatedSubscription?.off?.();
    personalizationSubscription?.off?.();
    block.removeEventListener('click', handleClick);
    observer.disconnect();
  };
}
