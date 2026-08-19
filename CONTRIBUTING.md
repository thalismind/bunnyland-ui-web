# Contributing to bunnyland-ui-web

Thanks for helping build the shared UI layer behind the Bunnyland browser
clients. This repository holds the Preact components, browser helpers, CSS, and
gameplay display utilities that [bunnyland-web](https://github.com/thalismind/bunnyland-web)
and [bunnyland-3d](https://github.com/thalismind/bunnyland-3d) consume.
Contributions from people, bots, and human-supervised agents are all welcome and
held to the same bar. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## What this repo is (and isn't)

bunnyland-ui-web is a **shared client library**, published as `@bunnyland/ui-web`.
Clients are views and input surfaces — they render projections and submit
commands. They are **not** the source of truth for simulation rules. If a rule
matters, it belongs on the server.

Because several clients depend on this package, treat every exported component,
helper, and browser global as a contract:

- `window.BunnylandUI`, `window.BunnylandApi`, and `window.BunnylandPlay` are
  legacy browser globals that static clients still rely on. Keep them working.
- Removing or renaming an export, or narrowing its accepted values, is a breaking
  change. Prefer additive changes.
- A component that enforces a capability or state rule must keep enforcing it.
  Equivalent surfaces across clients stay in parity; see section 12 of the
  server's `CLAUDE.md`.

## Getting set up

```bash
npm install
npm run check          # lint, build, coverage, and component tests
```

Useful individual scripts:

```bash
npm run lint           # eslint across src, test, storybook, scripts, configs
npm run build          # tsc project build followed by vite build
npm run test           # node --test plus vitest
npm run test:components # vitest only
npm run storybook      # build the component catalogue
```

## Accessibility

Interactive elements must be reachable and operable by keyboard and announced to
screen readers. Use real `<button>` elements for actions rather than click
handlers on `<div>`s, keep focus management intact in dialogs and menus, and give
icon-only controls an accessible name. Components here are reused across every
client, so an accessibility regression multiplies.

## Before you open a pull request

- `npm run check` passes.
- New or changed behavior has a test.
- Exported surfaces that changed are additive, or the change is called out
  explicitly as breaking.
- `npm audit --audit-level=moderate` reports no new advisories.

## Reporting security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
