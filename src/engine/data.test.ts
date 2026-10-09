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

  it('rejects content with unknown names or broken references', () => {
    const withAction = (action: ActionDef) => () =>
      validateGameData({ ...GAME_DATA, actions: [...GAME_DATA.actions, action] })
    const base: ActionDef = { id: 'test', name: 'Test', cost: 1, description: '', target: 'none', effects: [] }

    expect(withAction(base)).not.toThrow()
    expect(withAction({ ...base, effects: [{ kind: 'stat', who: 'self', stat: 'wealth' as never, amount: 1 }] }))
      .toThrow(/unknown stat/)
    expect(withAction({ ...base, effects: [{ kind: 'startProject', projectId: 'spaceport' }] })).toThrow(
      /unknown project/,
    )
    expect(withAction({ ...base, effects: [{ kind: 'relations', with: 'target', amount: 5 }] })).toThrow(
      /needs a target/,
    )
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
