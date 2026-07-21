'use strict';

// Storybook glue. Uses the shared browser globals published by bunnyland-ui.js
// (window.BunnylandUI) so the demos exercise the real widget helpers rather than copies.
(function storybook() {
  const ui = window.BunnylandUI;
  const params = new URLSearchParams(location.search);

  // ── Theme selector ──────────────────────────────────────────────────────────
  const themeSelect = document.getElementById('theme-select');
  ui.bindThemeSelect(themeSelect);
  // A ?theme=<name> override lets the screenshot capture pin each palette deterministically.
  const requestedTheme = params.get('theme');
  if (requestedTheme) {
    ui.setTheme(requestedTheme);
    if (themeSelect) themeSelect.value = ui.currentTheme();
  }
  const requestedScheme = params.get('scheme');
  if (requestedScheme) ui.setColorScheme(requestedScheme);

  // ── Color token swatches ────────────────────────────────────────────────────
  const swatchTokens = [
    '--bl-bg', '--bl-bg-strong', '--bl-surface', '--bl-surface-hover',
    '--bl-border', '--bl-border-control', '--bl-text', '--bl-text-soft',
    '--bl-accent', '--bl-accent-strong', '--bl-secondary',
    '--bl-ok', '--bl-error', '--bl-warn', '--bl-info',
  ];
  const swatchHost = document.getElementById('sb-swatches');
  if (swatchHost) {
    swatchHost.innerHTML = swatchTokens.map(token => `
      <div class="sb-swatch">
        <span class="chip" style="background: var(${token})"></span>
        <span>${ui.escapeHtml(token)}</span>
      </div>
    `).join('');
  }

  // ── Tag editor ──────────────────────────────────────────────────────────────
  const tagHost = document.getElementById('sb-tag-editor');
  if (tagHost) {
    tagHost.innerHTML = ui.tagEditorHtml(['forest', 'ambient', 'loop'], { addLabel: 'Add tag' });
    ui.bindTagEditor(tagHost);
  }

  // ── Search dropdown ─────────────────────────────────────────────────────────
  const dropdown = document.getElementById('sb-search-dropdown');
  if (dropdown) {
    ui.bindSearchDropdown(dropdown, {
      value: 'room:1',
      options: [
        { value: 'room:1', label: 'Sunlit Meadow' },
        { value: 'room:2', label: 'Warren Entrance' },
        { value: 'room:3', label: 'Hidden Burrow' },
        { value: 'room:4', label: 'Clover Field' },
      ],
    });
  }

  // ── Overlays: client menu + help modal ──────────────────────────────────────
  const clientMenu = ui.initClientMenu({ buttonId: 'btn-client-menu' });
  ui.initHelp({
    buttonId: 'btn-help',
    title: 'Storybook controls',
    intro: 'These shared overlays are reused across every Bunnyland client.',
    sections: [
      {
        title: 'Widgets shown here',
        items: [
          { label: 'Theme selector', desc: 'bindThemeSelect over all six palettes', key: 'toolbar' },
          { label: 'Tag editor', desc: 'tagEditorHtml + bindTagEditor', key: 'add / x' },
          { label: 'Search dropdown', desc: 'bindSearchDropdown type-to-filter', key: '↑ ↓ ⏎' },
        ],
      },
    ],
  });

  // ?open=menu / ?open=help lets the capture script screenshot an overlay in the open state.
  const open = params.get('open');
  if (open === 'menu') {
    clientMenu.open();
  }

  // Let the capture script know rendering has settled before it screenshots.
  document.body.dataset.storybookReady = 'true';
  window.__storybookReady = true;
}());
