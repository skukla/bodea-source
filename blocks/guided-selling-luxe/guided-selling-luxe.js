import { search } from '@dropins/storefront-product-discovery/api.js';
import { createOptimizedPicture, readBlockConfig } from '../../scripts/aem.js';
import { getProductLink } from '../../scripts/commerce.js';
/* eslint-disable import/extensions */
import {
  BLOCK_NAME,
  STORAGE_NAMESPACE,
  buildAnalyticsDetail,
  buildProductSearchRequest,
  buildSessionPayload,
  getNextOptionIndex,
  normalizeBlockConfig,
  normalizeSchema,
  resolveResultState,
  restoreSessionState,
} from './guided-selling-luxe.utils.mjs';
/* eslint-enable import/extensions */

const SEARCH_SCOPE = 'popover';
const STAGE_SHELF_COUNT = 8;
const DEFAULT_PRODUCT_COUNT = 3;
const ARROW_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

function safeSessionGet(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeSessionRemove(key) {
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function createElement(tag, options = {}) {
  const {
    className = '',
    text = '',
    html = '',
    attrs = {},
    children = [],
  } = options;

  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  if (html) element.innerHTML = html;

  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      element.setAttribute(key, value);
    }
  });

  children.forEach((child) => {
    if (child) element.append(child);
  });

  return element;
}

function createLinkButton(label, href, variant, extraClasses = []) {
  return createElement('a', {
    className: [
      'guided-selling-luxe__button',
      `guided-selling-luxe__button--${variant}`,
      ...extraClasses,
    ].join(' '),
    text: label,
    attrs: {
      href,
    },
  });
}

function formatCurrency(value, currency = 'USD') {
  if (!Number.isFinite(Number(value))) return '';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `$${Number(value)}`;
  }
}

function getProductPriceLabel(product) {
  const rangeCurrency = product?.priceRange?.minimum?.final?.amount?.currency
    || product?.priceRange?.minimum?.regular?.amount?.currency;
  const singleCurrency = product?.price?.final?.amount?.currency
    || product?.price?.regular?.amount?.currency;
  const currency = rangeCurrency || singleCurrency || 'USD';

  if (product?.priceRange?.minimum?.final?.amount?.value !== undefined) {
    const min = product.priceRange.minimum.final.amount.value;
    const max = product?.priceRange?.maximum?.final?.amount?.value;
    if (max !== undefined && Number(max) !== Number(min)) {
      return `${formatCurrency(min, currency)} - ${formatCurrency(max, currency)}`;
    }
    return formatCurrency(min, currency);
  }

  if (product?.price?.final?.amount?.value !== undefined) {
    return formatCurrency(product.price.final.amount.value, currency);
  }

  if (product?.price?.regular?.amount?.value !== undefined) {
    return formatCurrency(product.price.regular.amount.value, currency);
  }

  return '';
}

function createPictureFromSchema(media, title) {
  const imageSrc = media?.image;
  if (!imageSrc) return null;
  return createOptimizedPicture(imageSrc, media.alt || title || '', false, [{ width: '1200' }]);
}

function createStageShell() {
  const cabinet = createElement('div', {
    className: 'guided-selling-luxe__cabinet',
    children: [
      createElement('div', { className: 'guided-selling-luxe__cabinet-top' }),
      createElement('div', { className: 'guided-selling-luxe__cabinet-side' }),
      createElement('div', { className: 'guided-selling-luxe__cabinet-door' }),
      createElement('div', { className: 'guided-selling-luxe__cabinet-screen' }),
      createElement('div', { className: 'guided-selling-luxe__cabinet-handle' }),
    ],
  });

  const shelves = createElement('div', { className: 'guided-selling-luxe__cabinet-shelves' });
  for (let i = 0; i < STAGE_SHELF_COUNT; i += 1) {
    shelves.append(createElement('span', { className: 'guided-selling-luxe__cabinet-shelf' }));
  }
  cabinet.append(shelves);

  return createElement('div', {
    className: 'guided-selling-luxe__stage-shell',
    children: [
      createElement('div', { className: 'guided-selling-luxe__stage-grid' }),
      createElement('div', { className: 'guided-selling-luxe__stage-halo' }),
      createElement('div', { className: 'guided-selling-luxe__stage-floor' }),
      cabinet,
    ],
  });
}

