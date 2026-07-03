# Bunnyland UI Web

Shared web UI, browser helpers, and gameplay display utilities for Bunnyland browser clients. The package is publish-ready as `@bunnyland/ui-web`.

This package is intentionally not a Preact, React, or Textual component library. Framework-specific packages such as `@bunnyland/ui-preact` or `@bunnyland/ui-textual` should depend on this package for theme tokens, action helpers, API helpers, and shared behavior.

## Static Browser Clients

Static clients can copy these assets into their served `assets/` directory:

- `assets/bunnyland-ui.css`
- `assets/bunnyland-ui.js`
- `assets/bunnyland-api.js`
- `assets/bunnyland-play.js`

The JavaScript assets preserve the browser globals used by the existing clients:

- `window.BunnylandUI`
- `window.BunnylandApi`
- `window.BunnylandPlay`

## Vite Clients And OOT Plugins

Out-of-tree Vite clients should use a local package dependency while developing:

```json
{
  "dependencies": {
    "@bunnyland/ui-web": "file:../../bunnyland-ui-web"
  }
}
```

Then import the typed helpers. Prefer narrow modules so Vite and Rollup can tree shake unrelated admin or player code:

```ts
import { requestSceneImage } from '@bunnyland/ui-web/api';
import { filterActions } from '@bunnyland/ui-web/play';
import { bindThemeSelect } from '@bunnyland/ui-web/theme';
import { renderGalleryItems } from '@bunnyland/ui-web/player-widgets';
import '@bunnyland/ui-web/assets/bunnyland-ui.css';
```

## Themes

The package owns the shared `--bl-*` CSS variables and the theme selector helpers. Theme names are:

- `purple-blue-dark`
- `purple-blue-light`
- `anime-dark`
- `anime-light`
- `earth-dark`
- `earth-light`

Use `bindThemeSelect(select)` for client selectors and `setTheme(theme)` for direct theme changes. New colors should be added as CSS variables before clients depend on them.

## Widgets

The framework-neutral widget helpers are split by audience:

- `@bunnyland/ui-web/widgets`: common storage, escaping, and simple data helpers.
- `@bunnyland/ui-web/player-widgets`: contextual player controls such as photo galleries.
- `@bunnyland/ui-web/admin-widgets`: detailed admin/editor controls such as tag editors and search dropdowns.

Framework-specific UI packages can wrap these behaviors in components without duplicating the underlying logic. Use narrow imports instead of the root package when a client only needs one audience-specific surface.

Player clients should favor contextual, rich controls for interacting with the current room, visible entities, exits, inventory, queued actions, and images. Admin clients should favor detailed inspection and editing controls such as structured fields, sliders, selectors, tag editors, and lower-level component data. Keep those surfaces separate when adding reusable widgets.

## Storybook

A component storybook renders the shared toolbar, theme selector, form controls, and widget
helpers as a live gallery so the style system is easy to review. Build it with:

```sh
npm run storybook
```

That builds the package and writes `storybook-dist/`:

- `index.html` — the live, interactive storybook (theme selector, tag editor, search dropdown, client menu).
- `screenshots.html` — a gallery of one PNG per theme plus the client-menu overlay.
- `screenshots/*.png` — the captured screenshots.
- `storybook.zip` — an offline bundle of the HTML, CSS, JS, and screenshots.

The capture uses Playwright's bundled Chromium (`npx playwright install chromium`) and falls
back to a system Chrome via `STORYBOOK_BROWSER_CHANNEL` when the bundled browser is missing.

CI publishes the `storybook-dist/` directory and `storybook.zip` as build artifacts and builds
`Dockerfile.storybook` into an nginx image (`bunnyland-ui-web-storybook`) that serves the
browsable storybook.

## Checks

Run:

```sh
npm run check
```

That runs ESLint, the Vite library build, TypeScript declaration generation, and Node test coverage.
