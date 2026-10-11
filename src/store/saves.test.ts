import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { advanceTurn, createGameState } from '../engine/index.ts'
import type { GameState } from '../engine/index.ts'
import { currentPlan, useGameStore } from './gameStore.ts'
import {
  deleteSave,
  listSaves,
  markTutorialSeen,
  readSave,
  SAVE_VERSION,
  tutorialSeen,
  writeSave,
} from './saves.ts'
import type { SaveStorage } from './saves.ts'

/** Local storage kept in memory, as a browser keeps it. */
function memoryStorage(): SaveStorage & { items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
  }
}

/** Storage that refuses everything, as a browser can in a private window. */
const blocked: SaveStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

/** A game a few turns in, with every crisis answered. */
function playedGame(turns: number): GameState {
  let game = createGameState({ seed: 7 })
  for (let turn = 0; turn < turns; turn++) {
    game = advanceTurn(game, {
      crisisResponse: game.crisis?.responseIds[0] ?? null,
      demandResponse: game.demand ? 'refuse' : null,
      offerResponse: game.offer ? 'decline' : null,
      actions: [],
    })
  }
  return game
}

describe('saved games', () => {
  it('reads back exactly the game that was saved, through JSON', () => {
    const storage = memoryStorage()
    const game = playedGame(5)
    expect(writeSave('slot-2', game, undefined, storage, 1_000)).toBe(true)
    const slot = readSave('slot-2', storage)
    expect(slot.state).toBe('ready')
    if (slot.state !== 'ready') return
    expect(slot.record.version).toBe(SAVE_VERSION)
    expect(slot.record.savedAt).toBe(1_000)
    expect(slot.record.game).toEqual(game)
    // And the loaded game plays on exactly as the original would.
    const next = { crisisResponse: game.crisis?.responseIds[0] ?? null, actions: [] }
    expect(advanceTurn(slot.record.game, next)).toEqual(advanceTurn(game, next))
  })

  it('keeps the orders and answers planned that turn', () => {
    const storage = memoryStorage()
    const game = createGameState({ seed: 3 })
    const plan = {
      planned: [{ actionId: 'militarySpending' }, { actionId: 'diplomaticSummit', targetId: 'valmora' }],
      crisisResponse: game.crisis!.responseIds[1],
      demandResponse: null,
      offerResponse: null,
    }
    writeSave('slot-1', game, plan, storage)
    const slot = readSave('slot-1', storage)
    expect(slot.state === 'ready' && slot.record.plan).toEqual(plan)
  })

  it('drops a plan that no longer works with its game, and still loads the game', () => {
    const storage = memoryStorage()
    const game = createGameState({ seed: 3 })
    const plan = {
      planned: [{ actionId: 'domesticReform' }, { actionId: 'domesticReform' }, { actionId: 'domesticReform' }],
      crisisResponse: 'not-a-response',
      demandResponse: null,
      offerResponse: null,
    }
    writeSave('slot-1', game, plan, storage)
    const slot = readSave('slot-1', storage)
    expect(slot.state).toBe('ready')
    expect(slot.state === 'ready' && slot.record.plan).toBeUndefined()
  })

  it('lists the three slots, empty until saved to', () => {
    const storage = memoryStorage()
    expect(listSaves(storage).map((slot) => slot.state)).toEqual(['empty', 'empty', 'empty'])
    writeSave('slot-3', createGameState({ seed: 1 }), undefined, storage)
    writeSave('auto', createGameState({ seed: 2 }), undefined, storage)
    expect(listSaves(storage).map((slot) => [slot.slot, slot.state])).toEqual([
      ['slot-1', 'empty'],
      ['slot-2', 'empty'],
      ['slot-3', 'ready'],
    ])
    deleteSave('slot-3', storage)
    expect(readSave('slot-3', storage).state).toBe('empty')
  })

  it('marks a save from another version, or one that is damaged, as unusable', () => {
    const storage = memoryStorage()
    const game = createGameState({ seed: 1 })
    const put = (record: unknown) => storage.setItem('faultlines:save:slot-1', JSON.stringify(record))

    put({ version: SAVE_VERSION + 1, savedAt: 1, game })
    expect(readSave('slot-1', storage).state).toBe('unusable')

    const { factions: _factions, ...missingField } = game
    put({ version: SAVE_VERSION, savedAt: 1, game: missingField })
    expect(readSave('slot-1', storage).state).toBe('unusable')

    put({ version: SAVE_VERSION, savedAt: 1, game: { ...game, turn: 'three' } })
    expect(readSave('slot-1', storage).state).toBe('unusable')

    const { valmora: _valmora, ...fewerCountries } = game.countries
    put({ version: SAVE_VERSION, savedAt: 1, game: { ...game, countries: fewerCountries } })
    expect(readSave('slot-1', storage).state).toBe('unusable')

    storage.setItem('faultlines:save:slot-1', '{not json')
    expect(readSave('slot-1', storage).state).toBe('unusable')

    put({ version: SAVE_VERSION, savedAt: 1, game })
    expect(readSave('slot-1', storage).state).toBe('ready')
  })

  it('plays on without saving when the browser refuses storage', () => {
    const game = createGameState({ seed: 1 })
    expect(writeSave('slot-1', game, undefined, blocked)).toBe(false)
    expect(writeSave('slot-1', game, undefined, null)).toBe(false)
    expect(readSave('slot-1', blocked).state).toBe('empty')
    expect(listSaves(null).map((slot) => slot.state)).toEqual(['empty', 'empty', 'empty'])
    expect(() => deleteSave('slot-1', blocked)).not.toThrow()
    expect(tutorialSeen(blocked)).toBe(false)
    expect(() => markTutorialSeen(blocked)).not.toThrow()
  })

  it('remembers that the tutorial has been seen', () => {
    const storage = memoryStorage()
    expect(tutorialSeen(storage)).toBe(false)
    markTutorialSeen(storage)
    expect(tutorialSeen(storage)).toBe(true)
  })
})