function pushAnalyticsEvent(eventName, detail) {
  if (window.adobeDataLayer && typeof window.adobeDataLayer.push === 'function') {
    window.adobeDataLayer.push({
      event: eventName,
      eventInfo: detail,
    });
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({
      event: eventName,
      ...detail,
    });
  }
}

function persistState(runtime, schema, state) {
  safeSessionSet(runtime.storageKey, JSON.stringify(buildSessionPayload(schema, state)));
}

function clearState(runtime) {
  safeSessionRemove(runtime.storageKey);
}

async function fetchSchema(config) {
  const response = await fetch(config.schemaUrl);
  if (!response.ok) {
    throw new Error(`Failed to load rack-finder schema from ${config.schemaUrl}`);
  }

  return response.json();
}

function makeResultModules(schema, resultState) {
  const alternates = resultState.alternates.map((persona) => ({
    key: `persona:${persona.id}`,
    title: persona.collection.title,
    description: persona.collection.description || persona.description,
    badge: persona.collection.badge || persona.kicker,
    route: persona.collection.route,
    type: 'alternate',
    config: {
      ...persona.collection,
    },
  }));

  const crossCategories = schema.crossCategoryModules.map((module) => ({
    key: `category:${module.id}`,
    title: module.title,
    description: module.description,
    badge: module.badge,
    route: module.route,
    type: 'category',
    config: module,
  }));

  return {
    hero: {
      key: `persona:${resultState.winner.id}`,
      title: resultState.winner.collection.title,
      description: resultState.winner.collection.description || resultState.winner.description,
      badge: resultState.winner.collection.badge || resultState.winner.kicker,
      route: resultState.winner.collection.route,
      type: 'hero',
      config: resultState.winner.collection,
    },
    alternates,
    crossCategories,
  };
}

async function hydrateModuleProducts(runtime, module) {
  if (runtime.productCache.has(module.key)) {
    return runtime.productCache.get(module.key);
  }

  const request = buildProductSearchRequest({
    ...module.config,
    limit: module.config.limit || DEFAULT_PRODUCT_COUNT,
    sort: module.config.sort || 'position_DESC',
  });

  const promise = search(request, { scope: SEARCH_SCOPE })
    .then((result) => result?.items || [])
    .catch(() => []);

  runtime.productCache.set(module.key, promise);
  return promise;
}

function createInlineStageTags(entries) {
  const list = createElement('div', { className: 'guided-selling-luxe__stage-tags' });
  entries.filter(Boolean).slice(0, 3).forEach((entry, index) => {
    list.append(createElement('span', {
      className: `guided-selling-luxe__stage-tag guided-selling-luxe__stage-tag--${index + 1}`,
      text: entry,
    }));
  });
  return list;
}

function createStageMeta(eyebrow, title, body) {
  return createElement('div', {
    className: 'guided-selling-luxe__stage-meta',
    children: [
      eyebrow ? createElement('p', { className: 'guided-selling-luxe__stage-eyebrow', text: eyebrow }) : null,
      title ? createElement('h3', { className: 'guided-selling-luxe__stage-title', text: title }) : null,
      body ? createElement('p', { className: 'guided-selling-luxe__stage-body', text: body }) : null,
    ],
  });
}

function createStage(context) {
  const stage = createElement('div', {
    className: 'guided-selling-luxe__stage',
  });
  stage.append(createStageShell());

  if (context.picture) {
    const frame = createElement('div', {
      className: 'guided-selling-luxe__stage-picture',
      children: [context.picture],
    });
    stage.append(frame);
  }

  if (context.tags?.length) {
    stage.append(createInlineStageTags(context.tags));
  }

  stage.append(createStageMeta(context.eyebrow, context.title, context.body));
  return stage;
}

