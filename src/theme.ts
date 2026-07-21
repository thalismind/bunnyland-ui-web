import { escapeHtml, storageGet, storageSet } from './widgets';

export const THEME_KEY = 'bunnyland.theme';
export const THEME_CLASS_PREFIX = 'bl-theme-';
export const COLOR_SCHEME_KEY = 'bunnyland.color-scheme';
export const COLOR_SCHEME_CLASS_PREFIX = 'bl-color-scheme-';
export const DEFAULT_THEME = 'midnight';
export const THEME_CHANGE_EVENT = 'bunnyland:themechange';

export interface ThemeOption {
  value: string;
  label: string;
}

export type ColorScheme = 'auto' | 'dark' | 'light';

export const DEFAULT_THEME_OPTIONS: ThemeOption[] = [
  { value: 'midnight', label: 'Midnight Blue / Lavender' },
  { value: 'candy', label: 'Candy Pink / Cyan' },
  { value: 'earth', label: 'Earth Green / Gold' },
  { value: 'ocean', label: 'Ocean Teal / Coral' },
  { value: 'sunset', label: 'Sunset Orange / Plum' },
  { value: 'high-contrast', label: 'High Contrast' },
];

export const THEME_OPTIONS: ThemeOption[] = DEFAULT_THEME_OPTIONS.map(option => ({ ...option }));

const THEME_ALIASES: Record<string, string> = {
  anime: 'candy',
  'anime-dark': 'candy-dark',
  'anime-light': 'candy-light',
  dark: 'midnight-dark',
  light: 'midnight-light',
  'purple-blue': 'midnight',
  'purple-blue-dark': 'midnight-dark',
  'purple-blue-light': 'midnight-light',
};

const COLOR_SCHEME_OPTIONS: ThemeOption[] = [
  { value: 'auto', label: 'Auto (System)' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const THEME_VALUE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const boundThemeSelects = new Set<HTMLSelectElement>();
const boundColorSchemeSelects = new Set<HTMLSelectElement>();

function parseThemeSelection(name: string | null | undefined): { scheme: ColorScheme | null; theme: string } {
  const raw = THEME_ALIASES[String(name || DEFAULT_THEME).trim()] || String(name || DEFAULT_THEME).trim();
  if (isKnownTheme(raw)) return { theme: raw, scheme: null };
  const match = raw.match(/^(.*)-(dark|light)$/);
  if (match && isKnownTheme(match[1])) return { theme: match[1], scheme: match[2] as ColorScheme };
  return { theme: raw, scheme: null };
}

function normalizeThemeValue(name: string | null | undefined): string {
  return parseThemeSelection(name).theme;
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

function normalizeColorSchemeValue(name: string | null | undefined): ColorScheme {
  return name === 'dark' || name === 'light' ? name : 'auto';
}

function renderColorSchemeSelect(select: HTMLSelectElement): void {
  select.innerHTML = COLOR_SCHEME_OPTIONS.map(option => `
    <option value="${option.value}">${option.label}</option>
  `).join('');
  select.value = currentColorScheme();
}

function refreshColorSchemeSelects(): void {
  for (const select of boundColorSchemeSelects) renderColorSchemeSelect(select);
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

export function currentColorScheme(root: HTMLElement = document.documentElement): ColorScheme {
  return normalizeColorSchemeValue(root.dataset.colorScheme);
}

function dispatchThemeChange(root: HTMLElement): void {
  if (typeof root.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    root.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, {
      detail: { colorScheme: currentColorScheme(root), theme: currentTheme(root) },
    }));
  }
}

function applyTheme(theme: string, root: HTMLElement, persist: boolean): string {
  for (const className of [...root.classList]) {
    if (className.startsWith(THEME_CLASS_PREFIX)) root.classList.remove(className);
  }
  root.classList.add(`${THEME_CLASS_PREFIX}${theme}`);
  root.dataset.theme = theme;
  if (persist) storageSet(THEME_KEY, theme);
  refreshThemeSelects();
  dispatchThemeChange(root);
  return theme;
}

function applyColorScheme(scheme: ColorScheme, root: HTMLElement, persist: boolean): ColorScheme {
  for (const className of [...root.classList]) {
    if (className.startsWith(COLOR_SCHEME_CLASS_PREFIX)) root.classList.remove(className);
  }
  if (scheme !== 'auto') root.classList.add(`${COLOR_SCHEME_CLASS_PREFIX}${scheme}`);
  root.dataset.colorScheme = scheme;
  if (persist) storageSet(COLOR_SCHEME_KEY, scheme);
  refreshColorSchemeSelects();
  dispatchThemeChange(root);
  return scheme;
}

export function setColorScheme(name: string, root: HTMLElement = document.documentElement): ColorScheme {
  return applyColorScheme(normalizeColorSchemeValue(name), root, true);
}

export function setTheme(name: string, root: HTMLElement = document.documentElement): string {
  const selection = parseThemeSelection(name);
  if (selection.scheme) applyColorScheme(selection.scheme, root, true);
  const theme = normalizeTheme(selection.theme);
  return applyTheme(theme, root, true);
}

export function initTheme(
  root: HTMLElement = document.documentElement,
  defaultTheme = DEFAULT_THEME,
  search = globalThis.location?.search || '',
): string {
  const linkedValue = new URLSearchParams(search).get('theme');
  const linkedTheme = themeFromSearch(search);
  const stored = storageGet(THEME_KEY);
  const selection = parseThemeSelection((linkedTheme && linkedValue) || stored || defaultTheme || DEFAULT_THEME);
  const storedScheme = storageGet(COLOR_SCHEME_KEY);
  const scheme = selection.scheme || normalizeColorSchemeValue(storedScheme);
  applyColorScheme(scheme, root, Boolean(selection.scheme || storedScheme));
  const theme = normalizeTheme(selection.theme);
  return applyTheme(theme, root, Boolean(linkedTheme || (stored && isKnownTheme(selection.theme))));
}

export function themeOptions(): ThemeOption[] {
  return THEME_OPTIONS.map(option => ({ ...option }));
}

export function colorSchemeOptions(): ThemeOption[] {
  return COLOR_SCHEME_OPTIONS.map(option => ({ ...option }));
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

export function bindColorSchemeSelect(select: HTMLSelectElement | null): { setValue: (value: string) => void } | null {
  if (!select) return null;
  boundColorSchemeSelects.add(select);
  renderColorSchemeSelect(select);
  select.addEventListener('change', () => setColorScheme(select.value));
  return {
    setValue(value: string): void {
      select.value = normalizeColorSchemeValue(value);
      setColorScheme(select.value);
    },
  };
}
