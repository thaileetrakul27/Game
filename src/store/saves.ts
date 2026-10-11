// Saved games, kept in the browser's local storage. The game state is plain
// data, so a save is the state itself, with the orders and answers planned
// so far that turn and a version number. Every storage call is guarded: a
// browser can refuse storage altogether (a private window, a blocked site),
// and then the game plays on without saving.

import { checkActions, createGameState, GAME_DATA } from '../engine/index.ts'
import type { DemandResponse, GameState, OfferResponse, PlayerAction } from '../engine/index.ts'

/**
 * Bump this whenever a change to GameState or the data would break an older
 * save. Saves from another version show as unusable instead of loading.
 */
export const SAVE_VERSION = 1

/** The autosave, which Continue picks up, and the three slots the player saves to. */
export type SlotId = 'auto' | 'slot-1' | 'slot-2' | 'slot-3'
export const SLOTS: SlotId[] = ['slot-1', 'slot-2', 'slot-3']

/** The orders and answers planned so far in a turn. */
export interface Plan {
  planned: PlayerAction[]
  crisisResponse: string | null
  demandResponse: DemandResponse | null
  offerResponse: OfferResponse | null
}

export interface SaveRecord {
  version: number
  /** When it was saved, in milliseconds since 1970. */
  savedAt: number
  game: GameState
  plan?: Plan
}

export type SaveSlot =
  | { slot: SlotId; state: 'empty' }
  | { slot: SlotId; state: 'unusable' }
  | { slot: SlotId; state: 'ready'; record: SaveRecord }

/** The parts of the Web Storage API the saves use, so tests can pass their own. */
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const PREFIX = 'faultlines:'
const keyFor = (slot: SlotId) => `${PREFIX}save:${slot}`

/** The browser's local storage, or null where there is none or it is blocked. */
export function browserStorage(): SaveStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Save a game to a slot. Returns false if the browser would not store it. */
export function writeSave(
  slot: SlotId,
  game: GameState,
  plan?: Plan,
  storage: SaveStorage | null = browserStorage(),
  now = Date.now(),
): boolean {
  if (!storage) return false
  const record: SaveRecord = { version: SAVE_VERSION, savedAt: now, game, ...(plan ? { plan } : {}) }
  try {
    storage.setItem(keyFor(slot), JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

/** What is in a slot: nothing, a save that can't be loaded, or one ready to load. */
export function readSave(slot: SlotId, storage: SaveStorage | null = browserStorage()): SaveSlot {
  let text: string | null = null
  try {
    text = storage?.getItem(keyFor(slot)) ?? null
  } catch {
    text = null
  }
  if (text === null) return { slot, state: 'empty' }
  try {
    const record = parseRecord(JSON.parse(text))
    return record ? { slot, state: 'ready', record } : { slot, state: 'unusable' }
  } catch {
    return { slot, state: 'unusable' }
  }
}

/** The three slots the player saves to, in order. */
export function listSaves(storage: SaveStorage | null = browserStorage()): SaveSlot[] {
  return SLOTS.map((slot) => readSave(slot, storage))
}

export function deleteSave(slot: SlotId, storage: SaveStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(keyFor(slot))
  } catch {
    // Nothing to do: the browser is refusing storage.
  }
}

/** A game started fresh, to check the shape of saved games against. */
const TEMPLATE = createGameState({ seed: 1, settings: { rivals: false, events: false, variety: false } })
const COUNTRY_IDS = GAME_DATA.countries.map((country) => country.id).sort()

/**
 * A save record if the parsed value is one this version of the game can
 * load, or null. A plan that no longer works with its game is dropped, so
 * the game still loads with a clean turn.
 */
function parseRecord(value: unknown): SaveRecord | null {
  if (!isObject(value) || value.version !== SAVE_VERSION || typeof value.savedAt !== 'number') return null
  const game = value.game
  if (!isObject(game) || !sameShape(game, TEMPLATE)) return null
  const state = game as unknown as GameState
  if (state.status !== 'playing' && state.status !== 'ended') return null
  if (Object.keys(state.countries).sort().join() !== COUNTRY_IDS.join()) return null
  if (!state.countries[state.playerId]) return null
  const record: SaveRecord = { version: SAVE_VERSION, savedAt: value.savedAt, game: state }
  const plan = parsePlan(value.plan, state)
  if (plan) record.plan = plan
  return record
}

function parsePlan(value: unknown, game: GameState): Plan | undefined {
  if (!isObject(value) || !Array.isArray(value.planned)) return undefined
  const planned = value.planned as PlayerAction[]
  try {
    if (checkActions(game, planned) !== null) return undefined
  } catch {
    return undefined
  }
  const crisis = game.crisis?.responseIds.includes(value.crisisResponse as string) ? (value.crisisResponse as string) : null
  const demand = game.demand && (value.demandResponse === 'accept' || value.demandResponse === 'refuse') ? value.demandResponse : null
  const offer = game.offer && (value.offerResponse === 'accept' || value.offerResponse === 'decline') ? value.offerResponse : null
  return { planned, crisisResponse: crisis, demandResponse: demand, offerResponse: offer }
}

/**
 * Every field a fresh game has is there, with the same kind of value. A field
 * that is empty (null) on either side matches anything, as the crisis or the
 * end reason can be.
 */
function sameShape(value: Record<string, unknown>, template: object): boolean {
  return Object.entries(template).every(([key, expected]) => {
    if (!(key in value)) return false
    const actual = value[key]
    if (expected === null || actual === null) return true
    if (Array.isArray(expected)) return Array.isArray(actual)
    return typeof actual === typeof expected
  })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether the player has finished or skipped the tutorial in this browser. */
export function tutorialSeen(storage: SaveStorage | null = browserStorage()): boolean {
  try {
    return storage?.getItem(`${PREFIX}tutorial-done`) === 'yes'
  } catch {
    return false
  }
}

export function markTutorialSeen(storage: SaveStorage | null = browserStorage()): void {
  try {
    storage?.setItem(`${PREFIX}tutorial-done`, 'yes')
  } catch {
    // The tutorial will simply offer itself again next time.
  }
}