function createIntroState(runtime, schema, state) {
  const blockConfig = runtime.config;
  const { hero } = schema;
  const rackTheatreBody = 'A premium advisor built for teams choosing among server racks, '
    + 'enclosures, cooling, and cable-management add-ons.';
  const stagePicture = createPictureFromSchema(hero.media, hero.title);

  const intro = createElement('section', {
    className: 'guided-selling-luxe__view guided-selling-luxe__view--intro',
  });

  const copy = createElement('div', {
    className: 'guided-selling-luxe__intro-copy',
    children: [
      createElement('p', { className: 'guided-selling-luxe__eyebrow', text: hero.eyebrow || blockConfig.eyebrowText }),
      createElement('h1', { className: 'guided-selling-luxe__title', text: hero.title || blockConfig.title }),
      createElement('p', { className: 'guided-selling-luxe__subtitle', text: hero.subtitle || blockConfig.subtitle }),
      hero.body ? createElement('p', { className: 'guided-selling-luxe__body', text: hero.body }) : null,
      createElement('div', {
        className: 'guided-selling-luxe__button-row',
        children: [
          createElement('button', {
            className: 'guided-selling-luxe__button guided-selling-luxe__button--primary',
            text: hero.primaryCtaLabel || blockConfig.primaryCtaLabel,
            attrs: {
              type: 'button',
            },
          }),
          createLinkButton(
            hero.secondaryCtaLabel || blockConfig.secondaryCtaLabel,
            hero.secondaryCtaHref || blockConfig.secondaryCtaHref,
            'secondary',
          ),
        ],
      }),
      createElement('div', {
        className: 'guided-selling-luxe__intro-stats',
        children: (hero.stats || []).map((stat) => createElement('div', {
          className: 'guided-selling-luxe__intro-stat',
          children: [
            createElement('strong', { text: stat.value }),
            createElement('span', { text: stat.label }),
          ],
        })),
      }),
      createElement('div', {
        className: 'guided-selling-luxe__intro-badges',
        children: (hero.badges || []).map((badge) => createElement('span', {
          className: 'guided-selling-luxe__intro-badge',
          text: badge,
        })),
      }),
      state.started && !state.completed
        ? createElement('p', {
          className: 'guided-selling-luxe__resume-note',
          text: 'Your previous answers are still available in this session.',
        })
        : null,
    ],
  });

  const stage = createStage({
    picture: stagePicture,
    eyebrow: 'Rack theatre',
    title: 'Cinematic rack planning',
    body: rackTheatreBody,
    tags: ['Server racks', 'Network enclosures', 'Power and cooling'],
  });

  const layout = createElement('div', {
    className: 'guided-selling-luxe__intro-layout',
    children: [copy, stage],
  });

  const button = copy.querySelector('button');
  button.addEventListener('click', () => {
    const hasAnswers = Object.keys(state.answersByQuestion).length > 0;

    state.started = true;
    state.completed = false;
    state.startedAt = Date.now();
    state.currentStepIndex = hasAnswers ? state.currentStepIndex : 0;
    persistState(runtime, schema, state);

    pushAnalyticsEvent('quiz_start', buildAnalyticsDetail(schema, state.resultState, {
      entry_path: window.location.pathname,
    }));

    render(runtime, schema, state, true);
  });

  intro.append(layout);
  return intro;
}

function createProgress(runtime, schema, state) {
  const wrap = createElement('div', { className: 'guided-selling-luxe__progress-wrap' });
  const current = Math.min(state.currentStepIndex + 1, schema.questions.length);
  const progressPercent = (current / schema.questions.length) * 100;

  wrap.append(createElement('p', {
    className: 'guided-selling-luxe__progress-copy',
    text: `Step ${current} of ${schema.questions.length}`,
    attrs: {
      role: 'status',
      'aria-live': 'polite',
    },
  }));

  wrap.append(createElement('div', {
    className: 'guided-selling-luxe__progress-bar',
    children: [
      createElement('span', {
        className: 'guided-selling-luxe__progress-fill',
        attrs: {
          style: `width:${progressPercent}%;`,
        },
      }),
    ],
  }));

  return wrap;
}

