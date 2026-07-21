# Bunnyland UI Web

Shared Preact components, web UI assets, browser helpers, and gameplay display utilities for
Bunnyland browser clients. The package is publish-ready as `@bunnyland/ui-web` and keeps its
legacy browser globals intact while clients migrate incrementally.

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

## Vite, TypeScript, And Preact Clients

Install the package and its deliberately small Preact peer dependency:

```sh
npm install @bunnyland/ui-web preact
```

Then import the typed helpers. Prefer narrow modules so Vite and Rollup can tree shake unrelated admin or player code:

```ts
import { requestSceneImage } from '@bunnyland/ui-web/api';
import { filterActions } from '@bunnyland/ui-web/play';
import { bindThemeSelect } from '@bunnyland/ui-web/theme';
import { renderGalleryItems } from '@bunnyland/ui-web/player-widgets';
import '@bunnyland/ui-web/assets/bunnyland-ui.css';
```

Use direct Preact imports for shared functional components and hooks; React and
`preact/compat` are not required:

```tsx
import { render } from 'preact';
import { useState } from 'preact/hooks';
import {
  Button,
  Field,
  Pane,
  SearchSelect,
  ThemeSelect,
  Toolbar,
  ToolbarRow,
  useTheme,
} from '@bunnyland/ui-web/preact';
```

`preact` is a peer dependency so each application owns one runtime and Vite can deduplicate
it. The library build externalizes `preact` and `preact/hooks` rather than bundling a second
copy. See the canonical [Bunnyland web design language](docs/developer/design-language.md)
for component boundaries, interaction states, and migration rules.

## Package Releases

Stable GitHub releases publish the matching package version to the public npm registry with
provenance. The release tag must exactly match `v<package.json version>`; for example,
package version `0.2.0` is published from tag `v0.2.0`. The dedicated `publish.yml` workflow
runs the complete package gate again before publishing.

The first publication needs a granular npm automation token with access to the `@bunnyland`
scope in the repository's `NPM_TOKEN` Actions secret. Once the package exists, configure its
npm trusted publisher with organization `thalismind`, repository `bunnyland-ui-web`, workflow
`publish.yml`, and the `npm publish` action. Then revoke the bootstrap token; the same
workflow uses GitHub Actions OIDC and automatically attaches npm provenance.

Consumers should pin an exact registry version:

```sh
npm install --save-exact @bunnyland/ui-web@0.2.0 preact
```

## Versioned Package Artifact

Build a standalone npm tarball for local package inspection with:

```sh
npm ci
npm run pack:artifact
```

The output is `artifacts/bunnyland-ui-web-<version>.tgz`. It contains `package.json`, typed
`dist/` entry points, legacy `assets/`, source maps, and documentation, and has no dependency
on an adjacent checkout. CI uploads this tarball for every checked revision as a diagnostic
artifact. Release consumers use the exact published registry version, never an adjacent
source directory or a checked-in tarball.

## Themes

The package owns the shared `--bl-*` CSS variables and theme selector helpers. Built-in
palette names are:

- `purple-blue`
- `candy`
- `earth`
- `ocean`
- `sunset`
- `high-contrast`

Each palette follows `prefers-color-scheme` by default. The shared client menu can force
Dark or Light appearance, or return to Auto (System). Use `bindThemeSelect(select)` for
palette selectors, `bindColorSchemeSelect(select)` for appearance selectors, and
`setTheme(theme)` or `setColorScheme(scheme)` for direct changes. Old paired values such as
`anime-light` continue to load as migration aliases (`candy` with Light forced). New colors
should be added as CSS variables before clients depend on them.

Deployments can add their own theme choices without changing this package:

```ts
import { registerThemeOptions } from '@bunnyland/ui-web/theme';

registerThemeOptions([
  { value: 'server-night', label: 'Server Night' },
]);
```

Then serve CSS for the matching root class:

```css
:root.bl-theme-server-night {
  color-scheme: dark;
  --bl-bg: #101218;
  --bl-surface: #202532;
  --bl-text: #f0f4ff;
  --bl-accent: #74c7ec;
}
```

Static browser clients also read a `themes` array from deployment `config.json` and register
those options automatically. Theme values must use lowercase letters, numbers, and hyphens so
the value maps directly to `bl-theme-<value>`. Set `theme` in `config.json` to make one of
those values the deployment default, or share a link with `?theme=<value>` to choose a theme
from the URL.

See [custom web themes](docs/admin/custom-web-themes.md) for the server-admin setup guide.

## Widgets

The framework-neutral widget helpers are split by audience:

- `@bunnyland/ui-web/widgets`: common storage, escaping, and simple data helpers.
- `@bunnyland/ui-web/player-widgets`: contextual player controls such as photo galleries.
- `@bunnyland/ui-web/admin-widgets`: detailed admin/editor controls such as tag editors and search dropdowns.

Framework-specific UI packages can wrap these behaviors in components without duplicating the underlying logic. Use narrow imports instead of the root package when a client only needs one audience-specific surface.

Player clients should favor contextual, rich controls for interacting with the current room, visible entities, exits, inventory, queued actions, and images. Admin clients should favor detailed inspection and editing controls such as structured fields, sliders, selectors, tag editors, and lower-level component data. Keep those surfaces separate when adding reusable widgets.

## Player live updates and disclosed facts

`@bunnyland/ui-web/play` owns the shared remote-player update coordinator. It authenticates
the character WebSocket in the first frame so claim secrets never appear in URLs, coalesces
bursts into serialized refreshes, reconnects with backoff, and resumes the character-scoped
recent-event fallback while disconnected. It deduplicates at-least-once event delivery by
`event_id`, detects `stream_sequence` gaps, and refreshes the character projection after a
gap or `resync`. Use one coordinator per claimed character rather than giving each panel its
own socket or polling loop.

Player activity renderers understand serialized `facts` entries with stable `key`, `text`,
and numeric `detail`. Render the provided text in server order; do not reinterpret component
state or apply a second client-side cutoff. Action controls likewise consume the serialized
registry `actions` and `target_groups`. Missing metadata means an empty/disabled action state,
not a static browser verb catalogue.

## Storybook

A component storybook renders the shared Preact foundation, theme selector, form controls,
legacy widget helpers, and every semantic state as a live gallery. Build it with:

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

That runs ESLint, the Vite 8 library build, TypeScript declaration generation, Node test
coverage, and the Preact component tests in a browser-like DOM.

## License

Licensed under the GNU Affero General Public License v3.0 or later. See
[LICENSE](LICENSE).
