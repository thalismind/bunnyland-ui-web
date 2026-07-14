import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
  actionIcon,
  characterSheetHref,
  claimHeaders,
  createPlayerLiveUpdates,
  drainNarratedEvents,
  filterActions,
  getPlayerAuth,
  imageCompletions,
  initTheme,
  latestImageCompletion,
  login,
  mergePlayerHeaders,
  normalizeBase,
  normalizeTheme,
  openPlayerUpdates,
  parseCharacterProjection,
  queuedCommandLabel,
  registerThemeOption,
  registerThemeOptions,
  sendJson,
  setPlayerAuth,
  socketUrl,
  bindThemeSelect,
  THEME_KEY,
  themeFromSearch,
  themeOptions,
} from '../dist/index.js';
import { renderGalleryItems } from '../dist/player-widgets.js';

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('API and theme helpers normalize shared client state', () => {
  assert.equal(normalizeBase(' http://server.test/api/ '), 'http://server.test/api');
  assert.equal(socketUrl('https://server.test/api/', '/world/updates'), 'wss://server.test/api/world/updates');
  assert.equal(normalizeTheme('dark'), 'purple-blue-dark');
  assert.equal(normalizeTheme('nope'), 'purple-blue-dark');
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
      /different origin/,
    );
    assert.equal(fetched, false);
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
    control: { claimId: 'claim-1', claimSecret: 'top-secret' },
    webSocketFactory: url => (socket = new FakePlayerSocket(url)),
    onFrame: frame => frames.push(frame),
  });

  socket.open();
  assert.equal(opened, socket);
  assert.equal(socket.url, 'wss://server.test/api/world/character/character%3A1/updates');
  assert.doesNotMatch(socket.url, /claim-1|top-secret/);
  assert.deepEqual(JSON.parse(socket.sent[0]), {
    type: 'authenticate',
    data: { token: null, claim_id: 'claim-1', claim_secret: 'top-secret' },
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

test('live coordinator coalesces bursts and serializes a follow-up refresh', async () => {
  let socket;
  let releaseFirst;
  const calls = [];
  const live = createPlayerLiveUpdates({
    base: 'http://server.test',
    characterId: 'character:1',
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

    const result = await sendJson('http://server.test/api/', '/world/character/c1', {
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
    assert.equal(select.value, 'earth-light');
    assert.equal(globalThis.document.documentElement.dataset.theme, 'earth-light');
    assert.equal(classes.has('bl-theme-earth-light'), true);
    registerThemeOption({ value: 'server-dusk', label: 'Server Dusk' });
    assert.match(select.innerHTML, /server-dusk/);
    select.value = 'anime-dark';
    listeners.get('change')();
    assert.equal(values.get(THEME_KEY), 'anime-dark');
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
        event: { event_id: 'image:1', world_epoch: 4, purpose: 'event', entity_id: 'room:1', url: '/media/scene.png' },
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
    [{ entityId: 'room:1', purpose: 'event', url: 'http://server.test/api/media/scene.png', alphaUrl: '', epoch: 4 }],
  );
  assert.equal(latestImageCompletion(messages, { base: 'http://server.test/api', purpose: 'event' }).url, 'http://server.test/api/media/scene.png');

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
  assert.equal(typeof context.BunnylandApi.normalizeBase, 'function');
  assert.equal(typeof context.BunnylandPlay.filterActions, 'function');
  assert.equal(typeof context.BunnylandPlay.createPlayerLiveUpdates, 'function');
  await context.BunnylandUI.loadConfig();
  assert.equal(context.BunnylandUI.currentTheme(), 'asset-linked');
  assert.equal(classes.has('bl-theme-asset-linked'), true);
  assert.equal(values.get(THEME_KEY), 'asset-linked');
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

test('character sheet links preserve server and hash', () => {
  globalThis.location = new URL('http://client.test/player.html');
  assert.equal(
    characterSheetHref('http://server.test/api/', 'character:1'),
    'character-sheet.html?server=http%3A%2F%2Fserver.test%2Fapi#character:1',
  );
});
