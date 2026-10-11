import { describe, expect, it } from 'vitest'
import { advanceTurn, createGameState } from '../../engine/index.ts'
import type { GameState } from '../../engine/index.ts'
import { stepCount, STEPS, tourPosition } from './steps.ts'
import type { TourContext } from './steps.ts'

const fresh = createGameState({ seed: 4, settings: { variety: false } })

function context(changes: Partial<TourContext> = {}): TourContext {
  return {
    game: fresh,
    planned: [],
    crisisResponse: null,
    offerResponse: null,
    selectedCountryId: null,
    tab: 'map',
    wide: false,
    where: 'briefing',
    ...changes,
  }
}

const index = (id: string) => STEPS.findIndex((step) => step.id === id)
const shown = (from: number, turnsIn: number, changes: Partial<TourContext> = {}) => {
  const position = tourPosition(from, turnsIn, context(changes))
  return position.kind === 'show' ? position.step.id : position.kind
}

function nextTurn(game: GameState): GameState {
  return advanceTurn(game, { crisisResponse: game.crisis?.responseIds[0] ?? null, actions: [] })
}

describe('the tutorial', () => {
  it('starts in the first briefing', () => {
    expect(shown(0, 0)).toBe('welcome')
  })

  it('steps over what the player has already done, and what does not apply', () => {
    // The crisis already answered, and no offer this turn.
    const answered = { crisisResponse: fresh.crisis!.responseIds[0] }
    expect(fresh.offer).toBeNull()
    expect(shown(index('crisis'), 0, answered)).toBe('to-map')
    // A country already picked on the map.
    expect(shown(index('chart'), 0, { where: 'map', selectedCountryId: 'valmora' })).toBe('file')
    expect(shown(index('chart'), 0, { where: 'map', selectedCountryId: 'kessara' })).toBe('chart')
  })

  it('moves past the briefing once the player goes to the map', () => {
    expect(shown(index('treasury'), 0, { where: 'map' })).toBe('readouts')
  })

  it('keeps a map step waiting while the player is back in the briefing', () => {
    expect(tourPosition(index('tray'), 0, context({ where: 'briefing' }))).toEqual({ kind: 'wait', index: index('tray') })
  })

  it('waits for the next turn, then moves on to it', () => {
    expect(tourPosition(index('end-turn') + 1, 0, context())).toEqual({ kind: 'wait', index: index('end-turn') + 1 })
    // Ending the turn moves past End turn, into the second turn's briefing.
    const second = nextTurn(fresh)
    expect(shown(index('end-turn'), 1, { game: second })).toBe('intelligence')
  })

  it('shows the tab steps only with the tab bar, and the panels either way', () => {
    const second = nextTurn(fresh)
    expect(shown(index('intelligence') + 1, 1, { game: second, where: 'map' })).toBe('economy-tab')
    expect(shown(index('intelligence') + 1, 1, { game: second, where: 'map', wide: true })).toBe('economy')
    expect(shown(index('economy-tab'), 1, { game: second, where: 'map', tab: 'economy' })).toBe('economy')
    expect(shown(index('factions'), 1, { game: second, where: 'map', wide: true })).toBe('factions')
  })

  it('finishes after its third turn', () => {
    expect(shown(index('finished'), 2, { where: 'map' })).toBe('finished')
    expect(shown(index('alignment'), 3, { where: 'map' })).toBe('finished')
  })

  it('counts only the steps that apply', () => {
    expect(stepCount(index('welcome'), context())).toEqual({ number: 1, of: 10 })
    expect(stepCount(index('to-map'), context())).toEqual({ number: 4, of: 10 })
    const second = nextTurn(fresh)
    expect(stepCount(index('economy'), context({ game: second, wide: true })).of).toBe(3)
    expect(stepCount(index('economy'), context({ game: second, wide: false })).of).toBe(6)
  })
})
