import {
  claimHeaders,
  type ControlClaimLike,
  getPlayerAuth,
  mediaUrl,
  normalizeBase,
  sendJson,
  socketUrl,
} from './api';
import { storageGet, storageRemove, storageSet } from './widgets';

export const IMAGE_AFFORDANCE = {
  REQUEST_EMOJI: '📷',
  ACK_EMOJI: '👀',
  DELIVER_EMOJI: '📸',
  FAIL_EMOJI: '⚠️',
  REQUEST_LABEL: 'Request image',
};

export const KIND_ICON: Record<string, string> = {
  room: '🏠',
  character: '🐰',
  container: '📦',
  item: '✦',
  door: '🚪',
  food: '🍎',
  water: '💧',
  chair: '🪑',
  table: '🪵',
  bed: '🛏',
  art: '🖼',
  window: '🪟',
  other: '⬡',
};

const ACTION_ICON_BY_COMMAND_TYPE: Record<string, string> = {
  look: '👁️',
  inspect: '🔎',
  move: '➡️',
  take: '🤲',
  put: '📥',
  drop: '📤',
  open: '🚪',
  close: '🚪',
  lock: '🔒',
  unlock: '🔓',
  hold: '✊',
  unhold: '🫳',
  wear: '🧥',
  remove: '🧥',
  use: '🛠️',
  write: '✍️',
  sleep: '💤',
  wake: '☀️',
  wait: '⏳',
  'move-sprite': '🎯',
  say: '💬',
  tell: '🗣️',
  'take-note': '📝',
  remember: '🧠',
  forget: '🧹',
  reflect: '💭',
  ignite: '🔥',
  extinguish: '🧯',
  'water-crop': '💧',
  eat: '🍽️',
  drink: '💧',
  craft: '🛠️',
  attack: '⚔️',
  defend: '🛡️',
  'cast-spell': '✨',
  scan: '📡',
  jump: '🚀',
};

const ACTION_ICON_KEYWORDS: [string, string][] = [
  ['move', '➡️'], ['travel', '🧭'], ['enter', '🚪'], ['leave', '🚪'],
  ['open', '🚪'], ['close', '🚪'], ['lock', '🔒'], ['unlock', '🔓'],
  ['search', '🔎'], ['inspect', '🔎'], ['scan', '📡'], ['survey', '🗺️'],
  ['study', '📚'], ['learn', '📚'], ['read', '📖'], ['write', '✍️'],
  ['say', '💬'], ['tell', '🗣️'], ['ask', '❓'], ['remember', '🧠'],
  ['reflect', '💭'], ['note', '📝'], ['take', '🤲'], ['collect', '🤲'],
  ['claim', '🏳️'], ['drop', '📤'], ['put', '📥'], ['store', '📥'],
  ['retrieve', '📤'], ['haul', '📦'], ['cargo', '📦'], ['deliver', '📦'],
  ['buy', '🛒'], ['sell', '🏷️'], ['trade', '🤝'], ['pay', '💰'],
  ['work', '💼'], ['job', '💼'], ['craft', '🛠️'], ['repair', '🛠️'],
  ['build', '🏗️'], ['upgrade', '⬆️'], ['install', '🔧'], ['machine', '⚙️'],
  ['power', '⚡'], ['water', '💧'], ['drink', '💧'], ['plant', '🌱'],
  ['harvest', '🌾'], ['forage', '🌿'], ['egg', '🥚'], ['feed', '🍽️'],
  ['eat', '🍽️'], ['potion', '⚗️'], ['chem', '⚗️'], ['heal', '🩹'],
  ['treat', '🩹'], ['poison', '☠️'], ['radiation', '☢️'], ['sample', '🧪'],
  ['mine', '⛏️'], ['salvage', '🔧'], ['quest', '📜'], ['faction', '🏳️'],
  ['crime', '⚖️'], ['jail', '⚖️'], ['bounty', '⚖️'], ['attack', '⚔️'],
  ['fight', '⚔️'], ['raid', '⚔️'], ['defeat', '⚔️'], ['defend', '🛡️'],
  ['trap', '🪤'], ['sneak', '🥷'], ['hide', '🥷'], ['steal', '🫴'],
  ['spell', '✨'], ['magic', '✨'], ['ritual', '✨'], ['dungeon', '🗝️'],
  ['map', '🗺️'], ['recall', '🌀'], ['rest', '💤'], ['sleep', '💤'],
  ['ship', '🚀'], ['orbit', '🪐'], ['drone', '🛰️'], ['ai', '🤖'],
  ['network', '📡'], ['hack', '💻'], ['exploit', '💻'], ['terminal', '💻'],
  ['credential', '🪪'], ['data', '💾'], ['evidence', '🧾'], ['camera', '📷'],
  ['image', '📷'], ['sensor', '📡'], ['implant', '🦾'], ['call', '📣'],
  ['signal', '📣'], ['command', '📣'], ['assign', '📌'], ['set', '📌'],
  ['configure', '⚙️'], ['resolve', '✅'], ['complete', '✅'], ['accept', '✅'],
  ['decline', '✋'], ['cancel', '🚫'], ['release', '🫳'], ['clean', '🧼'],
  ['clear', '🧹'],
];

