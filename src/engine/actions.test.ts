import { describe, expect, it } from 'vitest'
import { advanceTurn, createGameState, getProject } from './index.ts'
import { turnWith } from './testHelpers.ts'

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

  it('loans add cash and the same amount of debt', () => {
    const before = start.countries.kessara.stats
    const after = advanceTurn(start, turnWith({ actionId: 'acceptLoan', targetId: 'tsengai' }))
    const baseline = advanceTurn(start, turnWith())
    const cash = after.countries.kessara.stats.treasury - baseline.countries.kessara.stats.treasury
    const debt = after.countries.kessara.stats.debt - before.debt
    expect(debt).toBeGreaterThan(0)
    // Next turn's interest on the new debt comes out of the cash.
    expect(cash).toBeLessThan(debt)
    expect(after.countries.kessara.stats.alignment).toBeLessThan(before.alignment)
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
