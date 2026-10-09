import { describe, expect, it } from 'vitest'
import {
  actionsCost,
  advanceTurn,
  checkActions,
  checkPlannedAction,
  debtInterest,
  describeAction,
  getProject,
  projectTurnsLeft,
  quarterLabel,
  targetsFor,
} from './index.ts'
import type { GameState } from './index.ts'
import { patchPlayer, quietGame, turnWith } from './testHelpers.ts'

const start = quietGame(1)

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

  it('closing the strait to a power angers it and pleases the other', () => {
    const before = start.countries.kessara.relations
    const after = advanceTurn(start, turnWith({ actionId: 'straitAccess', targetId: 'tsengai', option: 'closed' }))
    expect(after.countries.kessara.relations.tsengai).toBeLessThan(before.tsengai)
    expect(after.countries.kessara.relations.halvard).toBeGreaterThan(before.halvard)
  })

  it('infrastructure is paid for up front and pays out once built', () => {
    const grid = getProject('powerGrid')
    let built = advanceTurn(start, turnWith({ actionId: 'buildInfrastructure', option: 'powerGrid' }))
    let skipped = advanceTurn(start, turnWith())
    expect(skipped.countries.kessara.stats.treasury - built.countries.kessara.stats.treasury).toBe(grid.cost)
    expect(projectTurnsLeft(built, built.countries.kessara.projects[0])).toBe(grid.turns - 1)

    // The turn it starts counts as the first turn of building.
    for (let turn = 2; turn <= grid.turns; turn++) {
      expect(built.countries.kessara.stats.growth).toBe(skipped.countries.kessara.stats.growth)
      built = advanceTurn(built, turnWith())
      skipped = advanceTurn(skipped, turnWith())
    }
    expect(built.log).toContainEqual({ turn: grid.turns, phase: 'resolution', text: 'Kessara completes Power grid.' })
    expect(built.countries.kessara.stats.growth).toBeGreaterThan(skipped.countries.kessara.stats.growth)
    expect(projectTurnsLeft(built, built.countries.kessara.projects[0])).toBe(0)

    const again = turnWith({ actionId: 'buildInfrastructure', option: 'powerGrid' })
    expect(() => advanceTurn(built, again)).toThrow(/already/)
  })
})

describe('helpers for the interface', () => {
  it('list the targets each action allows', () => {
    expect(targetsFor(start, 'kessara', 'acceptLoan')).toEqual(['halvard', 'tsengai'])
    expect(targetsFor(start, 'kessara', 'covertOperation')).toEqual(['valmora', 'ostrel', 'sabu', 'daranth'])
    expect(targetsFor(start, 'kessara', 'signTradeDeal')).not.toContain('kessara')
    expect(targetsFor(start, 'kessara', 'militarySpending')).toEqual([])
  })

  it('check a plan with the same rules as the turn itself', () => {
    expect(checkActions(start, [{ actionId: 'militarySpending' }])).toBeNull()
    expect(checkActions(start, [{ actionId: 'acceptLoan', targetId: 'valmora' }])).toMatch(/great power/)

    const tooMuch = [{ actionId: 'domesticReform' }, { actionId: 'domesticReform' }, { actionId: 'militarySpending' }]
    expect(actionsCost(tooMuch)).toBe(5)
    expect(checkActions(start, tooMuch)).toMatch(/action points/)
  })

  it('explain why a planned action does not fit', () => {
    const planned = [
      { actionId: 'signTradeDeal', targetId: 'halvard' },
      { actionId: 'diplomaticSummit', targetId: 'valmora' },
      { actionId: 'militarySpending' },
    ]
    expect(checkPlannedAction(start, planned, { actionId: 'domesticReform' })).toBe('Needs 2 points, only 1 left')
    expect(checkPlannedAction(start, planned.slice(0, 2), { actionId: 'domesticReform' })).toBeNull()
    expect(checkPlannedAction(start, [], { actionId: 'acceptLoan', targetId: 'valmora' })).toMatch(/great power/)
  })

  it('describe exactly what an action will do with its target and option', () => {
    expect(describeAction(start, 'kessara', { actionId: 'signTradeDeal', targetId: 'halvard' })).toEqual([
      'Growth +0.5%',
      'Halvard Compact: growth +0.25%',
      'Relations with Halvard Compact +5',
      'Alignment up to 5 toward Halvard Compact',
      'Tsengai Republic resents it: relations up to −3',
      'Business +4',
      'Generals −3',
    ])
    expect(describeAction(start, 'kessara', { actionId: 'straitAccess', targetId: 'halvard', option: 'closed' })).toEqual([
      'Kessara Strait closed to Halvard Compact (now open)',
      'While closed, 20% chance each turn of a blockade or staged incident',
      'Relations with Halvard Compact −25',
      'Relations with Tsengai Republic +20',
      'Generals +6',
      'Business −8',
    ])
    expect(describeAction(start, 'kessara', { actionId: 'buildInfrastructure', option: 'powerGrid' })).toEqual([
      'Business +4',
      'Reformers −3',
      'Costs 90, takes 3 turns, then growth +0.5%, legitimacy +4, upkeep +4 a turn',
    ])
    expect(describeAction(start, 'kessara', { actionId: 'covertOperation', targetId: 'ostrel' })).toEqual([
      'Treasury −20',
      'Ostrel: legitimacy −8',
      'Generals +4',
      'Reformers −4',
      '30% chance the operation is exposed: relations with Ostrel −25, legitimacy −5',
    ])
    expect(describeAction(start, 'kessara', { actionId: 'repayDebt', targetId: 'tsengai' })[0]).toBe(
      'Repay up to 100 of the debt to Tsengai Republic (you owe 70), from the treasury',
    )
  })

  it('label each turn with its year and quarter', () => {
    expect(quarterLabel(1)).toBe('Year 1, Q1')
    expect(quarterLabel(5)).toBe('Year 2, Q1')
    expect(quarterLabel(40)).toBe('Year 10, Q4')
  })
})
