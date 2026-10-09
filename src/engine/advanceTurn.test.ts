import { describe, expect, it } from 'vitest'
import { advanceTurn, createGameState } from './index.ts'
import type { GameState } from './index.ts'

function playFullGame(seed: number): GameState {
  let state = createGameState({ seed })
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

  it("runs each turn's briefing before the player chooses", () => {
    const start = createGameState({ seed: 1 })
    expect(start.log.length).toBeGreaterThan(0)
    expect(start.log.every((entry) => entry.turn === 1 && entry.phase === 'briefing')).toBe(true)

    const next = advanceTurn(start, { crisisResponse: null, actions: [] })
    expect(next.log.at(-1)).toMatchObject({ turn: 2, phase: 'briefing' })

    // No briefing for a turn after the last one.
    expect(playFullGame(1).log.at(-1)).toMatchObject({ turn: 40, phase: 'resolution' })
  })

  describe('crisis responses', () => {
    const noCrisis = createGameState({ seed: 1 })
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