export interface CharacterSummary {
  id: string;
  name: string;
  kind: string;
  suspended: boolean;
}

export interface ControlClaim {
  characterId: string;
  controllerId: string;
  generation: number;
  claimId: string;
  claimSecret: string;
  active?: boolean;
}

export interface ActionArgument {
  key: string;
  title?: string;
  kind?: string;
  required?: boolean;
  target_group?: string;
}

export interface ActionView {
  command_type?: string;
  tool_name?: string;
  title?: string;
  lane?: string;
  available?: boolean;
  unavailable_reason?: string;
  cost?: { action?: number; focus?: number };
  arguments?: ActionArgument[];
  icon?: string;
}

export interface TargetOption {
  value: string;
  label: string;
  kind: string;
  icon: string;
}

export interface ProjectionItem {
  id: string;
  label?: string;
  name?: string;
  kind?: string;
  sprite?: Record<string, unknown>;
}

export interface CharacterProjection {
  characterId: string;
  characterName: string;
  worldEpoch: number;
  room: {
    id: string;
    title: string;
    biome: string;
    exits: { id: string; direction: string; label: string; locked: boolean }[];
    entities: unknown[];
  };
  inventory: ProjectionItem[];
  points: Record<string, number>;
  controller: { controller_id?: string; generation?: number } | null;
  portrait?: Record<string, unknown>;
  sheet?: Record<string, unknown>;
  targetGroups: Record<string, TargetOption[]>;
  actions: ActionView[];
}

export interface QueuedProjection {
  characterId: string;
  worldEpoch: number;
  generatedAtUnix?: number | null;
  nextTickAtUnix: number | null;
  tickSeconds?: number | null;
  commands: QueuedCommand[];
}

export interface QueuedCommand {
  command_id?: string;
  command_type?: string;
  lane?: string;
  payload?: Record<string, unknown>;
  cost?: { action?: number; focus?: number };
}

export interface ActivityLine {
  text: string;
  kind: 'event' | 'system' | 'rejection';
  icon?: string;
}

export interface ClaimOptions {
  fallbackController?: string;
  timeoutSeconds?: number;
  label?: string;
  clientIdKey?: string;
  clientIdPrefix?: string;
}

export type PlayerLiveState = 'connecting' | 'live' | 'fallback' | 'closed';

export interface PlayerUpdateFrame {
  type: 'ready' | 'event' | 'invalidate' | 'resync' | 'heartbeat';
  data: Record<string, unknown>;
  world_id?: string;
  protocol_version?: number;
  projection_version?: number;
  world_epoch?: number;
  stream_sequence?: number;
  event_id?: string | null;
  causal_command_id?: string | null;
}

export interface PlayerUpdatesSocket {
  close(code?: number): void;
}

interface WebSocketLike extends PlayerUpdatesSocket {
  onopen: ((event?: unknown) => void) | null;
  onmessage: ((event: { data?: unknown }) => void) | null;
  onclose: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  send(data: string): void;
}

export interface OpenPlayerUpdatesOptions {
  base: string;
  characterId: string;
  control?: ControlClaimLike | null;
  onFrame: (frame: PlayerUpdateFrame) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
  onAnyFrame?: () => void;
  webSocketFactory?: (url: string) => WebSocketLike;
}

export interface PlayerLiveUpdates {
  close(): void;
  getState(): PlayerLiveState;
}

export interface CreatePlayerLiveUpdatesOptions {
  base: string;
  characterId: string;
  control?: ControlClaimLike | null;
  refresh: () => void | Promise<void>;
  onFrame?: (frame: PlayerUpdateFrame) => void;
  onState?: (state: PlayerLiveState) => void;
  webSocketFactory?: (url: string) => WebSocketLike;
  random?: () => number;
}

const PLAYER_FRAME_TYPES = new Set(['ready', 'event', 'invalidate', 'resync', 'heartbeat']);
const FALLBACK_POLL_MS = 2000;
const EVENT_REFRESH_MS = 150;
const HEARTBEAT_TIMEOUT_MS = 70000;
const RECONNECT_SECONDS = [1, 2, 4, 8, 16, 30];
const SEEN_EVENT_LIMIT = 512;

