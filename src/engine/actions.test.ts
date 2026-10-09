import { describe, expect, it } from 'vitest'
import { advanceTurn, createGameState, debtInterest, getProject } from './index.ts'
import type { GameState } from './index.ts'
import { patchPlayer, turnWith } from './testHelpers.ts'

const start = createGameState({ seed: 1 })

describe('actions', () => {
  it('spend action points at the costs in the action data', () => {
    const buildTwo = turnWith(
      { actionId: 'buildInfrastructure', option: 'powerGrid' },
      { actionId: 'buildInfrastructure', option: 'port' },
    )
    expect(() => advanceTurn(start, buildTwo)).not.toThrow()

    const overspend = turnWith(...buildTwo.actions, { actionId: 'diplomaticSummit', targetId: 'valmora' })
    expect(() => advanceTurn(start, overspend)).toThrow(/action points|points/)
  })

  it('check targets and options against the action data', () => {
    const attempts = [
      { actionId: 'acceptLoan', targetId: 'valmora' }, // loans come from great powers
      { actionId: 'signTradeDeal', targetId: 'kessara' }, // not your own country
      { actionId: 'covertOperation', targetId: 'halvard' }, // only smaller states
      { actionId: 'militarySpending', targetId: 'ostrel' }, // takes no target
      { actionId: 'straitAccess', targetId: 'halvard' }, // needs grant or deny
      { actionId: 'buildInfrastructure', option: 'spaceport' },
      { actionId: 'raiseTaxes' },
    ]
    for (const action of attempts) {
      expect(() => advanceTurn(start, turnWith(action)), action.actionId).toThrow()
    }
  })

  it('trade deals raise growth and pull alignment toward the partner', () => {
    const before = start.countries.kessara.stats
    const withHalvard = advanceTurn(start, turnWith({ actionId: 'signTradeDeal', targetId: 'halvard' }))
    expect(withHalvard.countries.kessara.stats.growth).toBeGreaterThan(before.growth)
    expect(withHalvard.countries.kessara.stats.alignment).toBeGreaterThan(before.alignment)

    const withTsengai = advanceTurn(start, turnWith({ actionId: 'signTradeDeal', targetId: 'tsengai' }))
    expect(withTsengai.countries.kessara.stats.alignment).toBeLessThan(before.alignment)

    // Great powers anchor the alignment scale and never move.
    expect(withHalvard.countries.halvard.stats.alignment).toBe(100)
  })

  it('loans add cash and the same amount of debt, owed to the lender', () => {
    const before = start.countries.kessara
    const after = advanceTurn(start, turnWith({ actionId: 'acceptLoan', targetId: 'tsengai' }))
    const baseline = advanceTurn(start, turnWith())
    const cash = after.countries.kessara.stats.treasury - baseline.countries.kessara.stats.treasury
    const debt = after.countries.kessara.stats.debt - before.stats.debt
    expect(debt).toBeGreaterThan(0)
    expect(after.countries.kessara.creditors.tsengai - before.creditors.tsengai).toBe(debt)
    // Next turn's interest on the new debt comes out of the cash.
    expect(cash).toBeLessThan(debt)
    expect(after.countries.kessara.stats.alignment).toBeLessThan(before.stats.alignment)
  })

  describe('repaying debt', () => {
    const owing = patchPlayer(start, {
      stats: { treasury: 1000, debt: 600, alignment: 0 },
      creditors: { halvard: 400, tsengai: 100 },
    })
    const repay = (state: GameState, targetId: string) =>
      advanceTurn(state, turnWith({ actionId: 'repayDebt', targetId }))

    it('pays down the debt to that power from the treasury', () => {
      const after = repay(owing, 'halvard')
      const baseline = advanceTurn(owing, turnWith())
      const paid = 400 - after.countries.kessara.creditors.halvard
      expect(paid).toBeGreaterThan(0)
      expect(after.countries.kessara.stats.debt).toBe(600 - paid)
      expect(after.countries.kessara.creditors.tsengai).toBe(100)

      // The payment leaves the treasury, and next turn's interest is lower on the smaller debt.
      const interestSaved = debtInterest(600) - debtInterest(600 - paid)
      const treasuryGap = baseline.countries.kessara.stats.treasury - after.countries.kessara.stats.treasury
      expect(treasuryGap).toBe(paid - interestSaved)
    })

    it('shifts alignment slightly away from that power', () => {
      expect(repay(owing, 'halvard').countries.kessara.stats.alignment).toBeLessThan(0)
      expect(repay(owing, 'tsengai').countries.kessara.stats.alignment).toBeGreaterThan(0)
      expect(repay(owing, 'halvard').countries.halvard.stats.alignment).toBe(100)

      // Fully aligned with a power, repaying it moves you back toward the centre.
      const loyal = patchPlayer(owing, { stats: { alignment: 100 } })
      expect(repay(loyal, 'halvard').countries.kessara.stats.alignment).toBeLessThan(100)
    })

    it('pays no more than is owed to that power', () => {
      const littleOwed = patchPlayer(owing, { creditors: { halvard: 10, tsengai: 100 } })
      const after = repay(littleOwed, 'halvard')
      expect(after.countries.kessara.creditors.halvard).toBe(0)
      expect(after.countries.kessara.stats.debt).toBe(590)
    })

    it('needs debt owed to a great power', () => {
      const owesTsengaiOnly = patchPlayer(owing, { creditors: { tsengai: 100 } })
      expect(() => repay(owesTsengaiOnly, 'halvard')).toThrow(/owes nothing/)
      expect(() => repay(owing, 'valmora')).toThrow(/great power/)
    })
  })

  it('denying strait access angers that power and pleases the other', () => {
    const before = start.countries.kessara.relations
    const after = advanceTurn(start, turnWith({ actionId: 'straitAccess', targetId: 'tsengai', option: 'deny' }))
    expect(after.countries.kessara.relations.tsengai).toBeLessThan(before.tsengai)
    expect(after.countries.kessara.relations.halvard).toBeGreaterThan(before.halvard)
  })

  it('infrastructure is paid for up front and pays out once built', () => {
    const grid = getProject('powerGrid')
    let built = advanceTurn(start, turnWith({ actionId: 'buildInfrastructure', option: 'powerGrid' }))
    let skipped = advanceTurn(start, turnWith())
    expect(skipped.countries.kessara.stats.treasury - built.countries.kessara.stats.treasury).toBe(grid.cost)

    // The turn it starts counts as the first turn of building.
    for (let turn = 2; turn <= grid.turns; turn++) {
      expect(built.countries.kessara.stats.growth).toBe(skipped.countries.kessara.stats.growth)
      built = advanceTurn(built, turnWith())
      skipped = advanceTurn(skipped, turnWith())
    }
    expect(built.log).toContainEqual({ turn: grid.turns, phase: 'resolution', text: 'Kessara completes Power grid.' })
    expect(built.countries.kessara.stats.growth).toBeGreaterThan(skipped.countries.kessara.stats.growth)

    const again = turnWith({ actionId: 'buildInfrastructure', option: 'powerGrid' })
    expect(() => advanceTurn(built, again)).toThrow(/already/)
  })
})