function createStepper(schema, state, onJump) {
  const list = createElement('ol', { className: 'guided-selling-luxe__stepper' });
  schema.questions.forEach((question, index) => {
    const answered = !!state.answersByQuestion[question.id];
    const current = index === state.currentStepIndex;
    const unlocked = answered || index <= state.currentStepIndex;
    const item = createElement('li', { className: 'guided-selling-luxe__stepper-item' });
    const button = createElement('button', {
      className: 'guided-selling-luxe__stepper-pill',
      text: `${index + 1}`,
      attrs: {
        type: 'button',
        'aria-label': `${question.title}. Step ${index + 1}`,
        'aria-current': current ? 'step' : null,
      },
    });

    if (answered) button.classList.add('is-answered');
    if (current) button.classList.add('is-current');
    if (!unlocked) {
      button.disabled = true;
    } else {
      button.addEventListener('click', () => onJump(index));
    }

    item.append(button);
    list.append(item);
  });
  return list;
}

function createAnswerButton(schema, question, answer, state, onSelect) {
  const active = state.answersByQuestion[question.id] === answer.id;
  const button = createElement('button', {
    className: 'guided-selling-luxe__answer',
    attrs: {
      type: 'button',
      'aria-pressed': active ? 'true' : 'false',
      'data-answer-id': answer.id,
    },
    children: [
      createElement('span', { className: 'guided-selling-luxe__answer-icon', text: answer.icon || question.kicker }),
      createElement('span', {
        className: 'guided-selling-luxe__answer-copy',
        children: [
          createElement('span', { className: 'guided-selling-luxe__answer-title', text: answer.label }),
          answer.subtitle ? createElement('span', { className: 'guided-selling-luxe__answer-subtitle', text: answer.subtitle }) : null,
          answer.description ? createElement('span', { className: 'guided-selling-luxe__answer-description', text: answer.description }) : null,
        ],
      }),
      answer.badge ? createElement('span', { className: 'guided-selling-luxe__answer-badge', text: answer.badge }) : null,
      createElement('span', { className: 'guided-selling-luxe__answer-check', text: 'Selected' }),
    ],
  });

  if (active) button.classList.add('is-active');
  button.addEventListener('click', () => onSelect(answer));
  return button;
}

function wireAnswerKeyboardNavigation(container) {
  const buttons = [...container.querySelectorAll('.guided-selling-luxe__answer:not(:disabled)')];
  buttons.forEach((button, index) => {
    button.addEventListener('keydown', (event) => {
      if (!ARROW_KEYS.has(event.key)) return;
      event.preventDefault();
      const nextIndex = getNextOptionIndex(index, event.key, buttons.length);
      buttons[nextIndex]?.focus();
    });
  });
}

function createPreviewSelections(schema, state) {
  const list = createElement('div', { className: 'guided-selling-luxe__selection-stack' });
  schema.questions.slice(0, state.currentStepIndex + 1).forEach((question) => {
    const answerId = state.answersByQuestion[question.id];
    const answer = question.answers.find((entry) => entry.id === answerId);
    if (!answer) return;

    list.append(createElement('div', {
      className: 'guided-selling-luxe__selection-row',
      children: [
        createElement('span', { className: 'guided-selling-luxe__selection-label', text: question.kicker || question.title }),
        createElement('strong', { text: answer.previewLabel || answer.label }),
      ],
    }));
  });
  return list;
}

function getSelectedPreviewTags(schema, answersByQuestion) {
  const answers = schema.questions.flatMap((entry) => entry.answers);

  return Object.values(answersByQuestion)
    .map((answerId) => answers.find((entry) => entry.id === answerId)?.previewLabel)
    .filter(Boolean);
}