export function openPlayerUpdates(options: OpenPlayerUpdatesOptions): PlayerUpdatesSocket | null {
  const factory = options.webSocketFactory || (
    typeof globalThis.WebSocket === 'function'
      ? (url: string): WebSocketLike => new globalThis.WebSocket(url) as unknown as WebSocketLike
      : null
  );
  if (!factory) return null;
  const path = `/world/character/${encodeURIComponent(options.characterId)}/updates`;
  const socket = factory(socketUrl(options.base, path, getPlayerAuth()));
  socket.onopen = () => {
    socket.send(JSON.stringify({
      type: 'authenticate',
      data: {
        token: getPlayerAuth().startsWith('Bearer ') ? getPlayerAuth().slice(7) : null,
        claim_id: options.control?.claimId || null,
        claim_secret: options.control?.claimSecret || null,
      },
    }));
    options.onOpen?.();
  };
  socket.onmessage = event => {
    options.onAnyFrame?.();
    let frame: unknown;
    try {
      frame = JSON.parse(String(event.data ?? ''));
    } catch (_err) {
      return;
    }
    if (!frame || typeof frame !== 'object') return;
    const candidate = frame as { type?: unknown; data?: unknown };
    if (!PLAYER_FRAME_TYPES.has(String(candidate.type)) || !candidate.data || typeof candidate.data !== 'object') return;
    options.onFrame(candidate as PlayerUpdateFrame);
  };
  socket.onclose = () => options.onClose?.();
  socket.onerror = () => options.onError?.();
  return socket;
}

export function createPlayerLiveUpdates(options: CreatePlayerLiveUpdatesOptions): PlayerLiveUpdates {
  let closed = false;
  let state: PlayerLiveState = 'connecting';
  let socket: PlayerUpdatesSocket | null = null;
  let generation = 0;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshing = false;
  let refreshPending = false;
  let lastStreamSequence = 0;
  const seenEventIds = new Set<string>();
  const seenEventOrder: string[] = [];
  const random = options.random || Math.random;

  const setState = (next: PlayerLiveState): void => {
    if (state === next) return;
    state = next;
    options.onState?.(next);
  };
  const clearHeartbeat = (): void => {
    if (heartbeatTimer != null) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  };
  const runRefresh = async (): Promise<void> => {
    refreshTimer = null;
    if (closed) return;
    if (refreshing) {
      refreshPending = true;
      return;
    }
    refreshing = true;
    try {
      await options.refresh();
    } catch (_err) {
      // A failed fallback request must not stop later polls or live event refreshes.
    } finally {
      refreshing = false;
      if (refreshPending && !closed) {
        refreshPending = false;
        void runRefresh();
      }
    }
  };
  const requestRefresh = (delay = 0): void => {
    if (closed) return;
    if (refreshing) {
      refreshPending = true;
      return;
    }
    if (refreshTimer != null) return;
    refreshTimer = setTimeout(() => { void runRefresh(); }, delay);
  };
  const stopPolling = (): void => {
    if (pollTimer != null) clearInterval(pollTimer);
    pollTimer = null;
  };
  const startPolling = (): void => {
    if (closed || pollTimer != null) return;
    requestRefresh();
    pollTimer = setInterval(() => requestRefresh(), FALLBACK_POLL_MS);
  };
  const scheduleHeartbeat = (token: number): void => {
    clearHeartbeat();
    heartbeatTimer = setTimeout(() => {
      if (closed || token !== generation) return;
      const stale = socket;
      socket = null;
      generation += 1;
      stale?.close();
      disconnected();
    }, HEARTBEAT_TIMEOUT_MS);
  };
  const scheduleReconnect = (): void => {
    if (closed || reconnectTimer != null) return;
    const seconds = RECONNECT_SECONDS[Math.min(reconnectAttempt, RECONNECT_SECONDS.length - 1)];
    reconnectAttempt += 1;
    const delay = seconds * 1000 * (0.8 + random() * 0.4);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };
  const disconnected = (): void => {
    if (closed) return;
    clearHeartbeat();
    setState('fallback');
    startPolling();
    scheduleReconnect();
  };
  const connect = (): void => {
    if (closed) return;
    const token = ++generation;
    lastStreamSequence = 0;
    setState('connecting');
    startPolling();
    const opened = openPlayerUpdates({
      ...options,
      onOpen: () => {
        if (!closed && token === generation) scheduleHeartbeat(token);
      },
      onAnyFrame: () => {
        if (!closed && token === generation) scheduleHeartbeat(token);
      },
      onFrame: frame => {
        if (closed || token !== generation) return;
        const sequence = Number(frame.stream_sequence || 0);
        const sequenceGap = sequence > 0 && lastStreamSequence > 0
          && sequence !== lastStreamSequence + 1;
        if (sequence > 0) lastStreamSequence = sequence;

        const eventId = typeof frame.event_id === 'string' ? frame.event_id : '';
        if (eventId && seenEventIds.has(eventId)) return;
        if (eventId) {
          seenEventIds.add(eventId);
          seenEventOrder.push(eventId);
          if (seenEventOrder.length > SEEN_EVENT_LIMIT) {
            seenEventIds.delete(seenEventOrder.shift() as string);
          }
        }

        options.onFrame?.(frame);
        if (frame.type === 'ready') {
          reconnectAttempt = 0;
          stopPolling();
          setState('live');
        } else if (frame.type === 'resync' || sequenceGap) {
          requestRefresh();
        } else if (frame.type !== 'heartbeat') {
          requestRefresh(EVENT_REFRESH_MS);
        }
      },
      onClose: () => {
        if (closed || token !== generation) return;
        socket = null;
        disconnected();
      },
      onError: () => {
        if (closed || token !== generation) return;
        const failed = socket;
        socket = null;
        generation += 1;
        failed?.close();
        disconnected();
      },
    });
    if (closed || token !== generation) {
      opened?.close();
      return;
    }
    socket = opened;
    if (!opened) disconnected();
  };

  options.onState?.(state);
  connect();
  return {
    close(): void {
      if (closed) return;
      closed = true;
      generation += 1;
      if (reconnectTimer != null) clearTimeout(reconnectTimer);
      if (refreshTimer != null) clearTimeout(refreshTimer);
      reconnectTimer = null;
      refreshTimer = null;
      stopPolling();
      clearHeartbeat();
      const current = socket;
      socket = null;
      current?.close();
      setState('closed');
    },
    getState: () => state,
  };
}

