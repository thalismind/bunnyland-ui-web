# Bunnyland web design language

This document is the canonical design contract for Bunnyland browser clients. The shared
tokens, native helpers, and Preact components live in `@bunnyland/ui-web`; application
repositories should consume them rather than copy their behavior.

## Principles

1. **Dense, readable tools.** Bunnyland clients are information-rich editors and play
   surfaces. Prefer compact controls, visible labels, and stable layouts over decorative
   whitespace.
2. **State changes are local.** Put interactive state in the smallest component that owns
   it. A changed field must not recreate unrelated lists, toolbars, canvases, or focused
   controls.
3. **The server remains authoritative.** Components display typed projections and schema
   data. They do not infer hidden world state or duplicate server rules.
4. **Native browser behavior first.** Use semantic buttons, labels, inputs, dialogs, and
   links. Preact coordinates those elements; it does not replace their accessibility.
5. **Imperative renderers are islands.** Three.js and LiteGraph retain ownership of their
   canvases. Preact owns their surrounding controls and uses refs/effects for lifecycle.

## Foundations

Import the shared stylesheet once per page:

```ts
import '@bunnyland/ui-web/assets/bunnyland-ui.css';
```

Colors, spacing, typography, radii, overlays, and semantic states derive from `--bl-*`
custom properties. Application CSS may compose these tokens but must not hard-code a
parallel palette.

The six built-in themes are paired dark/light palettes. Deployment themes register a
validated option and provide a matching `:root.bl-theme-<value>` token block. Theme choice
is stored under `bunnyland.theme`, reflected in `data-theme`, and broadcast with the
`bunnyland:themechange` event.

## Shared Preact elements

Import Preact components from the dedicated entry point:

```tsx
import {
  Button,
  EmptyState,
  Field,
  Pane,
  Pill,
  SearchSelect,
  StatusText,
  TagEditor,
  ThemeSelect,
  Toolbar,
  ToolbarBrand,
  ToolbarRow,
} from '@bunnyland/ui-web/preact';
```

Applications import directly from `preact` and `preact/hooks`; do not add React or
`preact/compat`. `preact` is a peer dependency, which keeps one runtime in the consuming
Vite application. Standalone consumers install a published package version or the CI-built
`artifacts/bunnyland-ui-web-<version>.tgz` rather than referencing a sibling checkout.

- `Toolbar`, `ToolbarRow`, and `ToolbarBrand` establish consistent application chrome.
- `Pane` owns a titled scroll/layout region and an optional tools slot.
- `Field` connects a visible label, control, and optional description.
- `Button` provides semantic `primary`, `secondary`, `danger`, and `quiet` variants.
- `StatusText`, `Pill`, and `EmptyState` express small, stable display states.
- `SearchSelect` and `TagEditor` are controlled components; their parent owns committed
  values while each component keeps only its transient input draft.
- `ThemeSelect` and `useTheme` share the same imperative theme contract used by legacy
  pages during migration.

## Component and state boundaries

- Key entity, component, edge, action, event, and queue rows with durable domain IDs.
- Never key mutable lists by their display position when an ID exists.
- Preserve object identity for unchanged records. Update nested data with structural
  sharing so child components can avoid work.
- Keep live transport state, filters, selected IDs, field drafts, and large projections in
  separate state owners.
- Do not place an entire world snapshot in a context consumed by every component.
- Effects that open timers, sockets, observers, or renderer instances must return cleanup.
- Use refs for mutable renderer instances and DOM focus/selection, not as a second state
  store.

## Interaction states

Every asynchronous operation exposes an idle, working, success, and failure state without
moving the primary controls. Disabled controls remain visible and explain their prerequisite
through adjacent text or a title. Destructive actions use the danger treatment and require
confirmation when recovery is not immediate.

Filtering must preserve input focus and selection. Live refreshes must preserve unchanged
row nodes, expanded details, scroll position, and active form drafts.

## Verification

For each migrated surface, browser tests should assert behavior through roles, labels, and
stable test IDs. Performance regressions should additionally verify that representative
unchanged rows remain the same DOM nodes after a live update and that focused inputs are not
replaced while typing.
