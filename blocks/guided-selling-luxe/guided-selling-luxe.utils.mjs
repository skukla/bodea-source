export const BLOCK_NAME = 'guided-selling-luxe';
export const STORAGE_NAMESPACE = 'guided-selling-luxe';
export const BLOCK_VERSION = '1.0.0';
export const DEFAULT_THEME = 'emerald';
export const SUPPORTED_THEMES = new Set(['emerald', 'gold']);

function toSlug(value, fallback = BLOCK_NAME) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function normalizeText(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizeUrl(value, fallback = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;

  if (normalized.startsWith('/')
    || normalized.startsWith('./')
    || normalized.startsWith('../')
    || normalized.startsWith('#')
    || normalized.startsWith('?')) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return normalized;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
}

function normalizeWeightMap(weightMap, personaIds) {
  const normalized = {};

  personaIds.forEach((personaId) => {
    const raw = weightMap?.[personaId];
    const value = Number(raw);
    normalized[personaId] = Number.isFinite(value) ? value : 0;
  });

  return normalized;
}

function normalizeSearchFilter(filter) {
  const attribute = normalizeText(filter?.attribute);
  if (!attribute) return null;

  if (
    filter?.range
    && Number.isFinite(Number(filter.range.from))
    && Number.isFinite(Number(filter.range.to))
  ) {
    return {
      attribute,
      range: {
        from: Number(filter.range.from),
        to: Number(filter.range.to),
      },
    };
  }

  const inValues = normalizeList(filter?.in)
    .map((value) => normalizeText(value))
    .filter(Boolean);
  if (!inValues.length) return null;

  return {
    attribute,
    in: inValues,
  };
}

function parseSortToken(sortToken) {
  const normalized = normalizeText(sortToken);
  if (!normalized) return [];

  return normalized.split(',').map((entry) => {
    const token = entry.trim();
    if (!token) return null;

    if (token.includes(':')) {
      const [attribute, direction = 'ASC'] = token.split(':');
      return {
        attribute: attribute.trim(),
        direction: direction.trim().toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
      };
    }

    if (token.includes('_')) {
      const lastSeparator = token.lastIndexOf('_');
      const attribute = token.slice(0, lastSeparator).trim();
      const direction = token.slice(lastSeparator + 1).trim().toUpperCase();
      return {
        attribute,
        direction: direction === 'DESC' ? 'DESC' : 'ASC',
      };
    }

    return {
      attribute: token,
      direction: 'ASC',
    };
  }).filter((entry) => entry?.attribute);
}

export function normalizeBlockConfig(rawConfig = {}, runtimeContext = {}) {
  const blockId = toSlug(rawConfig['schema-url'] || runtimeContext.pathSlug || BLOCK_NAME);
  const theme = normalizeText(rawConfig.theme, DEFAULT_THEME).toLowerCase();

  return {
    blockId,
    schemaUrl: normalizeUrl(rawConfig['schema-url'], '/data/guided-selling/bodea-rack-finder.json'),
    eyebrowText: normalizeText(rawConfig['eyebrow-text'], 'Bodea Rack Finder'),
    title: normalizeText(rawConfig.title, 'Find the right rack architecture in guided steps.'),
    subtitle: normalizeText(
      rawConfig.subtitle,
      'Move from deployment context to a curated Bodea recommendation without losing the premium catalog feel.',
    ),
    primaryCtaLabel: normalizeText(rawConfig['primary-cta-label'], 'Start the rack finder'),
    secondaryCtaLabel: normalizeText(rawConfig['secondary-cta-label'], 'Talk to a Bodea specialist'),
    secondaryCtaHref: normalizeUrl(rawConfig['secondary-cta-href'], '/contact'),
    theme: SUPPORTED_THEMES.has(theme) ? theme : DEFAULT_THEME,
  };
}

export function normalizeSchema(rawSchema = {}) {
  const errors = [];
  const quizId = normalizeText(rawSchema.id, 'bodea-rack-finder');
  const version = normalizeText(rawSchema.version, BLOCK_VERSION);

  const personas = normalizeList(rawSchema.personas).map((persona, index) => ({
    id: toSlug(persona?.id || `persona-${index + 1}`),
    title: normalizeText(persona?.title, `Persona ${index + 1}`),
    kicker: normalizeText(persona?.kicker),
    description: normalizeText(persona?.description),
    rationale: normalizeText(persona?.rationale),
    route: normalizeUrl(persona?.route, '/server-racks'),
    compareRoute: normalizeUrl(persona?.compareRoute, '/server-racks?sort=position_DESC'),
    consultationHref: normalizeUrl(persona?.consultationHref, rawSchema.contactHref || '/contact'),
    media: {
      image: normalizeUrl(persona?.media?.image),
      alt: normalizeText(persona?.media?.alt),
      eyebrow: normalizeText(persona?.media?.eyebrow),
      stat: normalizeText(persona?.media?.stat),
    },
    strengths: normalizeList(persona?.strengths)
      .map((entry) => normalizeText(entry))
      .filter(Boolean),
    collection: {
      id: normalizeText(
        persona?.collection?.id,
        `${toSlug(persona?.id || `persona-${index + 1}`)}-collection`,
      ),
      title: normalizeText(
        persona?.collection?.title,
        normalizeText(persona?.title, `Persona ${index + 1}`),
      ),
      description: normalizeText(
        persona?.collection?.description,
        normalizeText(persona?.description),
      ),
      route: normalizeUrl(
        persona?.collection?.route,
        normalizeUrl(persona?.route, '/server-racks'),
      ),
      badge: normalizeText(persona?.collection?.badge),
      limit: Number.isFinite(Number(persona?.collection?.limit))
        ? Number(persona.collection.limit)
        : 3,
      sort: normalizeText(persona?.collection?.sort, 'position_DESC'),
      search: {
        skus: normalizeList(persona?.collection?.search?.skus)
          .map((entry) => normalizeText(entry))
          .filter(Boolean),
        categoryPath: normalizeList(persona?.collection?.search?.categoryPath)
          .map((entry) => normalizeText(entry))
          .filter(Boolean),
        filters: normalizeList(persona?.collection?.search?.filters)
          .map(normalizeSearchFilter)
          .filter(Boolean),
      },
    },
  }));

  if (!personas.length) {
    errors.push('guided-selling-luxe: schema.personas must contain at least one persona.');
  }

  const personaIds = personas.map((persona) => persona.id);

  const questions = normalizeList(rawSchema.questions).map((question, questionIndex) => ({
    id: toSlug(question?.id || `question-${questionIndex + 1}`),
    kicker: normalizeText(question?.kicker, `Step ${questionIndex + 1}`),
    title: normalizeText(question?.title),
    description: normalizeText(question?.description),
    supportCopy: normalizeText(question?.supportCopy),
    media: {
      image: normalizeUrl(question?.media?.image),
      alt: normalizeText(question?.media?.alt),
      eyebrow: normalizeText(question?.media?.eyebrow),
      stat: normalizeText(question?.media?.stat),
      label: normalizeText(question?.media?.label),
    },
    answers: normalizeList(question?.answers).map((answer, answerIndex) => ({
      id: toSlug(answer?.id || `${question?.id || `question-${questionIndex + 1}`}-answer-${answerIndex + 1}`),
      label: normalizeText(answer?.label, `Answer ${answerIndex + 1}`),
      subtitle: normalizeText(answer?.subtitle),
      badge: normalizeText(answer?.badge),
      description: normalizeText(answer?.description),
      icon: normalizeText(answer?.icon),
      previewLabel: normalizeText(answer?.previewLabel),
      weights: normalizeWeightMap(answer?.weights, personaIds),
    })),
  }));

  if (!questions.length) {
    errors.push('guided-selling-luxe: schema.questions must contain at least one question.');
  }

  questions.forEach((question) => {
    if (!question.title) {
      errors.push(`guided-selling-luxe: question "${question.id}" is missing a title.`);
    }
    if (!question.answers.length) {
      errors.push(`guided-selling-luxe: question "${question.id}" must contain at least one answer.`);
    }
  });

  const tieBreakerOrder = normalizeList(rawSchema.tieBreakerOrder)
    .map((entry) => toSlug(entry))
    .filter((entry) => questions.some((question) => question.id === entry));

  const normalizedTieBreakerOrder = tieBreakerOrder.length
    ? tieBreakerOrder
    : questions.slice(0, 3).map((question) => question.id);

  const crossCategoryModules = normalizeList(rawSchema.crossCategoryModules)
    .map((module, index) => ({
      id: toSlug(module?.id || `category-module-${index + 1}`),
      title: normalizeText(module?.title, `Category module ${index + 1}`),
      description: normalizeText(module?.description),
      badge: normalizeText(module?.badge),
      route: normalizeUrl(module?.route, '/server-racks'),
      limit: Number.isFinite(Number(module?.limit)) ? Number(module.limit) : 2,
      sort: normalizeText(module?.sort, 'position_DESC'),
      media: {
        image: normalizeUrl(module?.media?.image),
        alt: normalizeText(module?.media?.alt),
      },
      search: {
        categoryPath: normalizeList(module?.search?.categoryPath)
          .map((entry) => normalizeText(entry))
          .filter(Boolean),
        skus: normalizeList(module?.search?.skus)
          .map((entry) => normalizeText(entry))
          .filter(Boolean),
        filters: normalizeList(module?.search?.filters)
          .map(normalizeSearchFilter)
          .filter(Boolean),
      },
    }));

  return {
    errors,
    schema: {
      id: quizId,
      version,
      theme: normalizeText(rawSchema.theme, DEFAULT_THEME).toLowerCase(),
      contactHref: normalizeUrl(rawSchema.contactHref, '/contact'),
      compareHref: normalizeUrl(rawSchema.compareHref, '/server-racks?sort=position_DESC'),
      tieBreakerOrder: normalizedTieBreakerOrder,
      hero: {
        eyebrow: normalizeText(rawSchema.hero?.eyebrow),
        title: normalizeText(rawSchema.hero?.title),
        subtitle: normalizeText(rawSchema.hero?.subtitle),
        body: normalizeText(rawSchema.hero?.body),
        primaryCtaLabel: normalizeText(rawSchema.hero?.primaryCtaLabel),
        secondaryCtaLabel: normalizeText(rawSchema.hero?.secondaryCtaLabel),
        secondaryCtaHref: normalizeUrl(rawSchema.hero?.secondaryCtaHref, '/server-racks'),
        stats: normalizeList(rawSchema.hero?.stats).map((stat) => ({
          value: normalizeText(stat?.value),
          label: normalizeText(stat?.label),
        })).filter((stat) => stat.value || stat.label),
        badges: normalizeList(rawSchema.hero?.badges)
          .map((entry) => normalizeText(entry))
          .filter(Boolean),
        media: {
          image: normalizeUrl(rawSchema.hero?.media?.image),
          alt: normalizeText(rawSchema.hero?.media?.alt),
        },
      },
      personas,
      personaOrder: personaIds,
      questions,
      crossCategoryModules,
    },
  };
}

export function getAnswerById(schema, questionId, answerId) {
  const question = schema?.questions?.find((entry) => entry.id === questionId);
  if (!question) return null;
  return question.answers.find((entry) => entry.id === answerId) || null;
}

export function getSelections(schema, answersByQuestion = {}) {
  return schema.questions.map((question) => {
    const answerId = answersByQuestion?.[question.id];
    const answer = answerId ? getAnswerById(schema, question.id, answerId) : null;
    return {
      questionId: question.id,
      questionTitle: question.title,
      answerId: answer?.id || '',
      answerLabel: answer?.label || '',
    };
  }).filter((entry) => entry.answerId);
}

export function rankPersonas(schema, answersByQuestion = {}) {
  const contributions = {};

  schema.personaOrder.forEach((personaId) => {
    contributions[personaId] = {
      total: 0,
      byQuestion: {},
    };
  });

  schema.questions.forEach((question) => {
    const answer = getAnswerById(schema, question.id, answersByQuestion?.[question.id]);
    if (!answer) return;

    schema.personaOrder.forEach((personaId) => {
      const value = Number(answer.weights?.[personaId] || 0);
      contributions[personaId].total += value;
      contributions[personaId].byQuestion[question.id] = value;
    });
  });

  return schema.personas.map((persona, index) => ({
    personaId: persona.id,
    title: persona.title,
    total: contributions[persona.id].total,
    tieBreakValues: schema.tieBreakerOrder
      .map((questionId) => contributions[persona.id].byQuestion[questionId] || 0),
    schemaIndex: index,
  })).sort((left, right) => {
    if (right.total !== left.total) return right.total - left.total;

    for (let i = 0; i < left.tieBreakValues.length; i += 1) {
      const delta = (right.tieBreakValues[i] || 0) - (left.tieBreakValues[i] || 0);
      if (delta !== 0) return delta;
    }

    return left.schemaIndex - right.schemaIndex;
  });
}

export function resolveResultState(schema, answersByQuestion = {}) {
  const ranking = rankPersonas(schema, answersByQuestion);
  const winner = schema.personas.find(
    (persona) => persona.id === ranking[0]?.personaId,
  ) || schema.personas[0] || null;
  const alternates = ranking.slice(1, 3)
    .map((entry) => schema.personas.find((persona) => persona.id === entry.personaId))
    .filter(Boolean);

  return {
    winner,
    alternates,
    ranking,
    selections: getSelections(schema, answersByQuestion),
  };
}

export function collectCollectionTargets(schema, resultState) {
  const targets = [];

  if (resultState?.winner?.collection?.route) {
    targets.push(resultState.winner.collection.route);
  }

  normalizeList(resultState?.alternates).forEach((persona) => {
    if (persona.collection?.route) targets.push(persona.collection.route);
  });

  normalizeList(schema?.crossCategoryModules).forEach((module) => {
    if (module.route) targets.push(module.route);
  });

  if (schema?.compareHref) {
    targets.push(schema.compareHref);
  }

  return [...new Set(targets)];
}

export function buildSessionPayload(schema, state = {}) {
  return {
    quizId: schema.id,
    version: schema.version,
    started: !!state.started,
    completed: !!state.completed,
    currentStepIndex: Number.isFinite(Number(state.currentStepIndex))
      ? Number(state.currentStepIndex)
      : 0,
    answersByQuestion: schema.questions.reduce((acc, question) => {
      const answerId = state.answersByQuestion?.[question.id];
      if (getAnswerById(schema, question.id, answerId)) {
        acc[question.id] = answerId;
      }
      return acc;
    }, {}),
    startedAt: Number.isFinite(Number(state.startedAt)) ? Number(state.startedAt) : Date.now(),
    updatedAt: Date.now(),
  };
}

export function restoreSessionState(schema, rawPayload) {
  if (!rawPayload) return null;

  try {
    const parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    if (parsed?.quizId !== schema.id || parsed?.version !== schema.version) {
      return null;
    }

    const answersByQuestion = schema.questions.reduce((acc, question) => {
      const answerId = parsed?.answersByQuestion?.[question.id];
      if (getAnswerById(schema, question.id, answerId)) {
        acc[question.id] = answerId;
      }
      return acc;
    }, {});

    const answeredCount = Object.keys(answersByQuestion).length;
    const completed = !!parsed.completed && answeredCount === schema.questions.length;
    const currentStepIndex = completed
      ? schema.questions.length - 1
      : Math.min(
        Number.isFinite(Number(parsed.currentStepIndex))
          ? Number(parsed.currentStepIndex)
          : answeredCount,
        Math.max(schema.questions.length - 1, 0),
      );

    return {
      started: !!parsed.started || answeredCount > 0 || completed,
      completed,
      currentStepIndex,
      answersByQuestion,
      startedAt: Number.isFinite(Number(parsed.startedAt)) ? Number(parsed.startedAt) : Date.now(),
    };
  } catch {
    return null;
  }
}

export function buildProductSearchRequest(moduleConfig = {}) {
  const filters = [];

  const categoryPath = normalizeList(moduleConfig?.search?.categoryPath)
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
  const skus = normalizeList(moduleConfig?.search?.skus)
    .map((entry) => normalizeText(entry))
    .filter(Boolean);

  if (categoryPath.length) {
    filters.push({
      attribute: 'categoryPath',
      in: categoryPath,
    });
  }

  if (skus.length) {
    filters.push({
      attribute: 'sku',
      in: skus,
    });
  }

  normalizeList(moduleConfig?.search?.filters)
    .map(normalizeSearchFilter)
    .filter(Boolean)
    .forEach((filter) => filters.push(filter));

  filters.push({
    attribute: 'visibility',
    in: ['Search', 'Catalog, Search'],
  });

  return {
    phrase: normalizeText(moduleConfig?.phrase),
    currentPage: 1,
    pageSize: Number.isFinite(Number(moduleConfig?.limit)) ? Number(moduleConfig.limit) : 3,
    sort: parseSortToken(moduleConfig?.sort || 'position_DESC'),
    filter: filters,
  };
}

export function getNextOptionIndex(currentIndex, key, total) {
  if (!Number.isFinite(currentIndex) || !Number.isFinite(total) || total <= 0) return 0;

  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return Math.min(currentIndex + 1, total - 1);
  if (key === 'ArrowLeft' || key === 'ArrowUp') return Math.max(currentIndex - 1, 0);
  return currentIndex;
}

export function buildAnalyticsDetail(schema, resultState, extra = {}) {
  return {
    quiz_id: schema.id,
    quiz_version: schema.version,
    persona_id: resultState?.winner?.id || '',
    persona_rankings: normalizeList(resultState?.ranking).map((entry) => `${entry.personaId}:${entry.total}`),
    collection_targets: collectCollectionTargets(schema, resultState),
    ...extra,
  };
}
