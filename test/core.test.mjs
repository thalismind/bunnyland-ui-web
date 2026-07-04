import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
  actionIcon,
  characterSheetHref,
  drainNarratedEvents,
  filterActions,
  imageCompletions,
  initTheme,
  latestImageCompletion,
  normalizeBase,
  normalizeTheme,
  parseCharacterProjection,
  queuedCommandLabel,
  registerThemeOption,
  registerThemeOptions,
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
