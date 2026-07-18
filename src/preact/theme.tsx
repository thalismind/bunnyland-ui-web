import type { JSX } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';

import {
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  initTheme,
  setTheme,
  themeOptions,
  type ThemeOption,
} from '../theme';

export interface ThemeController {
  options: ThemeOption[];
  setTheme: (theme: string) => void;
  theme: string;
}

export function useTheme(
  root: HTMLElement = document.documentElement,
  defaultTheme = DEFAULT_THEME,
): ThemeController {
  const [theme, setCurrentTheme] = useState(() => initTheme(root, defaultTheme));

  useEffect(() => {
    const handleThemeChange = (event: Event): void => {
      const detail = (event as CustomEvent<{ theme?: string }>).detail;
      if (detail?.theme) setCurrentTheme(detail.theme);
    };
    root.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => root.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, [root]);

  const updateTheme = useCallback((value: string): void => {
    setCurrentTheme(setTheme(value, root));
  }, [root]);

  return { options: themeOptions(), setTheme: updateTheme, theme };
}

export interface ThemeSelectProps extends Omit<JSX.HTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  controller?: ThemeController;
  defaultTheme?: string;
  onChange?: (theme: string) => void;
  root?: HTMLElement;
}

export function ThemeSelect({
  controller,
  defaultTheme = DEFAULT_THEME,
  onChange,
  root,
  ...props
}: ThemeSelectProps): JSX.Element {
  const fallback = useTheme(root || document.documentElement, defaultTheme);
  const themes = controller || fallback;
  return (
    <select
      {...props}
      value={themes.theme}
      onChange={(event): void => {
        const value = event.currentTarget.value;
        themes.setTheme(value);
        onChange?.(value);
      }}
    >
      {themes.options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
