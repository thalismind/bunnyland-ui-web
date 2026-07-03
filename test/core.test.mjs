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
  latestImageCompletion,
  normalizeBase,
  normalizeTheme,
  parseCharacterProjection,
  queuedCommandLabel,
  socketUrl,
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

test('browser asset globals stay compatible with static clients', () => {
  const context = {
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    console,
    document: {
      documentElement: { classList: { add() {}, remove() {}, [Symbol.iterator]: function* iterator() {} }, dataset: {} },
      getElementById: () => null,
    },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    globalThis: null,
    history: { replaceState: () => {} },
    location: {
      href: 'http://example.test/index.html',
      origin: 'http://example.test',
      pathname: '/index.html',
      search: '',
    },
    localStorage: { getItem: () => null, setItem: () => {} },
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
