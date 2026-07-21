# Custom web themes

Server admins can add deployment-specific themes to Bunnyland browser clients without
patching `@bunnyland/ui-web`. A custom theme has two parts:

1. a theme option in the client `config.json`, so the theme appears in selectors;
2. CSS for the matching root class, so the theme changes colors.

## Add theme options

Static Bunnyland browser clients read `config.json` from the site root. Add a `themes`
array with one object per custom theme:

```json
{
  "serverUrl": "/api/",
  "autoConnect": true,
  "discordUrl": "https://discord.gg/example",
  "theme": "server-night",
  "themes": [
    { "value": "server-night", "label": "Server Night" },
    { "value": "festival-day", "label": "Festival Day" }
  ]
}
```

`value` becomes the class suffix in `bl-theme-<value>`, so use lowercase letters,
numbers, and hyphens. `label` is the human-readable selector text.

`theme` is the deployment default. It is applied when a visitor does not already have a
saved theme preference. A link with `?theme=<value>` overrides both the deployment default
and the visitor's saved preference, then saves that linked theme for future pages.

When using the Bunnyland web Docker image, set `BUNNYLAND_WEB_THEMES` to the JSON array and
`BUNNYLAND_WEB_THEME` to the default value:

```sh
BUNNYLAND_WEB_THEME='server-night'
BUNNYLAND_WEB_THEMES='[{"value":"server-night","label":"Server Night"}]'
```

Restart the frontend container after changing the variable.

## Serve the CSS

Registering a theme only adds it to the list. The colors come from CSS variables on the
matching root class:

```css
:root.bl-theme-server-night {
  color-scheme: dark;

  --bl-bg: #101218;
  --bl-bg-strong: #171b25;
  --bl-bg-deep: #080a0f;
  --bl-bg-row: #151923;
  --bl-bg-subtle: #1d2330;
  --bl-surface: #242b38;
  --bl-surface-hover: #30394a;
  --bl-border: #30394a;
  --bl-border-muted: #202633;
  --bl-border-control: #465267;
  --bl-border-strong: #5d6a80;

  --bl-text: #edf2ff;
  --bl-text-soft: #c5cde0;
  --bl-text-muted: #7f8aa3;
  --bl-text-dim: #9aa4ba;
  --bl-text-inverse: #ffffff;
  --bl-accent: #74c7ec;
  --bl-accent-strong: #a6e3a1;
  --bl-secondary: #cba6f7;
  --bl-ok: #a6e3a1;
  --bl-error: #f38ba8;
  --bl-warn: #f9e2af;
  --bl-info: #89dceb;

  --bl-shadow-popover: 0 6px 18px rgba(0, 0, 0, 0.55);
  --bl-shadow-text: 0 1px 2px rgba(0, 0, 0, 0.6);
  --bl-overlay: rgba(8, 10, 15, 0.74);
  --bl-overlay-strong: rgba(8, 10, 15, 0.88);
  --bl-overlay-solid: rgba(16, 18, 24, 0.96);
  --bl-accent-wash: rgba(116, 199, 236, 0.14);
  --bl-accent-wash-strong: rgba(116, 199, 236, 0.28);
  --bl-secondary-wash: rgba(203, 166, 247, 0.22);
  --bl-secondary-wash-strong: rgba(203, 166, 247, 0.34);
}
```

Place that CSS after `assets/bunnyland-ui.css`, or in a separate stylesheet loaded after
it. Existing pages can keep using `bindThemeSelect()` and the client menu; the shared
theme helpers refresh selectors after custom themes are registered.

This example is intentionally dark-only. A custom theme that supports automatic appearance
must also define its light tokens inside `@media (prefers-color-scheme: light)` and under a
`.bl-color-scheme-light` override; exclude `.bl-color-scheme-dark` from its media-query
selector. Built-in palettes already provide both modes.

## Validate

After deployment:

1. Open `/config.json` and confirm the `themes` array is valid JSON.
2. Open a browser client and check that the custom label appears in the theme selector.
3. Select the theme and confirm the page root has `data-theme="<value>"` and the
   `bl-theme-<value>` class.
4. Open a link such as `/?theme=server-night` and confirm the linked theme is selected.
5. Check at least one admin page and one player page, because both use the shared theme
   variables but have different layouts.

If the option appears but colors do not change, the CSS did not load after
`bunnyland-ui.css` or the CSS class does not match the configured theme value.
