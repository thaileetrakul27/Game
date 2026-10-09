import { describe, expect, it } from 'vitest'
import { advanceTurn, createGameState, debtInterest, GAME_DATA, incomeBreakdown } from './index.ts'
import type { EconomyRules, GameData } from './index.ts'
import { patchPlayer, turnWith } from './testHelpers.ts'

// Fixed rules, so these tests check the formulas rather than the current balance numbers.
const rules: EconomyRules = { interestRatePerTurn: 0.02, growthMin: -5, growthMax: 8 }
const data: GameData = { ...GAME_DATA, economy: rules, straitControl: { ...GAME_DATA.straitControl, tollPerTradeShare: 0.75 } }

describe('income', () => {
  it('is base output times growth, plus tolls, minus debt interest and upkeep', () => {
    // The Kessara Strait carries 40% of trade, so at 0.75 a share it pays 30 with both powers open.
    const state = patchPlayer(createGameState({ seed: 1 }), {
      stats: { growth: 5, debt: 500 },
      economy: { baseOutput: 200, straitTolls: 0, upkeep: 150 },
    })
    expect(incomeBreakdown(state, 'kessara', data)).toEqual({
      output: 210,
      tradeLoss: 0,
      tolls: 30,
      interest: 10,
      upkeep: 150,
      net: 80,
    })
  })

  it('shrinks output when growth is negative', () => {
    const state = patchPlayer(createGameState({ seed: 1 }), { stats: { growth: -5 }, economy: { baseOutput: 200 } })
    expect(incomeBreakdown(state, 'kessara', data).output).toBe(190)
  })

  it("arrives in every country's treasury at the briefing", () => {
    // Income doesn't depend on the treasury, so the opening state gives the same figures.
    const start = createGameState({ seed: 1 })
    for (const country of GAME_DATA.countries) {
      const expected = country.stats.treasury + incomeBreakdown(start, country.id).net
      expect(start.countries[country.id].stats.treasury).toBe(expected)
    }
  })
})

describe('debt interest', () => {
  it("charges the turn's interest rate on the debt, rounded to whole money", () => {
    expect(debtInterest(500, rules)).toBe(10)
    expect(debtInterest(125, rules)).toBe(3)
    expect(debtInterest(0, rules)).toBe(0)
  })

  it('drains the treasury each turn without paying down the debt', () => {
    const start = createGameState({ seed: 1 })
    const debtFree = patchPlayer(start, { stats: { debt: 0 } })
    const indebted = patchPlayer(start, { stats: { debt: 1000 } })

    const afterDebtFree = advanceTurn(debtFree, turnWith()).countries.kessara.stats
    const afterIndebted = advanceTurn(indebted, turnWith()).countries.kessara.stats
    const expectedInterest = Math.round(1000 * GAME_DATA.economy.interestRatePerTurn)
    expect(expectedInterest).toBeGreaterThan(0)
    expect(afterDebtFree.treasury - afterIndebted.treasury).toBe(expectedInterest)
    expect(afterIndebted.debt).toBe(1000)
  })
})

describe('default', () => {
  it('ends the game after two turns in a row with the treasury below zero', () => {
    const broke = patchPlayer(createGameState({ seed: 1 }), {
      stats: { treasury: -500, debt: 0 },
      economy: { baseOutput: 0, straitTolls: 0, upkeep: 10 },
    })

    const afterOne = advanceTurn(broke, turnWith())
    expect(afterOne.status).toBe('playing')
    expect(afterOne.deficitTurns).toBe(1)

    const afterTwo = advanceTurn(afterOne, turnWith())
    expect(afterTwo.status).toBe('ended')
    expect(afterTwo.endReason).toBe('default')
    expect(() => advanceTurn(afterTwo, turnWith())).toThrow()
  })

  it('forgives a single turn below zero if income recovers', () => {
    const shortOfCash = patchPlayer(createGameState({ seed: 1 }), {
      stats: { treasury: -10, debt: 0 },
      economy: { baseOutput: 100, straitTolls: 0, upkeep: 0 },
    })

    const afterOne = advanceTurn(shortOfCash, turnWith())
    expect(afterOne.deficitTurns).toBe(1)
    expect(afterOne.countries.kessara.stats.treasury).toBeGreaterThan(0)

    const afterTwo = advanceTurn(afterOne, turnWith())
    expect(afterTwo.status).toBe('playing')
    expect(afterTwo.deficitTurns).toBe(0)
  })

  it('counts spending during the turn', () => {
    const tight = patchPlayer(createGameState({ seed: 1 }), {
      stats: { treasury: 1, debt: 0 },
      economy: { baseOutput: 0, straitTolls: 0, upkeep: 0 },
    })
    // Military spending costs treasury, which takes it below zero by the end of the turn.
    const spent = advanceTurn(tight, turnWith({ actionId: 'militarySpending' }))
    expect(spent.deficitTurns).toBe(1)
  })
})