export function randomClientId(prefix = 'web'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function persistentClientId(key = 'bunnyland.clientId', prefix = 'web'): string {
  const existing = storageGet(key);
  if (existing) return existing;
  const next = randomClientId(prefix);
  storageSet(key, next);
  return next;
}

export function storedClaimControl(key: string, characterId: string): ControlClaim | null {
  try {
    const data = JSON.parse(storageGet(claimStorageKey(key, characterId)) || '{}') as Record<string, unknown>;
    if (!data.controllerId || !data.claimId || !data.claimSecret) return null;
    return {
      characterId,
      controllerId: String(data.controllerId),
      generation: Number(data.generation || 0),
      claimId: String(data.claimId),
      claimSecret: String(data.claimSecret),
      active: data.active !== false,
    };
  } catch (_err) {
    return null;
  }
}

export function storeClaimControl(key: string, control: ControlClaim): void {
  if (!key || !control.characterId || !control.claimId || !control.claimSecret) return;
  storageSet(claimStorageKey(key, control.characterId), JSON.stringify({
    controllerId: control.controllerId,
    generation: control.generation,
    claimId: control.claimId,
    claimSecret: control.claimSecret,
    active: control.active !== false,
  }));
}

export function clearClaimControl(key: string, characterId: string): void {
  storageRemove(claimStorageKey(key, characterId));
}

export async function fetchCharacters(base: string): Promise<CharacterSummary[]> {
  const data = await sendJson(base, '/world/characters') as { characters?: unknown[] };
  return parseCharacterList(data).characters;
}

export async function claimCharacter(base: string, characterId: string, storageKey: string, options: ClaimOptions = {}): Promise<ControlClaim> {
  const stored = storedClaimControl(storageKey, characterId);
  const data = await sendJson(base, '/world/controllers/web/claim', {
    method: 'POST',
    headers: claimHeaders(stored),
    body: JSON.stringify({
      character_id: characterId,
      client_id: persistentClientId(options.clientIdKey || `${storageKey}.clientId`, options.clientIdPrefix || 'web'),
      claim_id: stored?.claimId || undefined,
      fallback_controller: options.fallbackController || 'suspend',
      timeout_seconds: options.timeoutSeconds || 1800,
      label: options.label || 'web',
    }),
  }) as Record<string, unknown>;
  const control = controlFromResponse(data, characterId) as ControlClaim;
  storeClaimControl(storageKey, control);
  return control;
}

export async function fetchCharacterProjection(base: string, characterId: string, control: ControlClaim | null = null): Promise<CharacterProjection> {
  const query = control?.claimId ? `?claim_id=${encodeURIComponent(control.claimId)}` : '';
  return parseCharacterProjection(await sendJson(base, `/world/character/${encodeURIComponent(characterId)}${query}`, {
    headers: claimHeaders(control),
  })) as CharacterProjection;
}

export async function fetchQueuedCommands(base: string, characterId: string, control: ControlClaim | null = null): Promise<QueuedProjection> {
  const query = control?.claimId ? `?claim_id=${encodeURIComponent(control.claimId)}` : '';
  return parseQueuedCommands(await sendJson(base, `/world/character/${encodeURIComponent(characterId)}/commands${query}`, {
    headers: claimHeaders(control),
  })) as QueuedProjection;
}

export async function submitCommand(base: string, payload: unknown, control: ControlClaim | null = null): Promise<unknown> {
  return sendJson(base, '/world/commands', {
    method: 'POST',
    headers: claimHeaders(control),
    body: JSON.stringify(payload),
  });
}

export async function cancelQueuedCommand(base: string, characterId: string, commandId: string, control: ControlClaim): Promise<unknown> {
  const params = new URLSearchParams({
    controller_id: control.controllerId,
    controller_generation: String(control.generation),
  });
  if (control.claimId) params.set('claim_id', control.claimId);
  return sendJson(base, `/world/character/${encodeURIComponent(characterId)}/commands/${encodeURIComponent(commandId)}?${params}`, {
    method: 'DELETE',
    headers: claimHeaders(control),
  });
}

export async function fetchRecentEvents(base: string): Promise<unknown[]> {
  const data = await sendJson(base, '/world/events/recent') as { events?: unknown[] };
  return Array.isArray(data.events) ? data.events : [];
}

export async function fetchCharacterRecentEvents(
  base: string,
  characterId: string,
  control: ControlClaimLike | null = null,
): Promise<unknown[]> {
  const query = control?.claimId ? `?claim_id=${encodeURIComponent(control.claimId)}` : '';
  const data = await sendJson(
    base,
    `/world/character/${encodeURIComponent(characterId)}/events/recent${query}`,
    { headers: claimHeaders(control) },
  ) as { events?: unknown[] };
  return Array.isArray(data.events) ? data.events : [];
}

export function parseCharacterList(data: unknown): { epoch: number; characters: CharacterSummary[] } {
  const raw = data as Record<string, unknown>;
  return {
    epoch: Number(raw?.world_epoch || 0),
    characters: ((raw?.characters || []) as unknown[]).map(character => {
      const item = character as Record<string, unknown>;
      return {
        id: String(item.character_id || ''),
        name: String(item.name || item.character_id || ''),
        kind: String(item.kind || 'character'),
        suspended: Boolean(item.suspended),
      };
    }).filter(character => character.id),
  };
}

export function parseCharacterProjection(data: unknown): CharacterProjection | null {
  const raw = data as Record<string, unknown> | null;
  if (!raw || !raw.character_id) return null;
  const room = (raw.room || {}) as Record<string, unknown>;
  const targetGroups: Record<string, TargetOption[]> = {};
  for (const [kind, targets] of Object.entries((raw.target_groups || {}) as Record<string, unknown[]>)) {
    targetGroups[kind] = (targets || []).map(target => {
      const item = target as Record<string, unknown>;
      return {
        value: String(item.id || ''),
        label: String(item.label || item.id || ''),
        kind: String(item.kind || kind),
        icon: targetIcon(String(item.kind || kind)),
      };
    }).filter(target => target.value);
  }
  return {
    characterId: String(raw.character_id || ''),
    characterName: String(raw.character_name || raw.character_id || ''),
    worldEpoch: Number(raw.world_epoch || 0),
    room: {
      id: String(room.id || ''),
      title: String(room.title || room.id || ''),
      biome: String(room.biome || 'unknown'),
      exits: ((room.exits || []) as unknown[]).map(exit => {
        const item = exit as Record<string, unknown>;
        return {
          id: String(item.id || ''),
          direction: String(item.direction || ''),
          label: String(item.label || item.id || ''),
          locked: Boolean(item.locked),
        };
      }).filter(exit => exit.id),
      entities: Array.isArray(room.entities) ? room.entities : [],
    },
    inventory: Array.isArray(raw.inventory) ? raw.inventory as ProjectionItem[] : [],
    points: raw.points as Record<string, number> || {},
    controller: raw.controller as CharacterProjection['controller'] || null,
    portrait: raw.portrait as Record<string, unknown> || {},
    sheet: raw.sheet as Record<string, unknown> || {},
    targetGroups,
    actions: Array.isArray(raw.actions) ? raw.actions as ActionView[] : [],
  };
}

export function parseQueuedCommands(data: unknown): QueuedProjection | null {
  const raw = data as Record<string, unknown> | null;
  if (!raw || !raw.character_id) return null;
  return {
    characterId: String(raw.character_id || ''),
    worldEpoch: Number(raw.world_epoch || 0),
    generatedAtUnix: raw.generated_at_unix == null ? null : Number(raw.generated_at_unix),
    nextTickAtUnix: raw.next_tick_at_unix == null ? null : Number(raw.next_tick_at_unix),
    tickSeconds: raw.tick_seconds == null ? null : Number(raw.tick_seconds),
    commands: Array.isArray(raw.commands) ? raw.commands as QueuedCommand[] : [],
  };
}

export function controlFromResponse(data: unknown, fallbackCharacterId = '', { active = true }: { active?: boolean } = {}): ControlClaim | null {
  const raw = data as Record<string, unknown> | null;
  if (!raw) return null;
  return {
    characterId: String(raw.character_id || fallbackCharacterId),
    controllerId: String(raw.controller_id || ''),
    generation: Number(raw.controller_generation ?? raw.generation ?? 0),
    claimId: String(raw.claim_id || ''),
    claimSecret: String(raw.claim_secret || ''),
    active,
  };
}

export function actionTitle(action: ActionView | QueuedCommand): string {
  return String((action as ActionView).title || (action as ActionView).tool_name || action.command_type || 'Action');
}

export function actionIcon(action: ActionView): string {
  if (action.icon) return String(action.icon);
  const commandType = actionCommandType(action).trim().toLowerCase().replaceAll('_', '-');
  if (ACTION_ICON_BY_COMMAND_TYPE[commandType]) return ACTION_ICON_BY_COMMAND_TYPE[commandType];
  const tokens = commandType.split('-');
  const match = ACTION_ICON_KEYWORDS.find(([token]) => tokens.includes(token));
  return match ? match[1] : '•';
}

export function actionTool(action: ActionView): string {
  return String(action.tool_name || action.command_type || 'action');
}

export function actionCommandType(action: ActionView | QueuedCommand): string {
  return String(action.command_type || ('tool_name' in action ? action.tool_name : '') || 'action');
}

export function actionCost(action: ActionView | QueuedCommand): { action: number; focus: number } {
  const cost = action.cost || {};
  return { action: Number(cost.action || 0), focus: Number(cost.focus || 0) };
}

export function actionLane(action: ActionView | QueuedCommand): string {
  return String(action.lane || 'world');
}

export function actionArguments(action: ActionView): ActionArgument[] {
  return Array.isArray(action.arguments) ? action.arguments : [];
}

export function actionAvailable(action: ActionView): boolean {
  return action.available !== false;
}

export function actionUnavailableReason(action: ActionView): string {
  return actionAvailable(action) ? '' : String(action.unavailable_reason || 'Unavailable right now');
}

export function orderActionsByAvailability(actions: ActionView[]): ActionView[] {
  return (actions || [])
    .map((action, index) => ({ action, index }))
    .sort((a, b) => {
      const aAvailable = actionAvailable(a.action) ? 0 : 1;
      const bAvailable = actionAvailable(b.action) ? 0 : 1;
      return aAvailable - bAvailable || a.index - b.index;
    })
    .map(item => item.action);
}

export function filterActions(actions: ActionView[], query = ''): ActionView[] {
  const q = String(query || '').trim().toLowerCase();
  const rows = q ? (actions || []).filter(action =>
    actionTitle(action).toLowerCase().includes(q) ||
    actionTool(action).toLowerCase().includes(q) ||
    actionCommandType(action).toLowerCase().includes(q) ||
    actionUnavailableReason(action).toLowerCase().includes(q)) : (actions || []);
  return orderActionsByAvailability(rows);
}

export function actionFields(action: ActionView, projection: CharacterProjection): { key: string; label: string; kind: string; required: boolean; candidates: TargetOption[] | null }[] {
  return actionArguments(action).filter(arg => arg.key && (arg.required || arg.target_group)).map(arg => ({
    key: arg.key,
    label: arg.title || arg.key,
    kind: arg.kind || 'string',
    required: Boolean(arg.required),
    candidates: arg.target_group ? projection.targetGroups[arg.target_group] || [] : null,
  }));
}

export function allTargets(projection: CharacterProjection | null): TargetOption[] {
  const targets: TargetOption[] = [];
  const seen = new Set<string>();
  const add = (value: unknown, label: unknown, kind = ''): void => {
    const id = String(value || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    const type = String(kind || 'other');
    targets.push({ value: id, label: String(label || id), kind: type, icon: targetIcon(type) });
  };
  for (const group of Object.values(projection?.targetGroups || {})) {
    for (const item of group || []) add(item.value, item.label, item.kind);
  }
  for (const entity of projection?.room.entities || []) {
    const item = entity as Record<string, unknown>;
    add(item.id, item.name || item.label || item.id, String(item.kind || (item.is_character ? 'character' : 'other')));
  }
  for (const exit of projection?.room.exits || []) add(exit.id, exit.direction || exit.label || exit.id, 'exit');
  for (const item of projection?.inventory || []) add(item.id, item.label || item.name || item.id, item.kind || 'item');
  return targets;
}

export function inventoryEntries(projection: CharacterProjection | null): TargetOption[] {
  return (projection?.inventory || []).map(item => ({
    value: item.id,
    label: item.label || item.name || item.id,
    kind: item.kind || 'item',
    icon: targetIcon(item.kind || 'item'),
  })).filter(item => item.value);
}

export function iconPreference(key: string, defaultValue = true): boolean {
  const value = storageGet(key);
  return value == null ? defaultValue : value !== 'false';
}

export function setIconPreference(key: string, value: boolean): void {
  storageSet(key, value ? 'true' : 'false');
}

export function queuedCountdownSeconds(queueProjection: QueuedProjection | null): number | null {
  const nextTick = queueProjection?.nextTickAtUnix;
  if (nextTick == null) return null;
  return Math.max(0, Math.round(Number(nextTick) - Date.now() / 1000));
}

export function queuedCommandCost(command: QueuedCommand): string {
  const cost = command.cost || {};
  const parts: string[] = [];
  if (cost.action) parts.push(`${cost.action} AP`);
  if (cost.focus) parts.push(`${cost.focus} FP`);
  return parts.length ? parts.join(' + ') : 'free';
}

export function queuedCommandDetail(command: QueuedCommand): string {
  return Object.entries(command.payload || {})
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

export function queuedCommandName(command: QueuedCommand, actions: ActionView[] = []): string {
  const match = actions.find(action => action.command_type === command.command_type);
  return match ? actionTitle(match) : String(command.command_type || 'command').replaceAll('-', ' ');
}

export function queuedCommandLabel(command: QueuedCommand, actions: ActionView[] = []): string {
  const name = queuedCommandName(command, actions);
  const lane = command.lane ? ` [${command.lane}]` : '';
  const details = [queuedCommandCost(command), queuedCommandDetail(command)].filter(Boolean);
  return `${name}${lane}${details.length ? ` - ${details.join(' · ')}` : ''}`;
}

export function imageRequestMessage(result: unknown): string {
  const data = result as Record<string, unknown> | null;
  if (!data || data.ok === false) return `${IMAGE_AFFORDANCE.REQUEST_EMOJI} ${String(data?.reason || 'image request failed')}`;
  if (data.status === 'skipped') return `${IMAGE_AFFORDANCE.DELIVER_EMOJI} image ready`;
  return `${IMAGE_AFFORDANCE.ACK_EMOJI} image requested`;
}

export function imageCompletionFromMessage(message: unknown, base = ''): { url: string; alphaUrl: string; purpose: string; epoch: number; entityId: string } | null {
  const data = messageData(message);
  if (data.event_type !== 'ImageGenerationCompletedEvent') return null;
  const event = (data.event || {}) as Record<string, unknown>;
  if (!event.url) return null;
  return {
    entityId: String(event.entity_id || ''),
    purpose: String(event.purpose || ''),
    url: mediaUrl(base, String(event.url)),
    alphaUrl: event.alpha_url ? mediaUrl(base, String(event.alpha_url)) : '',
    epoch: Number(event.world_epoch || 0),
  };
}

export function imageCompletions(messages: unknown[], base = '', purpose = ''): { url: string; alphaUrl: string; purpose: string; epoch: number; entityId: string }[] {
  return (messages || [])
    .map(message => imageCompletionFromMessage(message, base))
    .filter((image): image is NonNullable<typeof image> => {
      if (!image) return false;
      return !purpose || image.purpose === purpose;
    })
    .sort((a, b) => a.epoch - b.epoch);
}

export function latestImageCompletion(messages: unknown[], baseOrOptions: string | { base?: string; purpose?: string } = '', purpose = ''): ReturnType<typeof imageCompletionFromMessage> {
  const options = typeof baseOrOptions === 'string' ? { base: baseOrOptions, purpose } : baseOrOptions;
  let best: ReturnType<typeof imageCompletionFromMessage> = null;
  for (const image of imageCompletions(messages, options.base || '', options.purpose || '')) {
    if (!best || image.epoch >= best.epoch) best = image;
  }
  return best;
}

export function imageFailureFromMessage(message: unknown): { entityId: string; purpose: string; reason: string; epoch: number } | null {
  const data = messageData(message);
  if (data.event_type !== 'ImageGenerationFailedEvent') return null;
  const event = (data.event || {}) as Record<string, unknown>;
  return {
    entityId: String(event.entity_id || ''),
    purpose: String(event.purpose || ''),
    reason: String(event.reason || 'image generation failed'),
    epoch: Number(event.world_epoch || 0),
  };
}

export function latestImageFailure(messages: unknown[], purposeOrOptions: string | { purpose?: string } = ''): ReturnType<typeof imageFailureFromMessage> {
  const purpose = typeof purposeOrOptions === 'string' ? purposeOrOptions : purposeOrOptions.purpose || '';
  let best: ReturnType<typeof imageFailureFromMessage> = null;
  for (const message of messages || []) {
    const failure = imageFailureFromMessage(message);
    if (!failure || (purpose && failure.purpose !== purpose)) continue;
    if (!best || failure.epoch >= best.epoch) best = failure;
  }
  return best;
}

export function characterSheetHref(apiBase: string, characterId: string, page = 'character-sheet.html'): string {
  const url = new URL(page, location.href);
  const normalized = normalizeBase(apiBase);
  if (normalized) url.searchParams.set('server', normalized);
  else url.searchParams.delete('server');
  url.hash = characterId || '';
  if (url.origin !== location.origin) return url.toString();
  return `${url.pathname.split('/').pop()}${url.search}${url.hash}`;
}

export function portraitStatusMessage(projection: CharacterProjection | null, requestState = ''): string {
  if (projection?.portrait?.url) return 'Portrait ready.';
  if (requestState === 'requesting') return 'Requesting portrait...';
  if (requestState === 'queued') return 'Portrait generation queued.';
  if (requestState === 'failed') return 'Portrait generation unavailable.';
  return 'Portrait pending.';
}

export function drainNarratedEvents(messages: unknown[], {
  seenIds = new Set<string>(),
  playerId = '',
  roomOf = () => null,
  nameFor = () => null,
}: {
  seenIds?: Set<string>;
  playerId?: string;
  roomOf?: (id: string) => string | null;
  nameFor?: (id: string) => string | null;
} = {}): { lines: ActivityLine[]; seenIds: Set<string> } {
  const current = new Set(seenIds);
  const lines: ActivityLine[] = [];
  for (const message of messages || []) {
    const data = messageData(message);
    const event = (data.event || {}) as Record<string, unknown>;
    const eventId = String(event.event_id || '');
    if (!eventId) continue;
    current.add(eventId);
    if (seenIds.has(eventId)) continue;
    const eventType = String(data.event_type || 'Event');
    if (UNNARRATED_EVENT_TYPES.has(eventType)) continue;
    const own = playerId && event.actor_id === playerId;
    if (own || perceivesEvent(event, { playerId, roomOf })) {
      lines.push(renderEventLine(data, { playerId, nameFor }));
    }
  }
  return { lines, seenIds: current };
}

const UNNARRATED_EVENT_TYPES = new Set([
  'CommandSubmittedEvent', 'CommandAcceptedEvent', 'CommandQueuedEvent',
  'CommandCancelledEvent', 'CommandExecutedEvent', 'CommandExpiredEvent',
  'ActionPointsChangedEvent', 'FocusPointsChangedEvent', 'EncumbranceChangedEvent',
  'PainChangedEvent', 'BleedingChangedEvent', 'AttentionShiftedEvent', 'AffectChangedEvent',
  'EntitySeenEvent', 'RoomQualityUpdatedEvent', 'HungerChangedEvent',
  'ThirstChangedEvent', 'DailyNeedChangedEvent', 'SkillXPChangedEvent',
]);

const SYSTEM_EVENT_TYPES = new Set(['ControllerChangedEvent', 'WorldPauseStatusChangedEvent']);

const EVENT_ICON_BY_TYPE: Record<string, string> = {
  ActorMovedEvent: '➡️',
  RoomLookedEvent: '👁️',
  CommandRejectedEvent: '⚠️',
  ControllerChangedEvent: '🎮',
  WorldPauseStatusChangedEvent: '⏸️',
  CharacterClaimedEvent: '🎮',
};

const EVENT_BASE_KEYS = new Set([
  'event_id', 'world_epoch', 'created_at', 'visibility', 'actor_id', 'room_id',
  'target_ids', 'causation_id', 'correlation_id', 'arrival_summary',
]);

function renderEventLine(data: Record<string, unknown>, { playerId = '', nameFor = () => null }: { playerId?: string; nameFor?: (id: string) => string | null } = {}): ActivityLine {
  const event = (data.event || {}) as Record<string, unknown>;
  const eventType = String(data.event_type || 'Event');
  if (eventType === 'ActorMovedEvent' && playerId && event.actor_id === playerId && event.arrival_summary) {
    return { text: String(event.arrival_summary), kind: 'event', icon: eventIcon(eventType, event) };
  }
  if (eventType === 'RoomLookedEvent' && event.summary) {
    return { text: String(event.summary), kind: 'event', icon: eventIcon(eventType, event) };
  }
  const actor = event.actor_id ? nameFor(String(event.actor_id)) : null;
  const details: string[] = [];
  for (const [key, value] of Object.entries(event)) {
    if (EVENT_BASE_KEYS.has(key) || value == null || value === '' ||
        (Array.isArray(value) && !value.length)) continue;
    if (key.endsWith('_ids') && Array.isArray(value)) {
      const names = value.map(item => nameFor(String(item))).filter(Boolean);
      if (names.length) details.push(names.join(', '));
    } else if (key.endsWith('_id')) {
      const name = nameFor(String(value));
      if (name) details.push(name);
    } else if (key === 'facts' && Array.isArray(value)) {
      details.push(...value.flatMap(fact => {
        if (!fact || typeof fact !== 'object' || !('text' in fact)) return [];
        const text = String(fact.text || '').trim();
        return text ? [text] : [];
      }));
    } else {
      details.push(`${key.replaceAll('_', ' ')} ${String(value)}`);
    }
  }
  return {
    text: `${actor ? `${actor}: ` : ''}${humanizeEventType(eventType)}${details.length ? ` - ${details.join('; ')}` : ''}`,
    kind: eventType === 'CommandRejectedEvent' ? 'rejection' : SYSTEM_EVENT_TYPES.has(eventType) ? 'system' : 'event',
    icon: eventIcon(eventType, event),
  };
}

function eventIcon(eventType: string, event: Record<string, unknown> = {}): string {
  if (eventType === 'CommandRejectedEvent' && event.command_type) {
    return actionIcon({ command_type: String(event.command_type) });
  }
  return EVENT_ICON_BY_TYPE[eventType] || '•';
}

function humanizeEventType(eventType: string): string {
  const name = String(eventType || 'Event').replace(/Event$/, '');
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
}

function perceivesEvent(event: Record<string, unknown>, { playerId = '', roomOf = () => null }: { playerId?: string; roomOf?: (id: string) => string | null } = {}): boolean {
  const visibility = event.visibility;
  if (visibility === 'public') return true;
  if (visibility === 'room') return Boolean(playerId) && event.room_id === roomOf(playerId);
  if (visibility === 'directed') {
    return Boolean(playerId) && (
      event.actor_id === playerId || ((event.target_ids || []) as unknown[]).includes(playerId)
    );
  }
  if (visibility === 'private') return Boolean(playerId) && event.actor_id === playerId;
  return false;
}

function messageData(message: unknown): Record<string, unknown> {
  const raw = message as Record<string, unknown> | null;
  return (raw?.data || raw || {}) as Record<string, unknown>;
}

function targetIcon(kind: string): string {
  if (kind === 'exit') return KIND_ICON.door;
  if (kind === 'object') return KIND_ICON.other;
  return KIND_ICON[kind] || KIND_ICON.other;
}

function claimStorageKey(key: string, characterId: string): string {
  return `${key}.claim.${characterId}`;
}