function createFlowState(runtime, schema, state) {
  const question = schema.questions[state.currentStepIndex];
  const picture = createPictureFromSchema(question.media, question.title);

  const flow = createElement('section', {
    className: 'guided-selling-luxe__view guided-selling-luxe__view--flow',
  });

  const header = createElement('div', {
    className: 'guided-selling-luxe__flow-header',
    children: [
      createProgress(runtime, schema, state),
      createElement('div', {
        className: 'guided-selling-luxe__flow-controls',
        children: [
          createElement('button', {
            className: 'guided-selling-luxe__button guided-selling-luxe__button--ghost',
            text: 'Back',
            attrs: {
              type: 'button',
              disabled: state.currentStepIndex === 0 ? 'true' : null,
            },
          }),
          createElement('button', {
            className: 'guided-selling-luxe__button guided-selling-luxe__button--ghost',
            text: 'Restart',
            attrs: {
              type: 'button',
            },
          }),
        ],
      }),
    ],
  });

  const [backButton, restartButton] = header.querySelectorAll('button');
  backButton.addEventListener('click', () => {
    if (state.currentStepIndex === 0) return;
    state.currentStepIndex -= 1;
    state.completed = false;
    persistState(runtime, schema, state);
    render(runtime, schema, state, true);
  });

  restartButton.addEventListener('click', () => {
    state.started = false;
    state.completed = false;
    state.currentStepIndex = 0;
    state.answersByQuestion = {};
    state.resultState = null;
    clearState(runtime);
    pushAnalyticsEvent('quiz_restart', buildAnalyticsDetail(schema, state.resultState, {}));
    render(runtime, schema, state, false);
  });

  const copy = createElement('div', {
    className: 'guided-selling-luxe__question-copy',
    children: [
      createStepper(schema, state, (nextStepIndex) => {
        state.currentStepIndex = nextStepIndex;
        persistState(runtime, schema, state);
        render(runtime, schema, state, true);
      }),
      createElement('p', { className: 'guided-selling-luxe__eyebrow', text: question.kicker }),
      createElement('h2', { className: 'guided-selling-luxe__question-title', text: question.title }),
      question.description ? createElement('p', { className: 'guided-selling-luxe__question-description', text: question.description }) : null,
      question.supportCopy ? createElement('p', { className: 'guided-selling-luxe__question-support', text: question.supportCopy }) : null,
    ],
  });

  const answers = createElement('div', { className: 'guided-selling-luxe__answer-grid' });
  question.answers.forEach((answer) => {
    answers.append(createAnswerButton(schema, question, answer, state, (selectedAnswer) => {
      state.started = true;
      state.answersByQuestion[question.id] = selectedAnswer.id;
      persistState(runtime, schema, state);

      pushAnalyticsEvent('quiz_answer_select', buildAnalyticsDetail(schema, state.resultState, {
        step_id: question.id,
        option_id: selectedAnswer.id,
        option_label: selectedAnswer.label,
      }));

      if (state.currentStepIndex === schema.questions.length - 1) {
        state.completed = true;
        state.resultState = resolveResultState(schema, state.answersByQuestion);
        persistState(runtime, schema, state);

        const resultDetail = buildAnalyticsDetail(schema, state.resultState, {
          total_steps: schema.questions.length,
          completion_ms: Date.now() - state.startedAt,
          result_route: state.resultState.winner.collection.route,
        });
        pushAnalyticsEvent('quiz_complete', resultDetail);
        pushAnalyticsEvent('quiz_result_view', resultDetail);
        render(runtime, schema, state, true);
        return;
      }

      state.currentStepIndex += 1;
      render(runtime, schema, state, true);
    }));
  });
  wireAnswerKeyboardNavigation(answers);

  const left = createElement('div', {
    className: 'guided-selling-luxe__flow-left',
    children: [copy, answers],
  });

  const right = createElement('aside', {
    className: 'guided-selling-luxe__flow-right',
    children: [
      createStage({
        picture,
        eyebrow: question.media?.eyebrow || question.kicker,
        title: question.media?.label || question.title,
        body: question.media?.stat || question.description,
        tags: getSelectedPreviewTags(schema, state.answersByQuestion),
      }),
      createElement('div', {
        className: 'guided-selling-luxe__preview-card',
        children: [
          createElement('p', { className: 'guided-selling-luxe__preview-eyebrow', text: 'Current direction' }),
          createElement('h3', { className: 'guided-selling-luxe__preview-title', text: 'Your configuration posture' }),
          createElement('p', {
            className: 'guided-selling-luxe__preview-body',
            text: 'We keep a live summary of the answers already chosen so the recommendation feels transparent, not mysterious.',
          }),
          createPreviewSelections(schema, state),
        ],
      }),
    ],
  });

  flow.append(header);
  flow.append(createElement('div', {
    className: 'guided-selling-luxe__flow-layout',
    children: [left, right],
  }));

  pushAnalyticsEvent('quiz_step_view', buildAnalyticsDetail(schema, state.resultState, {
    step_index: state.currentStepIndex + 1,
    step_id: question.id,
    question_text: question.title,
  }));

  return flow;
}

