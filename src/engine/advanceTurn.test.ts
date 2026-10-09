import { describe, expect, it } from 'vitest'
import { advanceTurn, createGameState } from './index.ts'
import type { Country, GameState, Personality } from './index.ts'

// Minimal test countries. The real country data arrives in src/data in milestone 2.
function country(id: string, name: string, personality: Personality | null): Country {
  return {
    id,
    name,
    personality,
    stats: {
      treasury: 100,
      debt: 0,
      growth: 2,
      legitimacy: 60,
      militaryLoyalty: 60,
      defence: 40,
      alignment: 0,
    },
    relations: {},
  }
}

const countries = [
  country('kessara', 'Kessara', null),
  country('halvard', 'Halvard Compact', 'merchant'),
  country('tsengai', 'Tsengai Republic', 'hardliner'),
]

function playFullGame(seed: number): GameState {
  let state = createGameState({ seed, playerId: 'kessara', countries })
  while (state.status === 'playing') {
    state = advanceTurn(state, {
      crisisResponse: null,
      actions: [{ actionId: 'diplomaticSummit', targetId: 'halvard' }],
    })
  }
  return state
}

describe('advanceTurn', () => {
  it('gives the same result from the same seed', () => {
    const first = playFullGame(42)
    const second = playFullGame(42)
    expect(first.turn).toBe(40)
    expect(second).toEqual(first)

    // A different seed must change the game, or the check above proves nothing.
    expect(playFullGame(7).countries).not.toEqual(first.countries)
  })

  describe('crisis responses', () => {
    const noCrisis = createGameState({ seed: 1, playerId: 'kessara', countries })
    // The event deck arrives in milestone 6, so place a card by hand.
    const withCrisis: GameState = {
      ...noCrisis,
      crisis: { cardId: 'naval-standoff', responseIds: ['back-down', 'hold-firm'] },
    }

    it("accepts only one of the pending card's responses", () => {
      expect(() => advanceTurn(withCrisis, { crisisResponse: 'hold-firm', actions: [] })).not.toThrow()
      expect(() => advanceTurn(withCrisis, { crisisResponse: null, actions: [] })).toThrow()
      expect(() => advanceTurn(withCrisis, { crisisResponse: 'surrender', actions: [] })).toThrow()
    })

    it('rejects a response when there is no crisis', () => {
      expect(() => advanceTurn(noCrisis, { crisisResponse: 'hold-firm', actions: [] })).toThrow()
    })
  })
})
