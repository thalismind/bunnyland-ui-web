import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
  ApiError,
  actionIcon,
  assertSameOriginBase,
  characterHref,
  claimCharacter,
  claimHeaders,
  createPlayerLiveUpdates,
  drainNarratedEvents,
  fetchCharacterProjection,
  fetchClaimProjection,
  fetchQueuedCommands,
  filterActions,
  getPlayerAuth,
  imageCompletions,
  initTheme,
  isClaimNotFoundError,
  latestImageCompletion,
  login,
  mediaUrl,
  mergePlayerHeaders,
  normalizeBase,
  normalizeTheme,
  openPlayerUpdates,
  parseCharacterProjection,
  queuedCommandLabel,
  registerThemeOption,
  registerThemeOptions,
  sendJson,
  serverFromUrl,
  setPlayerAuth,
  socketUrl,
  updateSpeechBubbles,
  bindThemeSelect,
  COLOR_SCHEME_KEY,
  currentColorScheme,
  setColorScheme,
  THEME_KEY,
  themeFromSearch,
  themeOptions,
} from '../dist/index.js';
import { renderGalleryItems } from '../dist/player-widgets.js';

test('shared application root preserves the bounded viewport flex chain', () => {
  const css = fs.readFileSync('assets/bunnyland-ui.css', 'utf8');
  const js = fs.readFileSync('assets/bunnyland-ui.js', 'utf8');
  const bodyRule = css.match(/body\s*\{([^}]+)\}/)?.[1] || '';
  const rule = css.match(/:where\(body > #app\)\s*\{([^}]+)\}/)?.[1] || '';

  assert.match(bodyRule, /height:\s*100vh/);
  assert.match(css, /@supports \(height: 100dvh\)/);
  assert.match(css, /body \{ height: 100dvh; \}/);
  assert.match(rule, /display:\s*flex/);
  assert.match(rule, /flex:\s*1 1 auto/);
  assert.match(rule, /height:\s*100%/);
  assert.match(rule, /min-height:\s*0/);

  const buttonRule = css.match(/\nbutton\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(buttonRule, /line-height:\s*1\.2/);

  const toolbarRule = css.match(/\.toolbar-row\s*\{([^}]+)\}/)?.[1] || '';
  const statusRule = css.match(/#api-status\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(toolbarRule, /flex-wrap:\s*wrap/);
  assert.match(toolbarRule, /min-width:\s*0/);
  assert.match(css, /\.toolbar-row \+ \.toolbar-row/);
  assert.match(css, /\.toolbar-heading\s*\{/);
  assert.match(statusRule, /overflow-wrap:\s*anywhere/);
  assert.match(statusRule, /white-space:\s*normal/);
  assert.match(js, /new URL\(item\.href, clientMenuBaseUrl \|\| location\.href\)/);
});

test('shared navigation recommends Web TUI and separates player and admin tools', () => {
  const css = fs.readFileSync('assets/bunnyland-ui.css', 'utf8');
  const js = fs.readFileSync('assets/bunnyland-ui.js', 'utf8');

  assert.ok(js.indexOf("href: 'web-tui.html'") < js.indexOf("href: 'toon-client.html'"));
  assert.match(js, /group: 'Player clients'/);
  assert.match(js, /group: 'Builder & admin'/);
  assert.match(js, /recommended: true/);
  assert.match(js, /client-menu-section-title/);
  assert.match(js, /client-menu-recommended/);
  assert.match(css, /\.client-menu-section-title\s*\{/);
  assert.match(css, /\.client-menu-recommended\s*\{/);
  assert.match(js, /config\?\.\['3dUrl'\]/);
  assert.match(js, /containDialogFocus/);
  assert.match(js, /clientMenuPreviousFocus\?\.focus/);
  assert.match(js, /helpPreviousFocus\?\.focus/);
});

test('shared browser UI exposes styled asynchronous dialogs', () => {
  const css = fs.readFileSync('assets/bunnyland-ui.css', 'utf8');
  const js = fs.readFileSync('assets/bunnyland-ui.js', 'utf8');

  for (const helper of ['alertDialog', 'confirmDialog', 'credentialsDialog', 'promptDialog']) {
    assert.match(js, new RegExp(`\\b${helper},`));
  }
  assert.match(css, /dialog\s*\{[\s\S]*position:\s*fixed[\s\S]*inset:\s*0[\s\S]*margin:\s*auto[\s\S]*padding:\s*14px/);
  assert.match(css, /dialog::backdrop\s*\{\s*background:\s*var\(--bl-overlay\)/);
  assert.match(css, /dialog\[open\]:not\(:modal\)[\s\S]*100vmax\s+var\(--bl-overlay\)/);
  assert.match(css, /input\[type=password\]/);
  assert.match(css, /\.bl-dialog\s*\{/);
  assert.doesNotMatch(fs.readFileSync('assets/bunnyland-api.js', 'utf8'), /window\.(?:alert|confirm|prompt)\s*\(/);
});

test('shared styles define every token they use and expose keyboard and player-mobile rules', () => {
  const css = fs.readFileSync('assets/bunnyland-ui.css', 'utf8');
  const defined = new Set([...css.matchAll(/(--bl-[a-z0-9-]+)\s*:/g)].map(match => match[1]));
  const used = new Set([...css.matchAll(/var\((--bl-[a-z0-9-]+)/g)].map(match => match[1]));

  assert.deepEqual([...used].filter(token => !defined.has(token)).sort(), []);
  assert.match(css, /:where\(a, button, input, select, textarea, \[tabindex\]\):focus-visible/);
  assert.match(css, /\.bl-page-web-tui[\s\S]*--bl-text-md:\s*16px/);
  assert.match(css, /\.bl-page-web-repl[\s\S]*min-height:\s*44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /\.bl-visually-hidden\s*\{/);
});

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('API and theme helpers normalize shared client state', () => {
  assert.equal(normalizeBase(' http://server.test/api/ '), 'http://server.test/api');
  assert.equal(
    socketUrl('https://server.test/api/', '/admin/world/stream'),
    'wss://server.test/api/admin/world/stream',
  );
  assert.equal(normalizeTheme('dark'), 'midnight');
  assert.equal(normalizeTheme('purple-blue'), 'midnight');
  assert.equal(normalizeTheme('purple-blue-light'), 'midnight');
  assert.equal(normalizeTheme('anime-light'), 'candy');
  assert.equal(normalizeTheme('nope'), 'midnight');
});

test('built-in theme options expose palettes independently of color scheme', () => {
  assert.deepEqual(themeOptions().map(option => option.value), [
    'midnight',
    'candy',
    'earth',
    'ocean',
    'sunset',
    'high-contrast',
  ]);
  assert.deepEqual(themeOptions()[0], {
    value: 'midnight',
    label: 'Midnight Blue / Lavender',
  });
  const css = fs.readFileSync('assets/bunnyland-ui.css', 'utf8');
  assert.match(css, /@media \(prefers-color-scheme: light\)/);
  assert.match(css, /\.bl-color-scheme-light/);
  assert.match(css, /\.bl-color-scheme-dark/);
});

test('API helpers include player auth in claim headers', () => {
  setPlayerAuth('Bearer player-token');

  assert.equal(getPlayerAuth(), 'Bearer player-token');
  assert.equal(claimHeaders({ claimSecret: 'claim-secret' }).Authorization, 'Bearer player-token');
  assert.equal(
    claimHeaders({ claimSecret: 'claim-secret' })['X-Bunnyland-Claim-Secret'],
    'claim-secret',
  );

  setPlayerAuth('');
});

test('shared login refuses to submit browser credentials cross-origin', async () => {
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  let fetched = false;
  globalThis.location = {
    href: 'https://sandbox.example/index.html',
    origin: 'https://sandbox.example',
  };
  globalThis.fetch = async () => {
    fetched = true;
    return new Response('{}');
  };
  try {
    await assert.rejects(
      login('https://phishing.example/api', 'player', 'secret'),
      /page origin/,
    );
    assert.equal(fetched, false);
  } finally {
    globalThis.location = previousLocation;
    globalThis.fetch = previousFetch;
  }
});

test('all browser transport and configuration helpers enforce same-origin bases', async () => {
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  globalThis.location = {
    href: 'https://sandbox.example/client?server=%2Fapi',
    origin: 'https://sandbox.example',
    search: '?server=%2Fapi',
  };
  globalThis.fetch = async () => new Response('{"ok":true}', {
    headers: { 'Content-Type': 'application/json' },
  });
  try {
    assert.equal(assertSameOriginBase('/api'), '/api');
    assert.equal(serverFromUrl(), '/api');
    assert.equal(
      socketUrl('/api', '/admin/world/stream'),
      'wss://sandbox.example/api/admin/world/stream',
    );
    assert.equal(mediaUrl('/api', '/public/media/image.png'), '/api/public/media/image.png');
    assert.equal(mediaUrl('/api/v1/', '/v1/public/media/image.png'), '/api/v1/public/media/image.png');
    assert.equal(mediaUrl('https://sandbox.example/v1/', '/v1/public/media/image.png'), 'https://sandbox.example/v1/public/media/image.png');
    assert.equal(mediaUrl('/api', 'data:image/png;base64,AA=='), 'data:image/png;base64,AA==');
    await sendJson('/api', '/public/health');

    for (const operation of [
      () => assertSameOriginBase('https://evil.example/api'),
      () => serverFromUrl('?server=https%3A%2F%2Fevil.example%2Fapi'),
      () => socketUrl('https://evil.example/api'),
      () => mediaUrl('/api', 'https://evil.example/image.png'),
      () => sendJson('https://evil.example/api', '/public/health'),
    ]) {
      await assert.rejects(async () => operation(), /page origin/);
    }
  } finally {
    globalThis.location = previousLocation;
    globalThis.fetch = previousFetch;
  }
});

class FakePlayerSocket {
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closed = false;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
  }

  send(data) { this.sent.push(data); }
  close() { this.closed = true; }
  open() { this.onopen?.(); }
  message(frame) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  disconnect() { this.onclose?.(); }
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('player update transport authenticates in the first frame without URL secrets', () => {
  setPlayerAuth('');
  let socket;
  const frames = [];
  const opened = openPlayerUpdates({
    base: 'https://server.test/api',
    characterId: 'character:1',
    control: { claimId: 'claim-1', claimSecret: 'top-secret', clientId: 'client-1' },
    webSocketFactory: url => (socket = new FakePlayerSocket(url)),
    onFrame: frame => frames.push(frame),
  });

  socket.open();
  assert.equal(opened, socket);
  assert.equal(
    socket.url,
    'wss://server.test/api/play/claims/claim-1/stream',
  );
  assert.doesNotMatch(socket.url, /top-secret/);
  assert.deepEqual(JSON.parse(socket.sent[0]), {
    type: 'authenticate',
    data: { token: null, client_id: 'client-1' },
  });
  socket.message({ type: 'mystery', data: {} });
  socket.message({ type: 'event', data: { event_type: 'Moved' } });
  assert.equal(frames.length, 1);
});

test('live coordinator stops polling at ready and resumes immediately on disconnect', async () => {
  const sockets = [];
  const states = [];
  let refreshes = 0;
  const live = createPlayerLiveUpdates({
    base: 'http://server.test',
    characterId: 'character:1',
    control: { claimId: 'claim-1', claimSecret: 'secret', clientId: 'client-1' },
    refresh: () => { refreshes += 1; },
    onState: state => states.push(state),
    webSocketFactory: url => {
      const socket = new FakePlayerSocket(url);
      sockets.push(socket);
      return socket;
    },
    random: () => 0.5,
  });

  sockets[0].open();
  await wait(20);
  assert.equal(refreshes, 1);
  sockets[0].message({ type: 'ready', data: { character_id: 'character:1', world_epoch: 1 } });
  await wait(2050);
  assert.equal(refreshes, 1);
  assert.equal(live.getState(), 'live');
  sockets[0].disconnect();
  await wait(20);
  assert.equal(refreshes, 2);
  assert.equal(live.getState(), 'fallback');
  live.close();
  assert.equal(live.getState(), 'closed');
  assert.deepEqual(states.slice(0, 3), ['connecting', 'live', 'fallback']);
});

test('live coordinator pauses fallback refreshes while hidden and refreshes when visible', async () => {
  const originalDocument = globalThis.document;
  let hidden = true;
  let visibilityListener;
  let removedListener;
  globalThis.document = {
    get hidden() { return hidden; },
    addEventListener(name, listener) {
      if (name === 'visibilitychange') visibilityListener = listener;
    },
    removeEventListener(name, listener) {
      if (name === 'visibilitychange') removedListener = listener;
    },
  };
  try {
    let socket;
    let refreshes = 0;
    const live = createPlayerLiveUpdates({
      base: 'http://server.test',
      characterId: 'character:1',
      control: { claimId: 'claim-1', claimSecret: 'secret', clientId: 'client-1' },
      refresh: () => { refreshes += 1; },
      webSocketFactory: url => (socket = new FakePlayerSocket(url)),
    });

    socket.disconnect();
    await wait(20);
    assert.equal(refreshes, 0);
    hidden = false;
    visibilityListener();
    await wait(20);
    assert.equal(refreshes, 1);
    live.close();
    assert.equal(removedListener, visibilityListener);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('live coordinator coalesces bursts and serializes a follow-up refresh', async () => {
  let socket;
  let releaseFirst;
  const calls = [];
  const live = createPlayerLiveUpdates({
    base: 'http://server.test',
    characterId: 'character:1',
    control: { claimId: 'claim-1', claimSecret: 'secret', clientId: 'client-1' },
    refresh: () => {
      calls.push(calls.length + 1);
      if (calls.length === 1) return new Promise(resolve => { releaseFirst = resolve; });
    },
    webSocketFactory: url => (socket = new FakePlayerSocket(url)),
  });
  socket.open();
  await wait(20);
  socket.message({ type: 'ready', data: { character_id: 'character:1', world_epoch: 1 } });
  socket.message({ type: 'event', data: {} });
  socket.message({ type: 'invalidate', data: { world_epoch: 2 } });
  socket.message({ type: 'resync', data: { world_epoch: 2 } });
  releaseFirst();
  await wait(200);

  assert.deepEqual(calls, [1, 2]);
  live.close();
});

test('live coordinator deduplicates events and refreshes after stream gaps', async () => {
  let socket;
  let refreshes = 0;
  const frames = [];
  const live = createPlayerLiveUpdates({
    base: 'http://server.test',
    characterId: 'character:1',
    control: { claimId: 'claim-1', claimSecret: 'secret', clientId: 'client-1' },
    refresh: () => { refreshes += 1; },
    onFrame: frame => frames.push(frame),
    webSocketFactory: url => (socket = new FakePlayerSocket(url)),
  });
  socket.open();
  await wait(20);
  socket.message({
    type: 'ready',
    data: { character_id: 'character:1', world_epoch: 1 },
    protocol_version: 1,
    stream_sequence: 1,
  });
  socket.message({
    type: 'event',
    data: { event_type: 'Moved' },
    protocol_version: 1,
    stream_sequence: 2,
    event_id: 'event-1',
  });
  socket.message({
    type: 'event',
    data: { event_type: 'Moved' },
    protocol_version: 1,
    stream_sequence: 3,
    event_id: 'event-1',
  });
  socket.message({
    type: 'event',
    data: { event_type: 'Spoke' },
    protocol_version: 1,
    stream_sequence: 5,
    event_id: 'event-2',
  });
  await wait(200);

  assert.deepEqual(frames.map(frame => frame.event_id || frame.type), [
    'ready',
    'event-1',
    'event-2',
  ]);
  assert.equal(refreshes, 2);
  live.close();
});

test('API sendJson merges player auth into explicit headers', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  setPlayerAuth('Bearer player-token');
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    const headers = mergePlayerHeaders({ 'X-Bunnyland-Claim-Secret': 'claim-secret' });
    assert.equal(headers.get('Authorization'), 'Bearer player-token');
    assert.equal(headers.get('X-Bunnyland-Claim-Secret'), 'claim-secret');

    const result = await sendJson('http://server.test/api/', '/play/claims/claim-1/projection', {
      headers: { 'X-Bunnyland-Claim-Secret': 'claim-secret' },
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer player-token');
    assert.equal(calls[0].options.headers.get('X-Bunnyland-Claim-Secret'), 'claim-secret');

    setPlayerAuth('Bearer fresh-player-token');
    const stale = mergePlayerHeaders({
      Authorization: 'Bearer stale-player-token',
      'X-Bunnyland-Claim-Secret': 'claim-secret',
    });
    assert.equal(stale.get('Authorization'), 'Bearer fresh-player-token');
    assert.equal(stale.get('X-Bunnyland-Claim-Secret'), 'claim-secret');
  } finally {
    globalThis.fetch = previousFetch;
    setPlayerAuth('');
  }
});

test('expired stored claims are replaced with a fresh claim', async () => {
  const previousFetch = globalThis.fetch;
  const previousLocalStorage = globalThis.localStorage;
  const previousLocation = globalThis.location;
  const values = new Map([['client.claim.character:1', JSON.stringify({
    controllerId: 'controller:old', claimId: 'claim:old', claimSecret: 'secret:old',
  })]]);
  const calls = [];
  globalThis.location = new URL('http://server.test/client');
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ method: options.method, url });
    if (calls.length === 1) {
      return new Response('{"detail":"claim does not exist"}', {
        headers: { 'Content-Type': 'application/json' }, status: 404,
      });
    }
    return new Response(JSON.stringify({
      character_id: 'character:1', controller_id: 'controller:new', generation: 1,
      id: 'claim:new',
    }), {
      headers: { 'Content-Type': 'application/json', 'X-Bunnyland-Claim-Secret': 'secret:new' },
      status: 201,
    });
  };
  try {
    const control = await claimCharacter('http://server.test', 'character:1', 'client');
    assert.deepEqual(calls, [
      { method: 'POST', url: 'http://server.test/play/claims/claim%3Aold/recover' },
      { method: 'POST', url: 'http://server.test/play/claims' },
    ]);
    assert.equal(control.claimId, 'claim:new');
    const stored = JSON.parse(values.get('client.claim.character:1'));
    assert.equal(stored.claimId, 'claim:new');
    assert.equal('claimSecret' in stored, false);
    assert.equal(isClaimNotFoundError(new ApiError('missing', 404)), true);
    assert.equal(isClaimNotFoundError(new ApiError('forbidden', 403)), false);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousLocalStorage;
    globalThis.location = previousLocation;
  }
});

test('claim projections are fetched once and parsed for every player view', async () => {
  const previousFetch = globalThis.fetch;
  const previousLocation = globalThis.location;
  let resolveFetch;
  let calls = 0;
  globalThis.location = new URL('http://server.test/client');
  globalThis.fetch = () => {
    calls += 1;
    return new Promise(resolve => { resolveFetch = resolve; });
  };
  const control = {
    characterId: 'character:1', claimId: 'claim:1', claimSecret: 'secret:1',
    controllerId: 'controller:1', generation: 1,
  };
  try {
    const characterRequest = fetchCharacterProjection('http://server.test', 'character:1', control);
    const queueRequest = fetchQueuedCommands('http://server.test', 'character:1', control);
    const bundleRequest = fetchClaimProjection('http://server.test', 'character:1', control);
    assert.equal(calls, 1);
    resolveFetch(new Response(JSON.stringify({
      character_id: 'character:1', room: { id: 'room:1' }, commands: [{ command_id: 'queued:1' }],
    }), { headers: { 'Content-Type': 'application/json' } }));
    const [character, queued, bundle] = await Promise.all([characterRequest, queueRequest, bundleRequest]);
    assert.equal(character.characterId, 'character:1');
    assert.equal(queued.commands[0].command_id, 'queued:1');
    assert.equal(bundle.character.characterId, 'character:1');
    assert.equal(bundle.queued.commands[0].command_id, 'queued:1');
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.location = previousLocation;
  }
});

test('server admins can register custom theme options', () => {
  assert.deepEqual(registerThemeOption({ value: 'server-night', label: 'Server Night' }), {
    value: 'server-night',
    label: 'Server Night',
  });
  assert.equal(registerThemeOption({ value: '../bad', label: 'Bad' }), null);
  assert.deepEqual(registerThemeOptions([{ value: 'server-day', label: 'Server Day' }]), [{
    value: 'server-day',
    label: 'Server Day',
  }]);
  assert.equal(normalizeTheme('server-night'), 'server-night');
  assert.equal(themeOptions().some(option => option.value === 'server-day'), true);
});

test('config defaults and shared links can choose custom themes', () => {
  registerThemeOptions([
    { value: 'site-default', label: 'Site Default' },
    { value: 'linked-theme', label: 'Linked Theme' },
  ]);
  assert.equal(themeFromSearch('?theme=linked-theme'), 'linked-theme');
  assert.equal(themeFromSearch('?theme=anime-light'), 'candy');
  assert.equal(themeFromSearch('?theme=missing-theme'), null);

  const classes = new Set(['bl-theme-purple-blue-dark']);
  const values = new Map();
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;
  globalThis.document = {
    documentElement: {
      classList: {
        add: value => classes.add(value),
        remove: value => classes.delete(value),
        [Symbol.iterator]: function* iterator() { yield* classes; },
      },
      dataset: {},
    },
  };
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    assert.equal(initTheme(globalThis.document.documentElement, 'site-default', ''), 'site-default');
    assert.equal(values.has(THEME_KEY), false);
    assert.equal(globalThis.document.documentElement.dataset.theme, 'site-default');

    assert.equal(initTheme(globalThis.document.documentElement, 'site-default', '?theme=linked-theme'), 'linked-theme');
    assert.equal(values.get(THEME_KEY), 'linked-theme');
    assert.equal(globalThis.document.documentElement.dataset.theme, 'linked-theme');

    values.set(THEME_KEY, 'site-default');
    assert.equal(initTheme(globalThis.document.documentElement, 'linked-theme', '?theme=missing-theme'), 'site-default');
  } finally {
    globalThis.document = previousDocument;
    globalThis.localStorage = previousLocalStorage;
  }
});

test('theme select restores the stored theme on page load', () => {
  const classes = new Set(['bl-theme-purple-blue-dark']);
  const listeners = new Map();
  const values = new Map([[THEME_KEY, 'earth-light']]);
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;
  globalThis.document = {
    documentElement: {
      classList: {
        add: value => classes.add(value),
        remove: value => classes.delete(value),
        [Symbol.iterator]: function* iterator() { yield* classes; },
      },
      dataset: {},
    },
  };
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const select = {
      innerHTML: '',
      value: '',
      addEventListener: (event, handler) => listeners.set(event, handler),
    };
    bindThemeSelect(select);
    assert.equal(select.value, 'earth');
    assert.equal(globalThis.document.documentElement.dataset.theme, 'earth');
    assert.equal(globalThis.document.documentElement.dataset.colorScheme, 'light');
    assert.equal(classes.has('bl-theme-earth'), true);
    assert.equal(classes.has('bl-color-scheme-light'), true);
    assert.equal(values.get(COLOR_SCHEME_KEY), 'light');
    registerThemeOption({ value: 'server-dusk', label: 'Server Dusk' });
    assert.match(select.innerHTML, /server-dusk/);
    select.value = 'candy';
    listeners.get('change')();
    assert.equal(values.get(THEME_KEY), 'candy');

    setColorScheme('auto');
    assert.equal(currentColorScheme(), 'auto');
    assert.equal(classes.has('bl-color-scheme-light'), false);
    assert.equal(values.get(COLOR_SCHEME_KEY), 'auto');
  } finally {
    globalThis.document = previousDocument;
    globalThis.localStorage = previousLocalStorage;
  }
});

test('play helpers parse projections, filter actions, and label queued commands', () => {
  const projection = parseCharacterProjection({
    character_id: 'character:1',
    world_epoch: 12,
    room: {
      id: 'room:1',
      description: 'A clear route map hangs beside the door.',
      entities: [{ id: 'item:1', name: 'Brass Key', kind: 'item' }],
      exits: [{ id: 'room:2', direction: 'north', label: 'Hallway' }],
    },
    inventory: [{ id: 'item:2', label: 'Lantern', kind: 'item' }],
    target_groups: {
      inventory: [{ id: 'item:2', label: 'Lantern', kind: 'item' }],
    },
    actions: [
      { command_type: 'say', tool_name: 'say', title: 'Say', cost: { action: 1 } },
      { command_type: 'wait', tool_name: 'wait', title: 'Wait', available: false },
    ],
  });

  assert.equal(projection.characterId, 'character:1');
  assert.equal(projection.room.description, 'A clear route map hangs beside the door.');
  assert.equal(actionIcon(projection.actions[0]), '💬');
  assert.equal(actionIcon({ command_type: 'scan-network' }), '📡');
  assert.equal(filterActions(projection.actions, 'say')[0].command_type, 'say');
  assert.equal(
    queuedCommandLabel({ command_type: 'say', lane: 'focus', cost: { action: 1 }, payload: { text: 'hello' } }, projection.actions),
    'Say [focus] - 1 AP · text: hello',
  );
});

test('event and image helpers share player narration behavior', () => {
  const messages = [
    {
      data: {
        event_type: 'ImageGenerationCompletedEvent',
        event: { event_id: 'image:1', world_epoch: 4, purpose: 'event', entity_id: 'room:1', url: '/public/media/scene.png' },
      },
    },
    {
      data: {
        event_type: 'CommandRejectedEvent',
        event: { event_id: 'event:1', visibility: 'directed', actor_id: 'character:1', reason: 'too tired' },
      },
    },
  ];

  assert.deepEqual(
    plain(imageCompletions(messages, 'http://server.test/api', 'event')),
    [{ entityId: 'room:1', purpose: 'event', url: 'http://server.test/api/public/media/scene.png', alphaUrl: '', epoch: 4 }],
  );
  assert.equal(latestImageCompletion(messages, { base: 'http://server.test/api', purpose: 'event' }).url, 'http://server.test/api/public/media/scene.png');

  const drained = drainNarratedEvents(messages, {
    playerId: 'character:1',
    nameFor: id => id === 'character:1' ? 'Bun' : id,
  });
  assert.equal(drained.lines.length, 1);
  assert.match(drained.lines[0].text, /too tired/);
  assert.equal(drained.lines[0].kind, 'rejection');

  const inspected = drainNarratedEvents([{
    data: {
      event_type: 'EntityInspectedEvent',
      event: {
        event_id: 'event:inspect',
        visibility: 'private',
        actor_id: 'character:1',
        name: 'Bun',
        facts: [{ key: 'needs.hunger', text: 'You are not hungry.', detail: 30 }],
      },
    },
  }], {
    playerId: 'character:1',
    nameFor: id => id === 'character:1' ? 'Bun' : id,
  });
  assert.match(inspected.lines[0].text, /You are not hungry\./);
  assert.doesNotMatch(inspected.lines[0].text, /needs\.hunger|\[object Object\]/);
});

test('speech bubbles project, replace, truncate, and expire visible speech events', () => {
  const now = Date.parse('2026-08-07T12:00:05.000Z');
  const event = (eventType, body) => ({ data: { event_type: eventType, event: body } });
  const bubbles = updateSpeechBubbles([], [
    event('SpeechSaidEvent', {
      event_id: 'speech:old', actor_id: 'character:1', text: 'First line',
      created_at: '2026-08-07T12:00:01.000Z',
    }),
    event('SpeechToldEvent', {
      event_id: 'speech:new', actor_id: 'character:1', text: 'x'.repeat(170),
      created_at: '2026-08-07T12:00:02.000Z',
    }),
    event('ConversationLineEvent', {
      event_id: 'conversation:1', actor_id: 'conversation:host', speaker_id: 'character:2',
      text: 'A conversational reply', created_at: '2026-08-07T12:00:03.000Z',
    }),
    event('ActorMovedEvent', {
      event_id: 'movement:1', actor_id: 'character:3', text: 'Not speech',
      created_at: '2026-08-07T12:00:04.000Z',
    }),
  ], now);

  assert.deepEqual(bubbles.map(bubble => bubble.speakerId), ['character:1', 'character:2']);
  assert.equal(bubbles[0].eventId, 'speech:new');
  assert.equal([...bubbles[0].text].length, 160);
  assert.equal(bubbles[0].text.endsWith('…'), true);
  assert.equal(bubbles[1].occurredAt, Date.parse('2026-08-07T12:00:03.000Z'));

  const repeated = updateSpeechBubbles(bubbles, [event('SpeechToldEvent', {
    event_id: 'speech:new', actor_id: 'character:1', text: 'x'.repeat(170),
    created_at: '2026-08-07T12:00:02.000Z',
  })], now + 500);
  assert.equal(repeated[0].expiresAt, bubbles[0].expiresAt);
  assert.deepEqual(updateSpeechBubbles(repeated, [], now + 3_500).map(bubble => bubble.speakerId), ['character:2']);
  assert.deepEqual(updateSpeechBubbles(repeated, [], now + 4_000), []);
});

test('browser asset globals stay compatible with static clients', async () => {
  const classes = new Set();
  const values = new Map();
  const context = {
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    console,
    document: {
      documentElement: {
        classList: {
          add: value => classes.add(value),
          remove: value => classes.delete(value),
          [Symbol.iterator]: function* iterator() { yield* classes; },
        },
        dataset: {},
      },
      getElementById: () => null,
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        theme: 'asset-default',
        themes: [
          { value: 'asset-default', label: 'Asset Default' },
          { value: 'asset-linked', label: 'Asset Linked' },
        ],
      }),
    }),
    globalThis: null,
    history: { replaceState: () => {} },
    location: {
      href: 'http://example.test/index.html',
      origin: 'http://example.test',
      pathname: '/index.html',
      search: '?theme=asset-linked',
    },
    localStorage: {
      getItem: key => values.get(key) || null,
      removeItem: key => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    },
    URL,
    URLSearchParams,
    window: null,
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  for (const file of ['assets/bunnyland-ui.js', 'assets/bunnyland-api.js', 'assets/bunnyland-play.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  assert.equal(typeof context.BunnylandUI.bindThemeSelect, 'function');
  assert.equal(typeof context.BunnylandUI.confirmDialog, 'function');
  assert.equal(typeof context.BunnylandUI.credentialsDialog, 'function');
  assert.equal(typeof context.BunnylandUI.promptDialog, 'function');
  assert.equal(typeof context.BunnylandUI.setColorScheme, 'function');
  assert.equal(typeof context.BunnylandApi.normalizeBase, 'function');
  assert.equal(typeof context.BunnylandPlay.filterActions, 'function');
  assert.equal(typeof context.BunnylandPlay.fetchCharacterProfile, 'function');
  assert.equal(typeof context.BunnylandPlay.fetchCharacterProfileList, 'function');
  assert.equal(typeof context.BunnylandPlay.createPlayerLiveUpdates, 'function');
  assert.equal(typeof context.BunnylandPlay.updateSpeechBubbles, 'function');
  await context.BunnylandUI.loadConfig();
  assert.equal(context.BunnylandUI.currentTheme(), 'asset-linked');
  assert.equal(classes.has('bl-theme-asset-linked'), true);
  assert.equal(values.get(THEME_KEY), 'asset-linked');
  assert.equal(context.BunnylandUI.setColorScheme('light'), 'light');
  assert.equal(context.BunnylandUI.currentColorScheme(), 'light');
  assert.equal(classes.has('bl-color-scheme-light'), true);

  const claimCalls = [];
  context.fetch = async (url, options) => {
    claimCalls.push({
      body: options.body ? JSON.parse(options.body) : null,
      credentials: options.credentials,
      headers: options.headers,
      method: options.method,
      url,
    });
    if (claimCalls.length === 1) {
      return {
        headers: { get: () => null }, json: async () => ({ detail: 'claim does not exist' }),
        ok: false, status: 404,
      };
    }
    return {
      headers: { get: name => name === 'X-Bunnyland-Claim-Secret' ? 'secret:new' : null },
      json: async () => ({ character_id: 'character:1', controller_id: 'controller:new', id: 'claim:new' }),
      ok: true, status: 201,
    };
  };
  const claimed = await context.BunnylandPlay.claimWebController('http://example.test', {
    character_id: 'character:1', claim_id: 'claim:old', client_id: 'client:1',
  }, { claimId: 'claim:old', clientId: 'client:1' });
  assert.equal(claimed.claim_id, 'claim:new');
  assert.equal('claim_secret' in claimed, false);
  assert.deepEqual(claimCalls.map(call => call.method), ['POST', 'POST']);
  assert.deepEqual(claimCalls.map(call => call.credentials), ['include', 'include']);
  assert.equal(claimCalls[0].body, null);
  assert.equal(claimCalls[0].headers['X-Bunnyland-Claim-Secret'], undefined);
  assert.equal(claimCalls[1].body.delivery, 'cookie');
  assert.equal(claimCalls[1].body.character_id, 'character:1');

  let firstSocket;
  const updates = context.BunnylandPlay.openPlayerUpdates({
    base: 'http://example.test',
    characterId: 'character:1',
    control: { claimId: claimed.claim_id, clientId: 'client:1' },
    onFrame: () => {},
    webSocketFactory: url => (firstSocket = new FakePlayerSocket(url)),
  });
  assert.equal(updates, firstSocket);
  assert.equal(firstSocket.url, 'ws://example.test/play/claims/claim%3Anew/stream');
  firstSocket.open();
  assert.deepEqual(JSON.parse(firstSocket.sent[0]), {
    type: 'authenticate',
    data: { token: null, client_id: 'client:1' },
  });
  assert.doesNotMatch(firstSocket.sent[0], /claim|secret/i);

  let projectionCalls = 0;
  context.fetch = async () => {
    projectionCalls += 1;
    return {
      json: async () => ({
        character_id: 'character:1', commands: [{ command_id: 'queued:1' }],
        room: { id: 'room:1', entities: [] },
      }),
      ok: true, status: 200,
    };
  };
  const control = { claimId: 'claim:new', claimSecret: 'secret:new' };
  const [character, queued, room] = await Promise.all([
    context.BunnylandPlay.fetchCharacterProjection('http://example.test', 'character:1', control),
    context.BunnylandPlay.fetchQueuedCommands('http://example.test', 'character:1', control),
    context.BunnylandPlay.fetchRoomProjection('http://example.test', 'room:1', 'character:1', control),
  ]);
  assert.equal(projectionCalls, 1);
  assert.equal(character.characterId, 'character:1');
  assert.equal(queued.commands[0].command_id, 'queued:1');
  assert.equal(room.room.id, 'room:1');
});

test('gallery helpers render images with the correct spelling', () => {
  const html = renderGalleryItems([{
    id: 'one',
    src: 'data:image/png;base64,abc',
    title: 'Scene image',
    detail: 'server scene image',
    filename: 'scene.png',
    createdAt: 1,
  }]);
  assert.match(html, /Scene image/);
  assert.doesNotMatch(html, /imag[^e]/);
});

test('character links preserve server, view, and hash', () => {
  globalThis.location = new URL('http://client.test/player.html');
  assert.equal(
    characterHref('http://client.test/api/', 'character:1'),
    'character.html?server=http%3A%2F%2Fclient.test%2Fapi#character:1',
  );
  assert.equal(
    characterHref('http://client.test/api/', 'character:1', 'chat'),
    'character.html?server=http%3A%2F%2Fclient.test%2Fapi&view=chat#character:1',
  );
  assert.throws(
    () => characterHref('http://evil.test/api/', 'character:1'),
    /page origin/,
  );
});
