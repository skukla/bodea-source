/*
 * Quiz Router Block
 * Guided "find your perfect product" wizard that routes to PLP/PDP/fragment.
 */

import { getMetadata } from '../../scripts/aem.js';
import { loadFragment, mountFragment } from '../fragment/fragment.js';

const NEXT_STEP = '#next';
const STORAGE_NAMESPACE = 'quizrouter';
const QUIZ_VERSION = '1.0.0';
const THEMES = new Set(['default', 'compact', 'card', 'premium']);
const RESULT_MODES = new Set(['navigate', 'fragment']);
const URL_START_TOKENS = ['#', '/', './', '../', '?'];
const PRESENTATION_SEPARATOR = '||';
const TRANSITION_DELAY_MS = 120;
const KEY_ARROW_RIGHT = 'ArrowRight';
const KEY_ARROW_LEFT = 'ArrowLeft';
const KEY_ARROW_DOWN = 'ArrowDown';
const KEY_ARROW_UP = 'ArrowUp';
const KEY_HOME = 'Home';
const KEY_END = 'End';
const SVG_NS = 'http://www.w3.org/2000/svg';

const SAFE_TEXT_TAGS = new Set([
  'p',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'span',
  'ul',
  'ol',
  'li',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'small',
  'sup',
  'sub',
]);
const SAFE_MEDIA_TAGS = new Set(['picture', 'img']);

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function toSlug(value, fallback = 'quiz-router') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

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

