export const BLOCK_NAME = 'vip-hero';
export const OBSERVED_SESSION_KEY = 'vip-hero.personalization-observed';

export const CLASS_BUNDLES = [
  {
    name: 'VIP Winter / Split Left / Proof Bar',
    value: 'vip-winter split-left with-proof-bar',
  },
  {
    name: 'VIP Winter / Overlay Right / Proof Bar',
    value: 'vip-winter overlay-right with-proof-bar',
  },
  {
    name: 'VIP Winter / Split Left',
    value: 'vip-winter split-left',
  },
];

export const DEFAULT_CLASS_BUNDLE = CLASS_BUNDLES[0].value;

const CLASS_BUNDLE_SET = new Set(CLASS_BUNDLES.map(({ value }) => value));

const DEFAULT_STATE_CONTENT = {
  pending: {
    eyebrow: 'Checking access',
    headline: 'Confirming your winter gear experience',
    body: '<p>Your account and offer eligibility are being checked.</p>',
    disclaimer: '<p>Live pricing is confirmed on the Winter Gear shopping pages.</p>',
    primaryCtaText: '',
    primaryCtaHref: '',
    secondaryCtaText: '',
    secondaryCtaHref: '',
    proofs: [],
  },
  qualified: {
    eyebrow: 'VIP Winter Access',
    headline: 'VIP Members Unlock Preferred Pricing on Winter Gear',
    body: '<p>Exclusive winter gear pricing for VIP members is confirmed when you shop the Winter Gear assortment.</p>',
    disclaimer: '<p>Pricing and offer eligibility are validated in Commerce on the destination product pages.</p>',
    primaryCtaText: 'Shop Winter Gear',
    primaryCtaHref: '',
    secondaryCtaText: '',
    secondaryCtaHref: '',
    proofs: ['Member savings', 'Free store pickup', 'Offer applies automatically'],
  },
  anonymous: {
    eyebrow: 'Winter Gear Access',
    headline: 'Sign in to check VIP member offers on winter gear',
    body: '<p>Sign in to confirm whether your account qualifies for VIP member pricing before you shop.</p>',
    disclaimer: '<p>Pricing and badges are validated on Winter Gear product pages.</p>',
    primaryCtaText: 'Sign in',
    primaryCtaHref: '',
    secondaryCtaText: '',
    secondaryCtaHref: '',
    proofs: ['Member savings', 'Free store pickup', 'Pricing confirmed in cart'],
  },
  fallback: {
    eyebrow: 'Winter Gear Season',
    headline: 'Winter gear is ready for your next trip',
    body: '<p>Shop cold-weather layers, accessories, and base-pickup essentials for the season.</p>',
    disclaimer: '<p>Any eligible pricing is confirmed on the Winter Gear shopping pages.</p>',
    primaryCtaText: 'Shop Winter Gear',
    primaryCtaHref: '',
    secondaryCtaText: '',
    secondaryCtaHref: '',
    proofs: ['Member savings', 'Free store pickup', 'Seasonal assortments'],
  },
};

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function trimHtml(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeList(values) {
  return Array.isArray(values)
    ? values.map((value) => trimString(`${value}`)).filter(Boolean)
    : [];
}

function normalizeRawConfig(rawConfig = {}) {
  return Object.entries(rawConfig).reduce((accumulator, [key, value]) => {
    accumulator[normalizeConfigKey(key)] = value;
    return accumulator;
  }, {});
}

function pickValue(config, ...keys) {
  return keys.reduce((resolvedValue, key) => {
    if (resolvedValue) {
      return resolvedValue;
    }

    const value = config[normalizeConfigKey(key)];
    return trimString(`${value ?? ''}`);
  }, '');
}

function pickHtml(config, ...keys) {
  return keys.reduce((resolvedValue, key) => {
    if (resolvedValue) {
      return resolvedValue;
    }

    const value = config[normalizeConfigKey(key)];
    return trimHtml(`${value ?? ''}`);
  }, '');
}

function buildProofs(config, prefix, fallbackProofs) {
  const proofs = [
    pickValue(config, `${prefix}-proof1`),
    pickValue(config, `${prefix}-proof2`),
    pickValue(config, `${prefix}-proof3`),
  ].filter(Boolean);

  return proofs.length ? proofs : fallbackProofs;
}

function buildStateContent(config, prefix, defaults) {
  return {
    eyebrow: pickValue(config, `${prefix}-eyebrow`) || defaults.eyebrow,
    headline: pickValue(config, `${prefix}-headline`) || defaults.headline,
    body: pickHtml(config, `${prefix}-body`) || defaults.body,
    disclaimer: pickHtml(config, `${prefix}-disclaimer`) || defaults.disclaimer,
    primaryCtaText: pickValue(config, `${prefix}-cta-text`) || defaults.primaryCtaText,
    primaryCtaHref: pickValue(config, `${prefix}-cta-href`) || defaults.primaryCtaHref,
    secondaryCtaText: pickValue(config, `${prefix}-secondary-cta-text`) || defaults.secondaryCtaText,
    secondaryCtaHref: pickValue(config, `${prefix}-secondary-cta-href`) || defaults.secondaryCtaHref,
    proofs: buildProofs(config, prefix, defaults.proofs),
  };
}

export function normalizeConfigKey(value = '') {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s/]+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeClassBundle(value = '') {
  const normalized = trimString(value)
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');

  return CLASS_BUNDLE_SET.has(normalized) ? normalized : DEFAULT_CLASS_BUNDLE;
}

export function normalizeFallbackMode(value = '') {
  return trimString(value).toLowerCase() === 'hide' ? 'hide' : 'seasonal';
}

export function encodeAudienceKey(value = '') {
  const normalized = trimString(value);
  if (!normalized) return '';

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'utf8').toString('base64');
  }

  if (typeof btoa === 'function') {
    return btoa(normalized);
  }

  return '';
}

