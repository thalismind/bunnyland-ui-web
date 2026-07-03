import { escapeHtml, normalizeTags } from './widgets';

export interface SearchDropdownOption {
  value: string;
  label?: string;
}

export function tagEditorHtml(tags: unknown, options: {
  hiddenClass?: string;
  hiddenAttributes?: string;
  disabled?: boolean;
  addLabel?: string;
  placeholder?: string;
} = {}): string {
  const values = normalizeTags(tags);
  const hiddenClass = options.hiddenClass || 'component-tags-value';
  const hiddenAttributes = options.hiddenAttributes || '';
  const disabled = options.disabled ? ' disabled' : '';
  const addLabel = options.addLabel || 'Add Tag';
  const placeholder = options.placeholder || 'add tag...';
  return `
    <div class="tag-editor">
      <input class="${escapeHtml(hiddenClass)}" ${hiddenAttributes} type="hidden" value="${escapeHtml(JSON.stringify(values))}">
      <div class="tag-list">
        ${renderTagPills(values, disabled)}
      </div>
      <div class="tag-entry">
        <input class="tag-input" type="text" placeholder="${escapeHtml(placeholder)}" spellcheck="false"${disabled}>
        <button type="button" data-add-tag${disabled}>${escapeHtml(addLabel)}</button>
      </div>
    </div>
  `;
}

export function readTagEditorTags(editor: Element, options: { hiddenSelector?: string } = {}): string[] {
  const hidden = editor.querySelector<HTMLInputElement>(options.hiddenSelector || '.component-tags-value');
  try {
    return normalizeTags(JSON.parse(hidden?.value || '[]'));
  } catch (_err) {
    return [];
  }
}

export function renderTagEditorTags(editor: Element, tags: unknown): void {
  const list = editor.querySelector('.tag-list');
  if (!list) return;
  list.innerHTML = renderTagPills(normalizeTags(tags), '');
}

export function bindTagEditor(editor: Element, options: {
  hiddenSelector?: string;
  onChange?: (tags: string[]) => void;
} = {}): { readTags: () => string[]; update: (tags: string[]) => void } {
  const input = editor.querySelector<HTMLInputElement>('.tag-input');
  const add = editor.querySelector('[data-add-tag]');
  const hidden = editor.querySelector<HTMLInputElement>(options.hiddenSelector || '.component-tags-value');
  const onChange = options.onChange || (() => {});
  const update = (tags: string[]): void => {
    const values = normalizeTags(tags);
    if (hidden) hidden.value = JSON.stringify(values);
    renderTagEditorTags(editor, values);
    onChange(values);
  };
  const addTag = (): void => {
    const tag = input?.value.trim();
    if (!tag) return;
    const tags = readTagEditorTags(editor, options);
    if (!tags.includes(tag)) tags.push(tag);
    if (input) input.value = '';
    update(tags);
    input?.focus();
  };
  add?.addEventListener('click', addTag);
  input?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addTag();
  });
  editor.addEventListener('click', event => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-remove-tag]');
    if (!button) return;
    update(readTagEditorTags(editor, options).filter(tag => tag !== button.dataset.removeTag));
  });
  return { readTags: () => readTagEditorTags(editor, options), update };
}

export function bindSearchDropdown(root: Element, {
  options,
  value = '',
  onChange = null,
  emptyLabel = 'No matches',
}: {
  options: Array<string | SearchDropdownOption>;
  value?: string;
  onChange?: ((value: string, item: SearchDropdownOption | null) => void) | null;
  emptyLabel?: string;
}): { setValue: (value: string, notify?: boolean) => void } {
  const input = root.querySelector<HTMLInputElement>('.search-dropdown-input');
  const hidden = root.querySelector<HTMLInputElement>('.search-dropdown-value');
  const menu = root.querySelector<HTMLElement>('.search-dropdown-menu');
  if (!input || !hidden || !menu) throw new Error('Search dropdown is missing required elements');
  const items = options.map(option => typeof option === 'string'
    ? { value: option, label: option }
    : { value: option.value, label: option.label || option.value });
  let active = 0;
  const filteredItems = (): SearchDropdownOption[] => {
    const q = input.value.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item =>
      String(item.label).toLowerCase().includes(q) ||
      item.value.toLowerCase().includes(q));
  };
  const setValue = (nextValue: string, notify = true): void => {
    const item = items.find(option => option.value === nextValue) || null;
    hidden.value = item?.value || '';
    input.value = item?.label || '';
    if (notify && onChange) onChange(hidden.value, item);
  };
  const renderMenu = (): void => {
    const filtered = filteredItems();
    active = Math.max(0, Math.min(active, filtered.length - 1));
    menu.innerHTML = filtered.length
      ? filtered.map((item, index) => `
        <div class="search-dropdown-option ${index === active ? 'active' : ''}" data-value="${escapeHtml(item.value)}">
          ${escapeHtml(item.label)}
        </div>
      `).join('')
      : `<div class="search-dropdown-empty">${escapeHtml(emptyLabel)}</div>`;
    menu.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
  };
  const chooseActive = (): void => {
    const item = filteredItems()[active];
    if (!item) return;
    setValue(item.value);
    menu.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
  };
  input.addEventListener('input', () => {
    active = 0;
    renderMenu();
  });
  input.addEventListener('focus', renderMenu);
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      active += 1;
      renderMenu();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      active -= 1;
      renderMenu();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      chooseActive();
    } else if (event.key === 'Escape') {
      menu.classList.add('hidden');
      input.setAttribute('aria-expanded', 'false');
      input.blur();
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      menu.classList.add('hidden');
      input.setAttribute('aria-expanded', 'false');
    }, 150);
  });
  menu.addEventListener('mousedown', event => {
    const option = (event.target as Element | null)?.closest<HTMLElement>('.search-dropdown-option');
    if (!option) return;
    event.preventDefault();
    setValue(option.dataset.value || '');
    menu.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
  });
  setValue(value, false);
  return { setValue };
}

function renderTagPills(values: string[], disabled: string): string {
  return values.length
    ? values.map(tag => `
      <span class="tag-pill">
        <span>${escapeHtml(tag)}</span>
        <button type="button" data-remove-tag="${escapeHtml(tag)}" aria-label="Remove tag ${escapeHtml(tag)}"${disabled}>x</button>
      </span>
    `).join('')
    : '<span class="tiny">No tags.</span>';
}