function createProductCard(product) {
  const href = getProductLink(product.urlKey, product.sku);
  const card = createElement('a', {
    className: 'guided-selling-luxe__product-card',
    attrs: {
      href,
    },
  });

  const imageUrl = product?.images?.[0]?.url;
  const media = createElement('div', { className: 'guided-selling-luxe__product-media' });

  if (imageUrl) {
    const img = createElement('img', {
      className: 'guided-selling-luxe__product-image',
      attrs: {
        src: imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl,
        alt: product?.images?.[0]?.label || product.name || product.sku,
        loading: 'lazy',
      },
    });
    media.append(img);
  } else {
    media.append(createElement('span', {
      className: 'guided-selling-luxe__product-fallback',
      text: product.name.split(' ').slice(0, 2).map((entry) => entry[0]).join(''),
    }));
  }

  card.append(media);

  card.append(createElement('div', {
    className: 'guided-selling-luxe__product-copy',
    children: [
      createElement('span', { className: 'guided-selling-luxe__product-sku', text: product.sku }),
      createElement('strong', { className: 'guided-selling-luxe__product-name', text: product.name }),
      getProductPriceLabel(product)
        ? createElement('span', { className: 'guided-selling-luxe__product-price', text: getProductPriceLabel(product) })
        : null,
      createElement('span', { className: 'guided-selling-luxe__product-link', text: 'View product' }),
    ],
  }));

  return card;
}

function createCollectionCard(module, products, loading) {
  const card = createElement('section', { className: 'guided-selling-luxe__collection-card' });

  card.append(createElement('div', {
    className: 'guided-selling-luxe__collection-header',
    children: [
      createElement('div', {
        className: 'guided-selling-luxe__collection-copy',
        children: [
          module.badge ? createElement('span', { className: 'guided-selling-luxe__collection-badge', text: module.badge }) : null,
          createElement('h3', { className: 'guided-selling-luxe__collection-title', text: module.title }),
          module.description ? createElement('p', { className: 'guided-selling-luxe__collection-description', text: module.description }) : null,
        ],
      }),
      createLinkButton('View collection', module.route, 'secondary', ['guided-selling-luxe__collection-cta']),
    ],
  }));

  const grid = createElement('div', {
    className: `guided-selling-luxe__collection-grid${module.type === 'category' ? ' is-compact' : ''}`,
  });

  if (loading) {
    for (let i = 0; i < (module.type === 'hero' ? 3 : 2); i += 1) {
      grid.append(createElement('div', {
        className: 'guided-selling-luxe__product-card guided-selling-luxe__product-card--placeholder',
      }));
    }
  } else if (products.length) {
    products.forEach((product) => grid.append(createProductCard(product)));
  } else {
    grid.append(createElement('div', {
      className: 'guided-selling-luxe__empty-products',
      text: 'Live product details are not available right now, but the collection route is ready.',
    }));
  }

  card.append(grid);
  return card;
}