export function normalizeBlockConfig(rawConfig = {}) {
  const config = normalizeRawConfig(rawConfig);
  const mediaImage = pickValue(config, 'media-image');
  const mediaImageAlt = pickValue(config, 'media-image-alt');

  return {
    audienceKey: pickValue(config, 'audience-key'),
    promoRuleId: pickValue(config, 'promo-rule-id'),
    fallbackMode: normalizeFallbackMode(pickValue(config, 'fallback-mode')),
    classes: normalizeClassBundle(pickValue(config, 'classes')),
    media: {
      image: mediaImage,
      alt: mediaImageAlt,
    },
    states: {
      pending: buildStateContent(config, 'pending', DEFAULT_STATE_CONTENT.pending),
      qualified: buildStateContent(config, 'qualified', DEFAULT_STATE_CONTENT.qualified),
      anonymous: buildStateContent(config, 'anonymous', DEFAULT_STATE_CONTENT.anonymous),
      fallback: buildStateContent(config, 'fallback', DEFAULT_STATE_CONTENT.fallback),
    },
  };
}

export function resolveHeroState({
  authenticated,
  hasObservedPersonalization,
  audienceKey,
  segments,
} = {}) {
  if (authenticated === false) {
    return 'anonymous';
  }

  if (authenticated !== true) {
    return 'pending';
  }

  if (!hasObservedPersonalization) {
    return 'pending';
  }

  const encodedAudienceKey = encodeAudienceKey(audienceKey);
  const runtimeSegments = normalizeList(segments);

  if (encodedAudienceKey && runtimeSegments.includes(encodedAudienceKey)) {
    return 'qualified';
  }

  return 'non-qualified';
}

export function resolveStateContent(config, resolvedState) {
  if (resolvedState === 'qualified') return config.states.qualified;
  if (resolvedState === 'anonymous') return config.states.anonymous;
  if (resolvedState === 'pending') return config.states.pending;
  return config.states.fallback;
}

export function shouldHideBlock(resolvedState, fallbackMode) {
  return resolvedState === 'non-qualified' && normalizeFallbackMode(fallbackMode) === 'hide';
}

export function buildAnalyticsPayload({
  resolvedState = 'pending',
  audienceKey = '',
  promoRuleId = '',
  experimentId = null,
  ctaSlot = null,
  href = null,
} = {}) {
  return {
    blockId: BLOCK_NAME,
    resolvedState,
    audienceKey: trimString(audienceKey),
    promoRuleId: trimString(promoRuleId),
    experimentId: trimString(experimentId) || null,
    ctaSlot,
    href,
  };
}
