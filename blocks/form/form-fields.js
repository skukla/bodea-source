import { toClassName } from '../../scripts/aem.js';

/**
 * Normalize field descriptor from either the old schema (Name, Type, Label,
 * Placeholder, Value, Options, Mandatory, Style, ID, Fieldset) or the new
 * Adobe AEM Block Collection schema (field, type, label, help, options,
 * placeholder, default, conditional, required).
 */
function normalizeFieldDescriptor(raw) {
  const isNewSchema = ('field' in raw) || ('conditional' in raw) || ('help' in raw);

  if (isNewSchema) {
    return {
      Name: raw.field || '',
      Type: raw.type || 'text',
      Label: raw.label || raw.field || '',
      Placeholder: raw.placeholder || '',
      Value: raw.default || raw.value || '',
      Options: raw.options || '',
      Mandatory: raw.required || '',
      Style: raw.style || '',
      Id: raw.id || '',
      Fieldset: raw.fieldset || '',
      Help: raw.help || '',
      Conditional: raw.conditional || '',
    };
  }

  return {
    Name: raw.Name || '',
    Type: raw.Type || 'text',
    Label: raw.Label || raw.Name || '',
    Placeholder: raw.Placeholder || '',
    Value: raw.Value || '',
    Options: raw.Options || '',
    Mandatory: raw.Mandatory || '',
    Style: raw.Style || '',
    Id: raw.Id || raw.ID || '',
    Fieldset: raw.Fieldset || '',
    Help: raw.Help || '',
    Conditional: raw.Conditional || '',
  };
}

function createFieldWrapper(fd) {
  const fieldWrapper = document.createElement('div');
  if (fd.Style) fieldWrapper.className = fd.Style;
  fieldWrapper.classList.add('field-wrapper', `${fd.Type}-wrapper`);

  if (fd.Fieldset) {
    fieldWrapper.dataset.fieldset = fd.Fieldset;
  }

  if (fd.Conditional) {
    fieldWrapper.dataset.conditional = fd.Conditional;
    fieldWrapper.classList.add('conditional-field');
    fieldWrapper.hidden = true;
  }

  return fieldWrapper;
}

const ids = [];
function generateFieldId(fd, suffix = '') {
  const slug = toClassName(`form-${fd.Name}${suffix}`);
  ids[slug] = ids[slug] || 0;
  const idSuffix = ids[slug] ? `-${ids[slug]}` : '';
  ids[slug] += 1;
  return `${slug}${idSuffix}`;
}

function createLabel(fd) {
  const label = document.createElement('label');
  label.id = generateFieldId(fd, '-label');
  label.textContent = fd.Label || fd.Name;
  label.setAttribute('for', fd.Id);
  const mandatory = (fd.Mandatory || '').toString().toLowerCase();
  if (mandatory === 'true' || mandatory === 'x') {
    label.dataset.required = true;
  }
  return label;
}

function createHelpText(fd) {
  if (!fd.Help) return null;
  const help = document.createElement('p');
  help.className = 'field-help';
  help.id = `${fd.Id}-help`;
  help.textContent = fd.Help;
  return help;
}

function setCommonAttributes(field, fd) {
  field.id = fd.Id;
  field.name = fd.Name;
  const mandatory = (fd.Mandatory || '').toString().toLowerCase();
  field.required = mandatory === 'true' || mandatory === 'x';
  field.placeholder = fd.Placeholder || '';
  field.value = fd.Value || '';
  if (fd.Help) {
    field.setAttribute('aria-describedby', `${fd.Id}-help`);
  }
}

const createHeading = (fd) => {
  const fieldWrapper = createFieldWrapper(fd);
  const level = fd.Style && fd.Style.includes('sub-heading') ? 3 : 2;
  const heading = document.createElement(`h${level}`);
  heading.textContent = fd.Value || fd.Label;
  heading.id = fd.Id;
  fieldWrapper.append(heading);
  return { field: heading, fieldWrapper };
};

const createPlaintext = (fd) => {
  const fieldWrapper = createFieldWrapper(fd);
  const text = document.createElement('p');
  text.textContent = fd.Value || fd.Label;
  text.id = fd.Id;
  fieldWrapper.append(text);
  return { field: text, fieldWrapper };
};

const createSelect = async (fd) => {
  const select = document.createElement('select');
  setCommonAttributes(select, fd);
  const addOption = ({ text, value }) => {
    const option = document.createElement('option');
    option.text = text.trim();
    option.value = value.trim();
    if (option.value === select.value) {
      option.setAttribute('selected', '');
    }
    select.add(option);
    return option;
  };

  if (fd.Placeholder) {
    const ph = addOption({ text: fd.Placeholder, value: '' });
    ph.setAttribute('disabled', '');
  }

  if (fd.Options) {
    let options = [];
    if (fd.Options.startsWith('https://')) {
      try {
        const optionsUrl = new URL(fd.Options);
        const resp = await fetch(optionsUrl.toString());
        const json = await resp.json();
        json.data.forEach((opt) => {
          options.push({
            text: opt.Option || opt.label || opt.name || '',
            value: opt.Value || opt.value || opt.Option || opt.label || '',
          });
        });
      } catch (err) {
        console.warn('form: failed to load remote options', err);
      }
    } else {
      options = fd.Options.split(',').map((opt) => ({
        text: opt.trim(),
        value: opt.trim().toLowerCase(),
      }));
    }
    options.forEach((opt) => addOption(opt));
  }

  const fieldWrapper = createFieldWrapper(fd);
  fieldWrapper.prepend(createLabel(fd));
  fieldWrapper.append(select);
  const help = createHelpText(fd);
  if (help) fieldWrapper.append(help);

  return { field: select, fieldWrapper };
};