function createSessionId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${stamp}${random}`;
}

function getQuizId(block) {
  const section = block.closest('.section');
  const sectionId = section?.dataset?.quizrouterId;
  const pageId = getMetadata('quizrouter-id');
  const pathSlug = window.location.pathname === '/'
    ? 'home'
    : window.location.pathname.split('/').filter(Boolean).pop();

  return toSlug(sectionId || pageId || pathSlug || 'quiz-router');
}

function getQuizSessionId(quizId) {
  const sessionIdKey = `${STORAGE_NAMESPACE}:${quizId}:session-id`;
  const existing = safeSessionGet(sessionIdKey);
  if (existing) return existing;

  const created = createSessionId();
  safeSessionSet(sessionIdKey, created);
  return created;
}

function normalizeAnswersForStorage(answers) {
  return answers.map((answer) => ({
    stepId: answer.stepId,
    optionId: answer.optionId,
    nextAction: answer.nextAction,
  }));
}

function persistQuizSession(runtime, state) {
  const payload = {
    quizId: runtime.quizId,
    quizVersion: runtime.quizVersion,
    sessionId: runtime.sessionId,
    stepIndex: state.currentStep,
    maxVisitedStep: state.maxVisitedStep,
    selectedOptionIds: state.answers.map((answer) => answer.optionId),
    answers: normalizeAnswersForStorage(state.answers),
    updatedAt: new Date().toISOString(),
  };
  safeSessionSet(runtime.storageKey, JSON.stringify(payload));
}

function clearQuizSession(runtime) {
  safeSessionRemove(runtime.storageKey);
}

function pushQuizEvent(eventName, payload = {}) {
  const eventPayload = { ...payload };

  if (window.adobeDataLayer && typeof window.adobeDataLayer.push === 'function') {
    window.adobeDataLayer.push({
      event: eventName,
      eventInfo: eventPayload,
    });
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({
      event: eventName,
      ...eventPayload,
    });
  }
}

function resolveNextAction(optionAction, resultMode) {
  if (optionAction === 'next') return 'next';
  if (optionAction === 'fragment' && resultMode === 'fragment') return 'fragment';
  if (optionAction === 'disabled') return 'disabled';
  return 'navigate';
}

function looksLikeUrlValue(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === NEXT_STEP) return true;
  if (URL_START_TOKENS.some((token) => raw.startsWith(token))) return true;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return true;
  if (/^[a-z][a-z0-9+.-]*:/.test(raw)) return true;
  if (raw.startsWith('//')) return true;
  return false;
}

function sanitizeUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  if (raw.toLowerCase() === NEXT_STEP) return NEXT_STEP;
  if (raw.startsWith('//')) return '';

  if (URL_START_TOKENS.some((token) => raw.startsWith(token))) {
    return raw;
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (parsed.origin !== window.location.origin) return '';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '';
  }
}

function parseLabelPresentation(rawLabel) {
  const text = String(rawLabel || '').trim();
  if (!text) {
    return {
      title: '',
      subtitle: '',
      badge: '',
      icon: '',
    };
  }

  const segments = text.split(PRESENTATION_SEPARATOR).map((segment) => segment.trim());

  return {
    title: segments[0] || text,
    subtitle: segments[1] || '',
    badge: segments[2] || '',
    icon: segments[3] || '',
  };
}

function readLabelCell(cell) {
  const anchor = cell?.querySelector('a[href]');
  if (anchor) {
    const rawHref = (anchor.getAttribute('href') || '').trim();
    return {
      label: anchor.textContent.trim(),
      href: sanitizeUrl(rawHref),
      hasHref: !!rawHref,
      rawHref,
    };
  }

  const text = (cell?.textContent || '').trim();
  const hasPresentationSyntax = text.includes(PRESENTATION_SEPARATOR);
  const pipeIdx = text.indexOf('|');

  if (!hasPresentationSyntax && pipeIdx >= 0) {
    const maybeHref = text.slice(pipeIdx + 1).trim();
    if (looksLikeUrlValue(maybeHref)) {
      return {
        label: text.slice(0, pipeIdx).trim(),
        href: sanitizeUrl(maybeHref),
        hasHref: true,
        rawHref: maybeHref,
      };
    }
  }

  return {
    label: text,
    href: '',
    hasHref: false,
    rawHref: '',
  };
}

function readUrlCell(cell) {
  const anchor = cell?.querySelector('a[href]');
  if (anchor) {
    const rawValue = (anchor.getAttribute('href') || '').trim();
    return {
      href: sanitizeUrl(rawValue),
      hasValue: !!rawValue,
      rawValue,
    };
  }

  const text = (cell?.textContent || '').trim();
  if (!text) {
    return {
      href: '',
      hasValue: false,
      rawValue: '',
    };
  }

  const pipeIdx = text.indexOf('|');
  const rawValue = pipeIdx >= 0 ? text.slice(pipeIdx + 1).trim() : text;
  return {
    href: sanitizeUrl(rawValue),
    hasValue: !!rawValue,
    rawValue,
  };
}

function isFragmentPath(href) {
  if (!href || typeof href !== 'string') return false;
  const trimmed = href.trim();
  return trimmed.startsWith('/') && (trimmed.startsWith('/fragments/') || trimmed.includes('/fragments/'));
}

function resolveOptionAction(href, hasDestinationInput) {
  if (href === NEXT_STEP) return 'next';
  if (!href && !hasDestinationInput) return 'next';
  if (!href) return 'disabled';
  if (isFragmentPath(href)) return 'fragment';
  return 'navigate';
}

function sanitizeCellContent(cell, options = {}) {
  const { preserveImages = false } = options;
  const fragment = document.createDocumentFragment();
  if (!cell) return fragment;

  const allowedTags = preserveImages
    ? new Set([...SAFE_TEXT_TAGS, ...SAFE_MEDIA_TAGS])
    : SAFE_TEXT_TAGS;

  const clone = cell.cloneNode(true);
  clone.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,input,textarea,select,button').forEach((unsafe) => {
    unsafe.remove();
  });

  clone.querySelectorAll('a').forEach((anchor) => {
    const span = document.createElement('span');
    span.textContent = anchor.textContent.trim();
    anchor.replaceWith(span);
  });

  if (!preserveImages) {
    clone.querySelectorAll('picture,img,source,video,audio').forEach((media) => media.remove());
  }

  const allNodes = [...clone.querySelectorAll('*')];
  for (let i = allNodes.length - 1; i >= 0; i -= 1) {
    const el = allNodes[i];
    const tag = el.tagName.toLowerCase();

    if (!allowedTags.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
      }
      el.remove();
    } else {
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'style' || name === 'srcdoc' || name === 'id' || name === 'class') {
          el.removeAttribute(attr.name);
        }
      });

      if (tag === 'img') {
        const rawSrc = (el.getAttribute('src') || '').trim();
        const safeSrc = sanitizeUrl(rawSrc);
        const invalidImageSrc = !safeSrc || safeSrc === NEXT_STEP || safeSrc.startsWith('#') || safeSrc.startsWith('?');
        if (invalidImageSrc) {
          el.remove();
        } else {
          el.setAttribute('src', safeSrc);
          [...el.attributes].forEach((attr) => {
            const name = attr.name.toLowerCase();
            if (!['src', 'alt', 'loading', 'width', 'height'].includes(name)) {
              el.removeAttribute(attr.name);
            }
          });
        }
      } else if (tag === 'picture') {
        [...el.attributes].forEach((attr) => {
          el.removeAttribute(attr.name);
        });
        el.querySelectorAll('source').forEach((source) => source.remove());
      } else {
        [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
      }
    }
  }

  while (clone.firstChild) {
    fragment.append(clone.firstChild);
  }
  return fragment;
}

function parseTypedRows(rows) {
  const steps = [];
  let currentQuestion = null;

  rows.forEach((row, index) => {
    const cells = [...row.children];
    const type = (cells[0]?.textContent || '').trim().toLowerCase();
    const rowNum = index + 1;

    if (!type) {
      console.warn(`quiz-router: row ${rowNum} missing row type. Expected "question" or "option".`);
      return;
    }

    if (type === 'question') {
      const labelCell = cells[1];
      const questionText = (labelCell?.textContent || '').trim();
      if (!questionText) {
        console.warn(`quiz-router: row ${rowNum} question has no text.`);
        return;
      }

      const stepNumber = steps.length + 1;
      currentQuestion = {
        rowNum,
        stepId: `q${stepNumber}`,
        text: questionText,
        questionCell: labelCell?.cloneNode(true) || null,
        mediaCell: cells[2]?.cloneNode(true) || null,
        options: [],
      };
      steps.push(currentQuestion);
      return;
    }

    if (type === 'option') {
      if (!currentQuestion) {
        console.warn(`quiz-router: row ${rowNum} option has no preceding question.`);
        return;
      }

      const labelCell = cells[1];
      const urlCell = cells[2];
      const labelData = readLabelCell(labelCell);
      const urlData = readUrlCell(urlCell);
      const label = labelData.label || (labelCell?.textContent || '').trim();
      const presentation = parseLabelPresentation(label);
      const href = labelData.href || urlData.href || '';
      const destinationInput = labelData.hasHref || urlData.hasValue;
      const action = resolveOptionAction(href, destinationInput);

      if (!presentation.title) {
        console.warn(`quiz-router: row ${rowNum} option has no label.`);
        return;
      }

      if (action === 'disabled') {
        const invalidTarget = labelData.rawHref || urlData.rawValue || '(empty)';
        console.warn(`quiz-router: row ${rowNum} option "${presentation.title}" has blocked destination "${invalidTarget}". Rendering disabled option.`);
      }

      currentQuestion.options.push({
        optionId: `${currentQuestion.stepId}-o${currentQuestion.options.length + 1}`,
        label,
        presentation,
        href,
        action,
        rowNum,
      });
      return;
    }

    console.warn(`quiz-router: row ${rowNum} has unsupported type "${type}".`);
  });

  return steps.filter((step) => {
    if (step.options.length > 0) return true;
    console.warn(`quiz-router: row ${step.rowNum} question "${step.text}" has no options and will be skipped.`);
    return false;
  });
}

function getConfig(block) {
  const section = block.closest('.section');
  const sectionData = section?.dataset || {};

  const get = (key, fallback) => {
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const sectionVal = sectionData[camelKey];
    if (sectionVal !== undefined && sectionVal !== '') return sectionVal;
    const pageVal = getMetadata(key);
    if (pageVal !== undefined && pageVal !== '') return pageVal;
    return fallback;
  };

  const progressRaw = get('quizrouter-progress', 'true');
  const progress = String(progressRaw).trim().toLowerCase() !== 'false';

  const themeRaw = get('quizrouter-theme', 'default');
  const theme = String(themeRaw).trim().toLowerCase();

  const resultModeRaw = get('quizrouter-result-mode', 'navigate');
  const resultMode = String(resultModeRaw).trim().toLowerCase();

  return {
    progress,
    theme: THEMES.has(theme) ? theme : 'default',
    resultMode: RESULT_MODES.has(resultMode) ? resultMode : 'navigate',
  };
}

function findOptionById(steps, stepId, optionId) {
  const step = steps.find((item) => item.stepId === stepId);
  if (!step) return null;
  return step.options.find((item) => item.optionId === optionId) || null;
}

function restoreQuizSession(runtime, steps) {
  const raw = safeSessionGet(runtime.storageKey);
  if (!raw) {
    return {
      stepIndex: 0,
      answers: [],
      maxVisitedStep: 0,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.quizId !== runtime.quizId || parsed.sessionId !== runtime.sessionId) {
      return {
        stepIndex: 0,
        answers: [],
        maxVisitedStep: 0,
      };
    }

    const answers = Array.isArray(parsed.answers)
      ? parsed.answers
        .map((answer) => {
          const stepId = String(answer?.stepId || '').trim();
          const optionId = String(answer?.optionId || '').trim();
          if (!stepId || !optionId) return null;

          const option = findOptionById(steps, stepId, optionId);
          if (!option) return null;

          return {
            stepId,
            optionId,
            nextAction: String(answer?.nextAction || resolveNextAction(option.action, 'navigate')),
          };
        })
        .filter(Boolean)
      : [];

    const stepIndexNumber = Number(parsed.stepIndex);
    const stepIndex = Number.isInteger(stepIndexNumber)
      ? Math.max(0, Math.min(stepIndexNumber, steps.length - 1))
      : 0;

    const maxVisitedRaw = Number(parsed.maxVisitedStep);
    const maxVisitedStep = Number.isInteger(maxVisitedRaw)
      ? Math.max(stepIndex, Math.min(maxVisitedRaw, steps.length - 1))
      : stepIndex;

    return {
      stepIndex,
      answers,
      maxVisitedStep,
    };
  } catch {
    return {
      stepIndex: 0,
      answers: [],
      maxVisitedStep: 0,
    };
  }
}

function getAnswerForStep(state, stepId) {
  return state.answers.find((answer) => answer.stepId === stepId) || null;
}

function setStepAnswer(state, step, option, nextAction) {
  state.answers = state.answers.filter((answer) => answer.stepId !== step.stepId);
  state.answers.push({
    stepId: step.stepId,
    optionId: option.optionId,
    nextAction,
  });
}

function makeOptionAriaLabel(option) {
  if (option.presentation.subtitle) {
    return `${option.presentation.title}. ${option.presentation.subtitle}`;
  }
  return option.presentation.title;
}

function createArrowIcon(action) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.25');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute(
    'd',
    action === 'next'
      ? 'M4 12h16m0 0-6-6m6 6-6 6'
      : 'M7 17 17 7m-8 0h8v8',
  );
  svg.append(path);
  return svg;
}

function createOptionElement(step, option, state, onSelect) {
  const el = document.createElement('button');
  const selected = getAnswerForStep(state, step.stepId)?.optionId === option.optionId;

  el.type = 'button';
  el.className = 'quiz-router-option';
  el.dataset.action = option.action;
  el.dataset.optionId = option.optionId;
  el.setAttribute('aria-label', makeOptionAriaLabel(option));
  el.setAttribute('aria-pressed', selected ? 'true' : 'false');

  if (selected) {
    el.classList.add('is-selected');
  }

  const check = document.createElement('span');
  check.className = 'quiz-router-option-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = '✓';
  el.append(check);

  const tile = document.createElement('span');
  tile.className = 'quiz-router-option-main';

  if (option.presentation.icon) {
    const icon = document.createElement('span');
    icon.className = 'quiz-router-option-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = option.presentation.icon;
    tile.append(icon);
  }

  const copy = document.createElement('span');
  copy.className = 'quiz-router-option-copy';

  const title = document.createElement('span');
  title.className = 'quiz-router-option-title';
  title.textContent = option.presentation.title;
  copy.append(title);

  if (option.presentation.subtitle) {
    const subtitle = document.createElement('span');
    subtitle.className = 'quiz-router-option-subtitle';
    subtitle.textContent = option.presentation.subtitle;
    copy.append(subtitle);
  }

  tile.append(copy);
  el.append(tile);

  if (option.presentation.badge) {
    const badge = document.createElement('span');
    badge.className = 'quiz-router-option-badge';
    badge.textContent = option.presentation.badge;
    el.append(badge);
  }

  const arrow = document.createElement('span');
  arrow.className = 'quiz-router-option-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.append(createArrowIcon(option.action));
  el.append(arrow);

  if (option.action === 'disabled') {
    el.disabled = true;
    el.classList.add('quiz-router-option--disabled');
    el.setAttribute('aria-disabled', 'true');
  }

  if (state.isBusy) {
    el.disabled = true;
    el.classList.add('is-loading');
  }

  el.addEventListener('click', () => {
    if (el.disabled || state.isBusy) return;
    onSelect(option);
  });

  return el;
}

function attachOptionKeyboardNavigation(optionsEl) {
  optionsEl.addEventListener('keydown', (event) => {
    const keys = [
      KEY_ARROW_RIGHT,
      KEY_ARROW_LEFT,
      KEY_ARROW_DOWN,
      KEY_ARROW_UP,
      KEY_HOME,
      KEY_END,
    ];

    if (!keys.includes(event.key)) return;

    const active = document.activeElement;
    if (!active || !active.classList.contains('quiz-router-option')) return;

    const availableOptions = [...optionsEl.querySelectorAll('.quiz-router-option:not(:disabled)')];
    const currentIndex = availableOptions.indexOf(active);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;

    if (event.key === KEY_HOME) nextIndex = 0;
    if (event.key === KEY_END) nextIndex = availableOptions.length - 1;
    if (event.key === KEY_ARROW_RIGHT || event.key === KEY_ARROW_DOWN) {
      nextIndex = Math.min(availableOptions.length - 1, currentIndex + 1);
    }
    if (event.key === KEY_ARROW_LEFT || event.key === KEY_ARROW_UP) {
      nextIndex = Math.max(0, currentIndex - 1);
    }

    if (nextIndex === currentIndex) return;

    event.preventDefault();
    availableOptions[nextIndex].focus();
  });
}

function setProgressText(progressEl, stepIndex, totalSteps) {
  if (!progressEl) return;

  const current = document.createElement('span');
  current.textContent = String(stepIndex + 1);

  const total = document.createElement('span');
  total.textContent = String(totalSteps);

  progressEl.replaceChildren(
    document.createTextNode('Step '),
    current,
    document.createTextNode(' of '),
    total,
  );
}

function createProgressElement(stepIndex, totalSteps) {
  const progressEl = document.createElement('div');
  progressEl.className = 'quiz-router-progress';
  progressEl.setAttribute('role', 'status');
  progressEl.setAttribute('aria-live', 'polite');
  setProgressText(progressEl, stepIndex, totalSteps);
  return progressEl;
}

function renderStepper(stepperEl, state, steps, onStepJump) {
  stepperEl.replaceChildren();

  steps.forEach((step, index) => {
    const li = document.createElement('li');
    li.className = 'quiz-router-step-item';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-router-step-pill';
    button.textContent = index < state.currentStep ? '✓' : String(index + 1);
    button.setAttribute('aria-label', `Go to step ${index + 1}: ${step.text}`);

    const isActive = index === state.currentStep;
    const isVisited = index < state.currentStep;
    const isReachable = index <= state.maxVisitedStep;

    if (isActive) {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'step');
    }

    if (isVisited) {
      button.classList.add('is-visited');
    } else if (!isReachable) {
      button.disabled = true;
      button.classList.add('is-locked');
    }

    if (state.isBusy) {
      button.disabled = true;
    }

    button.addEventListener('click', () => {
      if (button.disabled || state.isBusy || index === state.currentStep) return;
      onStepJump(index);
    });

    li.append(button);

    if (index < steps.length - 1) {
      const connector = document.createElement('div');
      connector.className = 'quiz-router-step-connector';
      const connectorFill = document.createElement('div');
      connectorFill.className = 'quiz-router-step-connector-fill';
      connectorFill.style.width = index < state.currentStep ? '100%' : '0%';
      connector.append(connectorFill);
      li.append(connector);
    }

    stepperEl.append(li);
  });
}

function setContentEntering(content) {
  content.classList.remove('is-entering');
  window.requestAnimationFrame(() => {
    content.classList.add('is-entering');
  });
}

function renderStepContent(content, step, stepIndex, state, isPremium, onOptionSelect) {
  content.replaceChildren();

  const questionWrap = document.createElement('div');
  questionWrap.className = 'quiz-router-question';

  if (isPremium) {
    const questionEyebrow = document.createElement('div');
    questionEyebrow.className = 'quiz-router-question-eyebrow';
    questionEyebrow.textContent = `Question ${stepIndex + 1}`;
    questionWrap.append(questionEyebrow);
  }

  const questionText = document.createElement('div');
  questionText.className = 'quiz-router-question-text';
  questionText.append(sanitizeCellContent(step.questionCell));
  if (!questionText.textContent.trim()) {
    questionText.textContent = step.text;
  }

  questionWrap.append(questionText);
  content.append(questionWrap);

  const mediaContent = sanitizeCellContent(step.mediaCell, { preserveImages: true });
  if (mediaContent.childNodes.length) {
    const mediaEl = document.createElement('div');
    mediaEl.className = 'quiz-router-media';
    mediaEl.append(mediaContent);
    content.append(mediaEl);
  }

  const optionsEl = document.createElement('div');
  optionsEl.className = 'quiz-router-options';

  step.options.forEach((option) => {
    const optionEl = createOptionElement(step, option, state, onOptionSelect);
    optionsEl.append(optionEl);
  });

  attachOptionKeyboardNavigation(optionsEl);
  content.append(optionsEl);
  setContentEntering(content);
}

export default async function decorate(block) {
  const rows = [...block.children].filter((row) => row.tagName === 'DIV');
  const steps = parseTypedRows(rows);

  if (steps.length === 0) {
    block.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'quiz-router-empty';
    msg.textContent = 'Configure quiz-router with question and option rows.';
    block.append(msg);
    return;
  }

  const config = getConfig(block);
  const quizId = getQuizId(block);
  const sessionId = getQuizSessionId(quizId);
  const runtime = {
    quizId,
    quizVersion: QUIZ_VERSION,
    sessionId,
    entryPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    storageKey: `${STORAGE_NAMESPACE}:${quizId}:${sessionId}`,
  };

  block.classList.add(`quiz-router--${config.theme}`);

  const wrapper = document.createElement('div');
  wrapper.className = 'quiz-router-wrapper';

  const shell = document.createElement('div');
  shell.className = 'quiz-router-shell';

  const header = document.createElement('div');
  header.className = 'quiz-router-header';

  const showProgress = config.progress && steps.length > 1;
  const progressEl = showProgress
    ? createProgressElement(0, steps.length)
    : null;
  if (progressEl && config.theme !== 'premium') {
    header.append(progressEl);
  }

  let progressFill = null;
  let progressWrap = null;
  if (showProgress && config.theme === 'premium') {
    progressWrap = document.createElement('div');
    progressWrap.className = 'quiz-router-progress-wrap';
    if (progressEl) {
      progressWrap.append(progressEl);
    }
    const progressTrack = document.createElement('div');
    progressTrack.className = 'quiz-router-progress-track';
    progressFill = document.createElement('div');
    progressFill.className = 'quiz-router-progress-fill';
    progressTrack.append(progressFill);
    progressWrap.append(progressTrack);
  }

  const controls = document.createElement('div');
  controls.className = 'quiz-router-controls';

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'quiz-router-control quiz-router-control-back';
  backButton.textContent = '← Back';

  const restartButton = document.createElement('button');
  restartButton.type = 'button';
  restartButton.className = 'quiz-router-control quiz-router-control-restart';
  restartButton.textContent = 'Restart';

  controls.append(backButton, restartButton);

  if (config.theme === 'premium') {
    if (progressWrap) {
      header.append(progressWrap);
    }
    header.append(controls);
  }

  const stepper = document.createElement('ol');
  stepper.className = 'quiz-router-stepper';
  if (config.theme === 'premium') {
    shell.append(header, stepper);
  } else {
    shell.append(header);
  }

  const content = document.createElement('div');
  content.className = 'quiz-router-content';

  let footer = null;
  if (config.theme === 'premium') {
    footer = document.createElement('div');
    footer.className = 'quiz-router-footer';

    const footerPip = document.createElement('span');
    footerPip.className = 'quiz-router-footer-pip';
    footerPip.setAttribute('aria-hidden', 'true');

    const footerText = document.createElement('span');
    footerText.className = 'quiz-router-footer-text';
    footerText.textContent = 'Your answers are saved for this session only.';

    footer.append(footerPip, footerText);
  }

  const state = {
    currentStep: 0,
    maxVisitedStep: 0,
    isBusy: false,
    startedAt: performance.now(),
    lastTrackedStep: -1,
    isCompleteTracked: false,
    answers: [],
  };

  const restored = restoreQuizSession(runtime, steps);
  state.currentStep = restored.stepIndex;
  state.maxVisitedStep = restored.maxVisitedStep;
  state.answers = restored.answers;

  const persistState = () => {
    persistQuizSession(runtime, state);
  };

  const trackStepView = (stepIndex) => {
    if (state.lastTrackedStep === stepIndex) return;
    const step = steps[stepIndex];
    if (!step) return;

    pushQuizEvent('quiz_step_view', {
      quiz_id: runtime.quizId,
      step_index: stepIndex + 1,
      step_id: step.stepId,
      question_text: step.text,
    });
    state.lastTrackedStep = stepIndex;
  };

  const trackAnswer = (step, option, nextAction) => {
    setStepAnswer(state, step, option, nextAction);
    persistState();

    pushQuizEvent('quiz_answer_select', {
      quiz_id: runtime.quizId,
      step_id: step.stepId,
      option_id: option.optionId,
      option_label: option.presentation.title,
      next_action: nextAction,
    });
  };

  const trackCompletion = (option) => {
    if (state.isCompleteTracked) return;
    state.isCompleteTracked = true;

    const completionMs = Math.max(0, Math.round(performance.now() - state.startedAt));

    pushQuizEvent('quiz_complete', {
      quiz_id: runtime.quizId,
      total_steps: steps.length,
      completion_ms: completionMs,
      result_route: option.href,
    });
    pushQuizEvent('quiz_result_click', {
      quiz_id: runtime.quizId,
      result_id: option.optionId,
      destination_url: option.href,
    });

    clearQuizSession(runtime);
  };

  const handleNavigate = async (href, isFragment) => {
    if (isFragment) {
      try {
        const fragment = await loadFragment(href);
        if (fragment) {
          mountFragment(block, fragment);
          return true;
        }
      } catch (error) {
        console.warn(`quiz-router: fragment load failed for "${href}". Falling back to navigation.`, error);
      }

      console.warn(`quiz-router: fragment "${href}" unavailable. Falling back to navigation.`);
      window.location.href = href;
      return true;
    }

    window.location.href = href;
    return true;
  };

  const updateControlState = () => {
    const onFirstStep = state.currentStep === 0;
    const disabled = state.isBusy;

    backButton.disabled = onFirstStep || disabled;
    restartButton.disabled = disabled;
  };

  const renderCurrentStep = (nextStep = state.currentStep) => {
    state.currentStep = Math.max(0, Math.min(nextStep, steps.length - 1));
    state.maxVisitedStep = Math.max(state.maxVisitedStep, state.currentStep);

    wrapper.classList.toggle('is-loading', state.isBusy);
    content.setAttribute('aria-busy', state.isBusy ? 'true' : 'false');

    if (progressEl) {
      setProgressText(progressEl, state.currentStep, steps.length);
    }
    if (progressFill) {
      const denominator = Math.max(1, steps.length - 1);
      progressFill.style.width = `${(state.currentStep / denominator) * 100}%`;
    }

    if (config.theme === 'premium') {
      updateControlState();
      renderStepper(stepper, state, steps, (stepIndex) => {
        if (stepIndex > state.maxVisitedStep) return;

        const fromStep = steps[state.currentStep];
        const toStep = steps[stepIndex];

        pushQuizEvent('quiz_step_jump', {
          quiz_id: runtime.quizId,
          from_step_index: state.currentStep + 1,
          to_step_index: stepIndex + 1,
          from_step_id: fromStep?.stepId || '',
          to_step_id: toStep?.stepId || '',
        });

        renderCurrentStep(stepIndex);
      });
    }

    const step = steps[state.currentStep];

    renderStepContent(
      content,
      step,
      state.currentStep,
      state,
      config.theme === 'premium',
      async (option) => {
        const nextAction = resolveNextAction(option.action, config.resultMode);
        trackAnswer(step, option, nextAction);

        if (nextAction === 'next') {
          const nextIndex = state.currentStep + 1;
          if (nextIndex < steps.length) {
            state.maxVisitedStep = Math.max(state.maxVisitedStep, nextIndex);
            if (config.theme === 'premium') {
              await wait(TRANSITION_DELAY_MS);
            }
            renderCurrentStep(nextIndex);
          } else {
            console.warn(`quiz-router: row ${option.rowNum} uses "${NEXT_STEP}" on final step. No further question to display.`);
          }
          return;
        }

        if (nextAction === 'disabled') {
          return;
        }

        state.isBusy = true;
        renderCurrentStep(state.currentStep);

        trackCompletion(option);

        const shouldLoadFragment = nextAction === 'fragment';
        const didLeaveView = await handleNavigate(option.href, shouldLoadFragment);
        if (!didLeaveView) {
          state.isBusy = false;
          renderCurrentStep(state.currentStep);
        }
      },
    );

    trackStepView(state.currentStep);
    persistState();
  };

  backButton.addEventListener('click', () => {
    if (backButton.disabled || state.currentStep === 0 || state.isBusy) return;

    const nextStep = state.currentStep - 1;
    const fromStep = steps[state.currentStep];
    const toStep = steps[nextStep];

    pushQuizEvent('quiz_step_back', {
      quiz_id: runtime.quizId,
      from_step_index: state.currentStep + 1,
      to_step_index: nextStep + 1,
      from_step_id: fromStep?.stepId || '',
      to_step_id: toStep?.stepId || '',
    });

    renderCurrentStep(nextStep);
  });

  restartButton.addEventListener('click', () => {
    if (restartButton.disabled || state.isBusy) return;

    state.currentStep = 0;
    state.maxVisitedStep = 0;
    state.answers = [];
    state.startedAt = performance.now();
    state.isCompleteTracked = false;
    state.lastTrackedStep = -1;

    clearQuizSession(runtime);

    pushQuizEvent('quiz_restart', {
      quiz_id: runtime.quizId,
      total_steps: steps.length,
    });

    renderCurrentStep(0);
  });

  pushQuizEvent('quiz_start', {
    quiz_id: runtime.quizId,
    quiz_version: runtime.quizVersion,
    entry_path: runtime.entryPath,
  });

  if (footer) {
    shell.append(content, footer);
  } else {
    shell.append(content);
  }
  wrapper.append(shell);
  block.replaceChildren(wrapper);

  renderCurrentStep(state.currentStep);
}