function createResultsState(runtime, schema, state) {
  const result = state.resultState || resolveResultState(schema, state.answersByQuestion);
  const modules = makeResultModules(schema, result);
  const view = createElement('section', {
    className: 'guided-selling-luxe__view guided-selling-luxe__view--results',
  });

  view.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || !view.contains(anchor)) return;

    pushAnalyticsEvent('quiz_result_click', buildAnalyticsDetail(schema, result, {
      destination_url: anchor.getAttribute('href'),
    }));
  });

  const header = createElement('div', {
    className: 'guided-selling-luxe__results-header',
    children: [
      createElement('div', {
        className: 'guided-selling-luxe__results-heading',
        children: [
          createElement('p', { className: 'guided-selling-luxe__eyebrow', text: 'Your primary recommendation' }),
          createElement('h2', { className: 'guided-selling-luxe__results-title', text: result.winner.title }),
          createElement('p', { className: 'guided-selling-luxe__results-subtitle', text: result.winner.description }),
        ],
      }),
      createElement('div', {
        className: 'guided-selling-luxe__button-row',
        children: [
          createLinkButton('Compare all server racks', schema.compareHref, 'secondary'),
          createLinkButton('Talk to a Bodea specialist', result.winner.consultationHref || schema.contactHref, 'primary'),
        ],
      }),
    ],
  });

  const summary = createElement('aside', {
    className: 'guided-selling-luxe__results-summary',
    children: [
      createStage({
        picture: createPictureFromSchema(result.winner.media, result.winner.title),
        eyebrow: result.winner.media?.eyebrow || result.winner.kicker,
        title: result.winner.title,
        body: result.winner.rationale,
        tags: result.selections.slice(0, 3).map((entry) => entry.answerLabel),
      }),
      createElement('div', {
        className: 'guided-selling-luxe__summary-card',
        children: [
          createElement('p', { className: 'guided-selling-luxe__summary-eyebrow', text: 'Why this won' }),
          createElement('h3', { className: 'guided-selling-luxe__summary-title', text: result.winner.kicker }),
          createElement('p', { className: 'guided-selling-luxe__summary-body', text: result.winner.rationale }),
          createElement('div', {
            className: 'guided-selling-luxe__summary-points',
            children: result.winner.strengths.map((entry) => createElement('span', {
              className: 'guided-selling-luxe__summary-point',
              text: entry,
            })),
          }),
        ],
      }),
      createElement('div', {
        className: 'guided-selling-luxe__summary-card',
        children: [
          createElement('p', { className: 'guided-selling-luxe__summary-eyebrow', text: 'Answer recap' }),
          ...result.selections.map((entry) => createElement('div', {
            className: 'guided-selling-luxe__summary-selection',
            children: [
              createElement('span', { text: entry.questionTitle }),
              createElement('strong', { text: entry.answerLabel }),
            ],
          })),
        ],
      }),
      createElement('div', {
        className: 'guided-selling-luxe__summary-card',
        children: [
          createElement('p', { className: 'guided-selling-luxe__summary-eyebrow', text: 'Ranked personas' }),
          ...result.ranking.slice(0, 3).map((entry, index) => createElement('div', {
            className: 'guided-selling-luxe__summary-ranking',
            children: [
              createElement('span', { text: `${index + 1}. ${entry.title}` }),
              createElement('strong', { text: `${entry.total}` }),
            ],
          })),
        ],
      }),
      createElement('button', {
        className: 'guided-selling-luxe__button guided-selling-luxe__button--ghost',
        text: 'Restart quiz',
        attrs: {
          type: 'button',
        },
      }),
    ],
  });

  summary.querySelector('button').addEventListener('click', () => {
    state.started = false;
    state.completed = false;
    state.currentStepIndex = 0;
    state.answersByQuestion = {};
    state.resultState = null;
    clearState(runtime);
    pushAnalyticsEvent('quiz_restart', buildAnalyticsDetail(schema, result, {}));
    render(runtime, schema, state, false);
  });

  const content = createElement('div', {
    className: 'guided-selling-luxe__results-content',
    children: [
      createElement('div', { className: 'guided-selling-luxe__results-loading' }),
    ],
  });

  view.append(header);
  view.append(createElement('div', {
    className: 'guided-selling-luxe__results-layout',
    children: [summary, content],
  }));

  const heroCard = createCollectionCard(modules.hero, [], true);
  const altWrap = createElement('div', {
    className: 'guided-selling-luxe__alternate-grid',
    children: modules.alternates.map((module) => createCollectionCard(module, [], true)),
  });
  const categoryWrap = createElement('div', {
    className: 'guided-selling-luxe__category-grid',
    children: modules.crossCategories.map((module) => createCollectionCard(module, [], true)),
  });

  content.innerHTML = '';
  content.append(
    heroCard,
    createElement('div', {
      className: 'guided-selling-luxe__section-head',
      children: [
        createElement('p', { className: 'guided-selling-luxe__section-kicker', text: 'Two strong alternates' }),
        createElement('h3', { className: 'guided-selling-luxe__section-title', text: 'Keep a second and third path in view' }),
      ],
    }),
    altWrap,
    createElement('div', {
      className: 'guided-selling-luxe__section-head',
      children: [
        createElement('p', { className: 'guided-selling-luxe__section-kicker', text: 'Cross-category modules' }),
        createElement('h3', { className: 'guided-selling-luxe__section-title', text: 'Round out the solution across the Bodea catalog' }),
      ],
    }),
    categoryWrap,
  );

  Promise.all([
    hydrateModuleProducts(runtime, modules.hero),
    ...modules.alternates.map((module) => hydrateModuleProducts(runtime, module)),
    ...modules.crossCategories.map((module) => hydrateModuleProducts(runtime, module)),
  ]).then((responses) => {
    const [heroProducts, ...rest] = responses;
    const alternateProducts = rest.slice(0, modules.alternates.length);
    const categoryProducts = rest.slice(modules.alternates.length);

    heroCard.replaceWith(createCollectionCard(modules.hero, heroProducts, false));
    altWrap.innerHTML = '';
    modules.alternates.forEach((module, index) => {
      altWrap.append(createCollectionCard(module, alternateProducts[index] || [], false));
    });

    categoryWrap.innerHTML = '';
    modules.crossCategories.forEach((module, index) => {
      categoryWrap.append(createCollectionCard(module, categoryProducts[index] || [], false));
    });
  });

  return view;
}