const createConfirmation = (fd, form) => {
  const url = fd.Value || fd.Label || '';
  if (url) {
    try {
      form.dataset.confirmation = new URL(url, window.location.origin).pathname;
    } catch {
      form.dataset.confirmation = url;
    }
  }
  return {};
};

const createSubmit = (fd) => {
  const button = document.createElement('button');
  button.textContent = fd.Label || fd.Name || 'Submit';
  button.classList.add('button');
  button.type = 'submit';

  const fieldWrapper = createFieldWrapper(fd);
  fieldWrapper.append(button);
  return { field: button, fieldWrapper };
};

const createReset = (fd) => {
  const button = document.createElement('button');
  button.textContent = fd.Label || fd.Name || 'Clear';
  button.classList.add('button', 'button-reset');
  button.type = 'reset';

  const fieldWrapper = createFieldWrapper(fd);
  fieldWrapper.append(button);
  return { field: button, fieldWrapper };
};

const createTextArea = (fd) => {
  const field = document.createElement('textarea');
  setCommonAttributes(field, fd);

  const fieldWrapper = createFieldWrapper(fd);
  const label = createLabel(fd);
  field.setAttribute('aria-labelledby', label.id);
  fieldWrapper.prepend(label);
  fieldWrapper.append(field);
  const help = createHelpText(fd);
  if (help) fieldWrapper.append(help);

  return { field, fieldWrapper };
};

const createInput = (fd) => {
  const field = document.createElement('input');
  field.type = fd.Type;
  setCommonAttributes(field, fd);

  const fieldWrapper = createFieldWrapper(fd);
  const label = createLabel(fd);
  field.setAttribute('aria-labelledby', label.id);
  if (fd.Type === 'radio' || fd.Type === 'checkbox') {
    fieldWrapper.append(field);
    fieldWrapper.append(label);
  } else {
    fieldWrapper.prepend(label);
    fieldWrapper.append(field);
    const help = createHelpText(fd);
    if (help) fieldWrapper.append(help);
  }

  return { field, fieldWrapper };
};

const createFieldset = (fd) => {
  const field = document.createElement('fieldset');
  setCommonAttributes(field, fd);

  if (fd.Label) {
    const legend = document.createElement('legend');
    legend.textContent = fd.Label;
    field.append(legend);
  }

  const fieldWrapper = createFieldWrapper(fd);
  fieldWrapper.append(field);
  return { field, fieldWrapper };
};

const createToggle = (fd) => {
  const { field, fieldWrapper } = createInput(fd);
  field.type = 'checkbox';
  if (!field.value) field.value = 'on';
  field.classList.add('toggle');
  fieldWrapper.classList.add('selection-wrapper');

  const toggleSwitch = document.createElement('div');
  toggleSwitch.classList.add('switch');
  toggleSwitch.append(field);
  fieldWrapper.append(toggleSwitch);

  const slider = document.createElement('span');
  slider.classList.add('slider');
  toggleSwitch.append(slider);
  slider.addEventListener('click', () => {
    field.checked = !field.checked;
  });

  const help = createHelpText(fd);
  if (help) fieldWrapper.append(help);

  return { field, fieldWrapper };
};

const createCheckbox = (fd) => {
  const { field, fieldWrapper } = createInput(fd);
  if (!field.value) field.value = 'checked';
  fieldWrapper.classList.add('selection-wrapper');
  return { field, fieldWrapper };
};

const createRadio = (fd) => {
  const { field, fieldWrapper } = createInput(fd);
  if (!field.value) field.value = fd.Label || 'on';
  fieldWrapper.classList.add('selection-wrapper');
  return { field, fieldWrapper };
};

const FIELD_CREATOR_FUNCTIONS = {
  select: createSelect,
  heading: createHeading,
  plaintext: createPlaintext,
  'text-area': createTextArea,
  textarea: createTextArea,
  toggle: createToggle,
  submit: createSubmit,
  reset: createReset,
  confirmation: createConfirmation,
  fieldset: createFieldset,
  checkbox: createCheckbox,
  radio: createRadio,
};

export default async function createField(rawFd, form) {
  const fd = normalizeFieldDescriptor(rawFd);
  fd.Id = fd.Id || generateFieldId(fd);
  const type = fd.Type.toLowerCase();
  const createFieldFunc = FIELD_CREATOR_FUNCTIONS[type] || createInput;
  const fieldElements = await createFieldFunc(fd, form);
  return fieldElements.fieldWrapper;
}
