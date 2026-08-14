export const MISSING_CUSTOMER_SEGMENTS_WARNING = '[customer-segment-personalization-block] Missing customerSegments authoring. The block will remain hidden.';

function encodeBase64(value) {
  if (typeof btoa === 'function') {
    return btoa(value);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf-8').toString('base64');
  }

  throw new Error('Base64 encoding is not available in this environment.');
}

export function parseCustomerSegments(rawValue) {
  if (typeof rawValue !== 'string') {
    return [];
  }

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => encodeBase64(value));
}

export function normalizeRuntimeSegments(values) {
  return Array.isArray(values)
    ? values.map((value) => `${value}`.trim()).filter(Boolean)
    : [];
}

export function includesAny(actualValues, expectedValues) {
  return expectedValues.some((value) => actualValues.includes(value));
}

export function evaluateSegmentVisibility(configuredSegments, runtimeSegments) {
  const normalizedConfiguredSegments = Array.isArray(configuredSegments)
    ? configuredSegments.map((value) => `${value}`.trim()).filter(Boolean)
    : [];

  if (!normalizedConfiguredSegments.length) {
    return {
      visible: false,
      matches: false,
      misconfigured: true,
      warning: MISSING_CUSTOMER_SEGMENTS_WARNING,
    };
  }

  const normalizedRuntimeSegments = normalizeRuntimeSegments(runtimeSegments);
  const matches = includesAny(normalizedRuntimeSegments, normalizedConfiguredSegments);

  return {
    visible: matches,
    matches,
    misconfigured: false,
    warning: '',
  };
}
