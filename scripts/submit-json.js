function postPayload(action, payload, strategy) {
  const body = strategy === 'raw'
    ? payload
    : { data: payload };

  return fetch(action, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function resolveSubmissionStrategies(actionUrl) {
  const url = new URL(actionUrl, window.location.origin);
  const format = (url.searchParams.get('payload') || '').toLowerCase();
  if (format === 'raw') return ['raw'];
  if (format === 'wrapped') return ['wrapped'];
  return ['wrapped', 'raw'];
}

export async function submitJson(
  action,
  payload,
  strategies = resolveSubmissionStrategies(action),
) {
  let lastError;

  for (let i = 0; i < strategies.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await postPayload(action, payload, strategies[i]);
    if (response.ok || response.type === 'opaque') {
      return {
        ok: true,
        strategy: strategies[i],
        response,
      };
    }

    // eslint-disable-next-line no-await-in-loop
    const text = await response.text();
    lastError = new Error(text || `Submit failed: ${response.status}`);
  }

  throw lastError || new Error('Submit failed.');
}
