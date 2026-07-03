import { escapeHtml, storageGet, storageSet } from './widgets';

export const THEME_KEY = 'bunnyland.theme';
export const THEME_CLASS_PREFIX = 'bl-theme-';
export const DEFAULT_THEME = 'purple-blue-dark';

export interface ThemeOption {
  value: string;
  label: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'purple-blue-dark', label: 'Purple / Blue Dark' },
  { value: 'purple-blue-light', label: 'Purple / Blue Light' },
  { value: 'anime-dark', label: 'Anime Pink / Cyan Dark' },
  { value: 'anime-light', label: 'Anime Pink / Cyan Light' },
  { value: 'earth-dark', label: 'Earth Green / Gold Dark' },
  { value: 'earth-light', label: 'Earth Green / Gold Light' },
];

const THEME_ALIASES: Record<string, string> = {
  dark: 'purple-blue-dark',
  light: 'purple-blue-light',
};

export function normalizeTheme(name: string | null | undefined): string {
  const raw = String(name || DEFAULT_THEME).trim();
  const theme = THEME_ALIASES[raw] || raw;
  return THEME_OPTIONS.some(option => option.value === theme) ? theme : DEFAULT_THEME;
}

export function currentTheme(root: HTMLElement = document.documentElement): string {
  return normalizeTheme(root.dataset.theme);
}

export function setTheme(name: string, root: HTMLElement = document.documentElement): string {
  const theme = normalizeTheme(name);
  for (const className of [...root.classList]) {
    if (className.startsWith(THEME_CLASS_PREFIX)) root.classList.remove(className);
  }
  root.classList.add(`${THEME_CLASS_PREFIX}${theme}`);
  root.dataset.theme = theme;
  storageSet(THEME_KEY, theme);
  return theme;
}

export function initTheme(root: HTMLElement = document.documentElement): string {
  return setTheme(storageGet(THEME_KEY) || DEFAULT_THEME, root);
}

export function themeOptions(): ThemeOption[] {
  return THEME_OPTIONS.map(option => ({ ...option }));
}

export function bindThemeSelect(select: HTMLSelectElement | null): { setValue: (value: string) => void } | null {
  if (!select) return null;
  select.innerHTML = THEME_OPTIONS.map(option => `
    <option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>
  `).join('');
  select.value = currentTheme();
  select.addEventListener('change', () => setTheme(select.value));
  return {
    setValue(value: string): void {
      select.value = normalizeTheme(value);
      setTheme(select.value);
    },
  };
}
