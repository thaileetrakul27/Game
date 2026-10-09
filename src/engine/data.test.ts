import { describe, expect, it } from 'vitest'
import { GAME_DATA, validateGameData } from './index.ts'
import type { ActionDef } from './index.ts'

describe('game data', () => {
  it('has the 7 countries from DESIGN.md', () => {
    const summary = Object.fromEntries(
      GAME_DATA.countries.map((country) => [country.id, [country.kind, country.personality]]),
    )
    expect(summary).toEqual({
      kessara: ['minor', null],
      halvard: ['greatPower', 'merchant'],
      tsengai: ['greatPower', 'hardliner'],
      valmora: ['minor', 'opportunist'],
      ostrel: ['minor', 'hardliner'],
      sabu: ['minor', 'merchant'],
      daranth: ['minor', 'hardliner'],
    })
  })

  it('has the 3 factions with the starting satisfaction in DESIGN.md', () => {
    const factions = Object.fromEntries(GAME_DATA.factions.factions.map((faction) => [faction.id, faction.start]))
    expect(factions).toEqual({ generals: 45, business: 55, reformers: 40 })
    expect(GAME_DATA.factions.unrestBelow).toBe(15)
  })

  it('has the hedging thresholds in DESIGN.md', () => {
    const { driftPerTurn, tradeCutPast, demandPast, demandAfterTurns, brokerWithin, brokerEveryTurns } = GAME_DATA.hedging
    expect({ driftPerTurn, tradeCutPast, demandPast, demandAfterTurns, brokerWithin, brokerEveryTurns }).toEqual({
      driftPerTurn: 2,
      tradeCutPast: 40,
      demandPast: 70,
      demandAfterTurns: 4,
      brokerWithin: 20,
      brokerEveryTurns: 3,
    })
    expect(GAME_DATA.demands.map((demand) => demand.id)).toEqual(['navalBase', 'disputedIsland', 'expelCompanies'])
  })

  it('has the 9 actions at the costs in DESIGN.md', () => {
    const costs = Object.fromEntries(GAME_DATA.actions.map((action) => [action.id, action.cost]))
    expect(costs).toEqual({
      signTradeDeal: 1,
      acceptLoan: 1,
      repayDebt: 1,
      buildInfrastructure: 2,
      diplomaticSummit: 1,
      domesticReform: 2,
      militarySpending: 1,
      straitAccess: 1,
      covertOperation: 2,
    })
  })

  it('has the 3 straits, with the Kessara Strait carrying 40% of trade', () => {
    expect(GAME_DATA.straits.map((strait) => [strait.id, strait.tradeShare])).toEqual([
      ['kessaraStrait', 40],
      ['sabuPassage', 35],
      ['valmoraChannel', 25],
    ])
    const tooMuch = GAME_DATA.straits.map((strait) => ({ ...strait, tradeShare: 50 }))
    expect(() => validateGameData({ ...GAME_DATA, straits: tooMuch })).toThrow(/more than 100%/)
  })

  it('rejects content with unknown names or broken references', () => {
    const withAction = (action: ActionDef) => () =>
      validateGameData({ ...GAME_DATA, actions: [...GAME_DATA.actions, action] })
    const pleasesAndAnnoys: ActionDef['effects'] = [
      { kind: 'faction', faction: 'business', amount: 1 },
      { kind: 'faction', faction: 'generals', amount: -1 },
    ]
    const base: ActionDef = { id: 'test', name: 'Test', cost: 1, description: '', target: 'none', effects: pleasesAndAnnoys }

    expect(withAction(base)).not.toThrow()
    expect(withAction({ ...base, effects: [] })).toThrow(/must please a faction/)
    const withEffect = (effect: ActionDef['effects'][number]) => withAction({ ...base, effects: [...pleasesAndAnnoys, effect] })
    expect(withEffect({ kind: 'stat', who: 'self', stat: 'wealth' as never, amount: 1 })).toThrow(/unknown stat/)
    expect(withEffect({ kind: 'startProject', projectId: 'spaceport' })).toThrow(/unknown project/)
    expect(withEffect({ kind: 'relations', with: 'target', amount: 5 })).toThrow(/needs a target/)
    expect(withEffect({ kind: 'faction', faction: 'clergy' as never, amount: 5 })).toThrow(/unknown faction/)
  })

  it('keeps debt and creditors consistent', () => {
    const base: ActionDef = { id: 'test', name: 'Test', cost: 1, description: '', target: 'any', effects: [] }
    const withAction = (action: ActionDef) => () =>
      validateGameData({ ...GAME_DATA, actions: [...GAME_DATA.actions, action] })
    // Debt only changes through borrow and repayDebt, which need a great power to deal with.
    expect(withAction({ ...base, effects: [{ kind: 'stat', who: 'self', stat: 'debt', amount: 50 }] })).toThrow(
      /borrow or repayDebt/,
    )
    expect(withAction({ ...base, effects: [{ kind: 'borrow', amount: 50 }] })).toThrow(/great power/)

    const withKessara = (creditors: Record<string, number>) => () =>
      validateGameData({
        ...GAME_DATA,
        countries: GAME_DATA.countries.map((country) =>
          country.id === 'kessara' ? { ...country, creditors } : country,
        ),
      })
    expect(withKessara({ valmora: 10 })).toThrow(/not a great power/)
    expect(withKessara({ halvard: 10_000 })).toThrow(/more than its total debt/)
  })
})