describe('the store and saves', () => {
  let storage: ReturnType<typeof memoryStorage>
  const store = () => useGameStore.getState()

  beforeEach(() => {
    storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves itself when a game starts and at the start of every turn', () => {
    store().newGame(11)
    const first = readSave('auto', storage)
    expect(first.state === 'ready' && first.record.game).toEqual(store().game)

    store().chooseCrisisResponse(store().game.crisis!.responseIds[0])
    store().planAction({ actionId: 'militarySpending' })
    // Planning orders doesn't save; ending the turn does.
    expect(readSave('auto', storage)).toEqual(first)
    store().endTurn()
    const second = readSave('auto', storage)
    expect(second.state === 'ready' && second.record.game.turn).toBe(2)
  })

  it('loads a saved game with its plan, ready to carry on', () => {
    store().newGame(12)
    store().chooseCrisisResponse(store().game.crisis!.responseIds[0])
    store().planAction({ actionId: 'militarySpending' })
    writeSave('slot-1', store().game, currentPlan(store()), storage)
    const saved = store().game

    store().newGame(13)
    store().selectCountry('valmora')
    const slot = readSave('slot-1', storage)
    if (slot.state !== 'ready') throw new Error('expected a save')
    store().loadGame(slot.record.game, slot.record.plan)

    expect(store().game).toEqual(saved)
    expect(store().planned).toEqual([{ actionId: 'militarySpending' }])
    expect(store().crisisResponse).toBe(saved.crisis!.responseIds[0])
    expect(store().selectedCountryId).toBeNull()
    // Loading makes it the game Continue picks up.
    const auto = readSave('auto', storage)
    expect(auto.state === 'ready' && auto.record.game).toEqual(saved)

    store().loadGame(slot.record.game)
    expect(store().planned).toEqual([])
    expect(store().crisisResponse).toBeNull()
  })
})
