import { escapeHtml, storageGet, storageSet } from './widgets';

export const THEME_KEY = 'bunnyland.theme';
export const THEME_CLASS_PREFIX = 'bl-theme-';
export const DEFAULT_THEME = 'purple-blue-dark';
export const THEME_CHANGE_EVENT = 'bunnyland:themechange';

export interface ThemeOption {
  value: string;
  label: string;
}

export const DEFAULT_THEME_OPTIONS: ThemeOption[] = [
  { value: 'purple-blue-dark', label: 'Purple / Blue Dark' },
  { value: 'purple-blue-light', label: 'Purple / Blue Light' },
  { value: 'anime-dark', label: 'Anime Pink / Cyan Dark' },
  { value: 'anime-light', label: 'Anime Pink / Cyan Light' },
  { value: 'earth-dark', label: 'Earth Green / Gold Dark' },
  { value: 'earth-light', label: 'Earth Green / Gold Light' },
];

export const THEME_OPTIONS: ThemeOption[] = DEFAULT_THEME_OPTIONS.map(option => ({ ...option }));

const THEME_ALIASES: Record<string, string> = {
  dark: 'purple-blue-dark',
  light: 'purple-blue-light',
};

const THEME_VALUE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const boundThemeSelects = new Set<HTMLSelectElement>();

function normalizeThemeValue(name: string | null | undefined): string {
  const raw = String(name || DEFAULT_THEME).trim();
  return THEME_ALIASES[raw] || raw;
}

function isKnownTheme(name: string): boolean {
  return THEME_OPTIONS.some(option => option.value === name);
}

function sanitizeThemeOption(option: ThemeOption): ThemeOption | null {
  const value = String(option?.value || '').trim();
  if (!THEME_VALUE_PATTERN.test(value)) return null;
  const label = String(option?.label || value).trim() || value;
  return { value, label };
}

function renderThemeSelect(select: HTMLSelectElement): void {
  const theme = currentTheme();
  select.innerHTML = themeOptions().map(option => `
    <option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>
  `).join('');
  select.value = theme;
}

function refreshThemeSelects(): void {
  for (const select of boundThemeSelects) renderThemeSelect(select);
}

export function themeFromSearch(search = globalThis.location?.search || ''): string | null {
  const requested = new URLSearchParams(search).get('theme');
  if (!requested) return null;
  const theme = normalizeThemeValue(requested);
  return isKnownTheme(theme) ? theme : null;
}

export function normalizeTheme(name: string | null | undefined): string {
  const theme = normalizeThemeValue(name);
  return isKnownTheme(theme) ? theme : DEFAULT_THEME;
}

export function currentTheme(root: HTMLElement = document.documentElement): string {
  return normalizeTheme(root.dataset.theme);
}

function applyTheme(theme: string, root: HTMLElement, persist: boolean): string {
  for (const className of [...root.classList]) {
    if (className.startsWith(THEME_CLASS_PREFIX)) root.classList.remove(className);
  }
  root.classList.add(`${THEME_CLASS_PREFIX}${theme}`);
  root.dataset.theme = theme;
  if (persist) storageSet(THEME_KEY, theme);
  refreshThemeSelects();
  if (typeof root.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    root.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
  }
  return theme;
}

export function setTheme(name: string, root: HTMLElement = document.documentElement): string {
  const theme = normalizeTheme(name);
  return applyTheme(theme, root, true);
}

export function initTheme(
  root: HTMLElement = document.documentElement,
  defaultTheme = DEFAULT_THEME,
  search = globalThis.location?.search || '',
): string {
  const linkedTheme = themeFromSearch(search);
  if (linkedTheme) return applyTheme(linkedTheme, root, true);

  const stored = storageGet(THEME_KEY);
  const requested = normalizeThemeValue(stored || defaultTheme || DEFAULT_THEME);
  const theme = normalizeTheme(requested);
  return applyTheme(theme, root, Boolean(stored) && isKnownTheme(requested));
}

export function themeOptions(): ThemeOption[] {
  return THEME_OPTIONS.map(option => ({ ...option }));
}

export function registerThemeOption(option: ThemeOption): ThemeOption | null {
  const theme = sanitizeThemeOption(option);
  if (!theme) return null;
  const index = THEME_OPTIONS.findIndex(existing => existing.value === theme.value);
  if (index === -1) THEME_OPTIONS.push(theme);
  else THEME_OPTIONS[index] = theme;
  refreshThemeSelects();
  return { ...theme };
}

export function registerThemeOptions(options: ThemeOption[] | null | undefined): ThemeOption[] {
  if (!Array.isArray(options)) return [];
  return options
    .map(option => registerThemeOption(option))
    .filter((option): option is ThemeOption => option !== null);
}

export function bindThemeSelect(select: HTMLSelectElement | null): { setValue: (value: string) => void } | null {
  if (!select) return null;
  boundThemeSelects.add(select);
  renderThemeSelect(select);
  select.value = initTheme();
  select.addEventListener('change', () => setTheme(select.value));
  return {
    setValue(value: string): void {
      select.value = normalizeTheme(value);
      setTheme(select.value);
    },
  };
}