function render(runtime, schema, state, animate = false) {
  runtime.block.innerHTML = '';
  runtime.block.className = `${BLOCK_NAME} block guided-selling-luxe guided-selling-luxe--${runtime.config.theme}`;

  const shell = createElement('div', {
    className: `guided-selling-luxe__shell${animate ? ' is-entering' : ''}`,
  });

  if (!state.started) {
    shell.append(createIntroState(runtime, schema, state));
  } else if (state.completed) {
    shell.append(createResultsState(runtime, schema, state));
  } else {
    shell.append(createFlowState(runtime, schema, state));
  }

  runtime.block.append(shell);
}

function renderError(block, message) {
  block.innerHTML = '';
  block.append(createElement('div', {
    className: 'guided-selling-luxe__error',
    children: [
      createElement('p', { className: 'guided-selling-luxe__eyebrow', text: 'Rack finder unavailable' }),
      createElement('h2', { className: 'guided-selling-luxe__results-title', text: 'The guided selling experience could not load.' }),
      createElement('p', { className: 'guided-selling-luxe__subtitle', text: message }),
      createLinkButton('Browse server racks', '/server-racks?sort=position_DESC', 'secondary'),
    ],
  }));
}

export default async function decorate(block) {
  const config = normalizeBlockConfig(readBlockConfig(block), {
    pathSlug: window.location.pathname.split('/').filter(Boolean).pop(),
  });

  const runtime = {
    block,
    config,
    storageKey: `${STORAGE_NAMESPACE}:${config.blockId}`,
    productCache: new Map(),
  };

  block.innerHTML = '';
  block.append(createElement('div', {
    className: 'guided-selling-luxe__loading',
    children: [
      createElement('p', { className: 'guided-selling-luxe__eyebrow', text: config.eyebrowText }),
      createElement('h2', { className: 'guided-selling-luxe__title', text: config.title }),
      createElement('p', { className: 'guided-selling-luxe__subtitle', text: 'Loading the Bodea rack finder experience...' }),
    ],
  }));

  try {
    const rawSchema = await fetchSchema(config);
    const { errors, schema } = normalizeSchema(rawSchema);

    if (errors.length) {
      throw new Error(errors.join(' '));
    }

    const restored = restoreSessionState(schema, safeSessionGet(runtime.storageKey));
    const state = restored || {
      started: false,
      completed: false,
      currentStepIndex: 0,
      answersByQuestion: {},
      startedAt: Date.now(),
      resultState: null,
    };

    if (state.completed) {
      state.resultState = resolveResultState(schema, state.answersByQuestion);
    }

    render(runtime, schema, state, false);
  } catch (error) {
    renderError(block, error.message || 'Please try again or browse the catalog directly.');
  }
}
