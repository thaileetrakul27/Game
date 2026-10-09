import { describe, expect, it } from 'vitest'
import { takeAction } from './actions.ts'
import { advanceTurn, checkPlannedAction, createGameState, createRng, tradeDealsOf } from './index.ts'
import type { CountryId, GameState } from './index.ts'
import { patchPlayer, quietGame, turnAnswering, turnWith } from './testHelpers.ts'

const start = quietGame(1)
const withHalvard = { actionId: 'signTradeDeal', targetId: 'halvard' }
const growthOf = (state: GameState, id: CountryId) => state.countries[id].stats.growth

function wait(state: GameState, turns: number): GameState {
  let next = state
  for (let turn = 0; turn < turns; turn++) next = advanceTurn(next, turnAnswering(next))
  return next
}

describe('trade deals', () => {
  it("raise both partners' growth for 8 turns, then expire and take it away", () => {
    const signed = advanceTurn(start, turnWith(withHalvard))
    expect(growthOf(signed, 'kessara')).toBe(growthOf(start, 'kessara') + 0.5)
    expect(growthOf(signed, 'halvard')).toBe(growthOf(start, 'halvard') + 0.25)
    expect(tradeDealsOf(signed, 'kessara')).toEqual([
      { partnerId: 'halvard', partnerName: 'Halvard Compact', signed: true, growth: 0.5, turnsLeft: 8 },
    ])
    expect(tradeDealsOf(signed, 'halvard')).toEqual([
      { partnerId: 'kessara', partnerName: 'Kessara', signed: false, growth: 0.25, turnsLeft: 8 },
    ])

    // Signed on turn 1, it counts in the briefings of turns 2 to 9 and expires at the end of turn 9.
    const lastTurn = wait(signed, 7)
    expect(lastTurn.turn).toBe(9)
    expect(tradeDealsOf(lastTurn, 'kessara')[0].turnsLeft).toBe(1)
    expect(growthOf(lastTurn, 'kessara')).toBe(growthOf(start, 'kessara') + 0.5)

    const expired = wait(lastTurn, 1)
    expect(tradeDealsOf(expired, 'kessara')).toEqual([])
    expect(growthOf(expired, 'kessara')).toBe(growthOf(start, 'kessara'))
    expect(growthOf(expired, 'halvard')).toBe(growthOf(start, 'halvard'))
    expect(expired.log).toContainEqual({
      turn: 9,
      phase: 'resolution',
      text: 'The trade deal with Halvard Compact expires: growth −0.5%.',
    })
    // The relations it brought stay.
    expect(expired.countries.kessara.relations.halvard).toBe(start.countries.kessara.relations.halvard + 5)
  })

  it('allow only one deal in force between two countries, whoever signed it', () => {
    const refusal = 'Kessara already has a trade deal with Halvard Compact until the end of turn 9'
    expect(checkPlannedAction(start, [withHalvard], withHalvard)).toBe(refusal)
    expect(checkPlannedAction(start, [withHalvard], { actionId: 'signTradeDeal', targetId: 'tsengai' })).toBeNull()

    const signed = advanceTurn(start, turnWith(withHalvard))
    expect(checkPlannedAction(signed, [], withHalvard)).toBe(refusal)
    expect(checkPlannedAction(wait(signed, 8), [], withHalvard)).toBeNull()

    // A deal Valmora signs with Ostrel also stops Ostrel signing one with Valmora.
    const rng = createRng(1)
    const valmoraSigned = takeAction(start, 'valmora', { actionId: 'signTradeDeal', targetId: 'ostrel' }, rng)
    expect(() => takeAction(valmoraSigned, 'ostrel', { actionId: 'signTradeDeal', targetId: 'valmora' }, rng)).toThrow(
      'Ostrel already has a trade deal with Valmora',
    )
  })

  it('take away only the growth they added when growth was near its limit', () => {
    const nearLimit = patchPlayer(start, { stats: { growth: 7.75 } })
    const signed = advanceTurn(nearLimit, turnWith(withHalvard))
    expect(growthOf(signed, 'kessara')).toBe(8)
    expect(tradeDealsOf(signed, 'kessara')[0].growth).toBe(0.25)
    expect(growthOf(wait(signed, 8), 'kessara')).toBe(7.75)
  })

  it('stay one per pair of countries while the rivals trade too', () => {
    let state = createGameState({ seed: 3, settings: { events: false } })
    for (let turn = 0; turn < 12; turn++) {
      state = advanceTurn(state, turnAnswering(state))
      const pairs = state.tradeDeals.map((deal) => [deal.signerId, deal.partnerId].sort().join('|'))
      expect(new Set(pairs).size).toBe(pairs.length)
      for (const deal of state.tradeDeals) {
        expect(deal.endsOnTurn).toBeGreaterThanOrEqual(state.turn)
        expect(deal.endsOnTurn).toBeLessThanOrEqual(state.turn + 7)
      }
    }
    expect(state.tradeDeals.length).toBeGreaterThan(0)
  })
})
