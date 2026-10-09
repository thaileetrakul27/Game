import { describe, expect, it } from 'vitest'
import {
  advanceTurn,
  alerts,
  checkPlannedAction,
  closureRisk,
  createGameState,
  GAME_DATA,
  hedgingStatus,
  inBrokerRange,
  incomeBreakdown,
  isPast,
  straitIncome,
  tradeCutBy,
} from './index.ts'
import type { FactionId, GameState, StraitAccess } from './index.ts'
import { patchPlayer, quietGame, turnAnswering, turnWith } from './testHelpers.ts'

const start = quietGame(1)

function withAlignment(alignment: number, state: GameState = start): GameState {
  return patchPlayer(state, { stats: { alignment } })
}

function withFaction(faction: FactionId, satisfaction: number, state: GameState = start): GameState {
  return { ...state, factions: { ...state.factions, [faction]: satisfaction } }
}

function withAccess(halvard: StraitAccess, tsengai: StraitAccess, state: GameState = start): GameState {
  return { ...state, straitAccess: { ...state.straitAccess, kessaraStrait: { halvard, tsengai } } }
}

/** Play turns without actions, answering anything pending. */
function wait(state: GameState, turns = 1): GameState {
  let next = state
  for (let turn = 0; turn < turns; turn++) next = advanceTurn(next, turnAnswering(next))
  return next
}

const alignmentOf = (state: GameState) => state.countries.kessara.stats.alignment
const seeds = Array.from({ length: 40 }, (_, index) => index + 1)

describe('thresholds', () => {
  it('count a line as passed only beyond it', () => {
    expect(isPast(40, 40)).toBe(false)
    expect(isPast(41, 40)).toBe(true)
    expect(isPast(-40, 40)).toBe(false)
    expect(isPast(-41, 40)).toBe(true)
  })

  it('include both ends of the broker range', () => {
    expect(inBrokerRange(20)).toBe(true)
    expect(inBrokerRange(-20)).toBe(true)
    expect(inBrokerRange(21)).toBe(false)
    expect(inBrokerRange(-21)).toBe(false)
  })
})

describe('alignment drift', () => {
  it('moves 2 toward zero in a turn when nothing moved alignment, never past zero', () => {
    expect(alignmentOf(wait(withAlignment(10)))).toBe(8)
    expect(alignmentOf(wait(withAlignment(-10)))).toBe(-8)
    expect(alignmentOf(wait(withAlignment(1)))).toBe(0)
    expect(alignmentOf(wait(withAlignment(0)))).toBe(0)
  })

  it('skips a turn in which something moved alignment', () => {
    const traded = advanceTurn(withAlignment(10), turnWith({ actionId: 'signTradeDeal', targetId: 'halvard' }))
    expect(alignmentOf(traded)).toBe(15)
  })
})

describe('past plus or minus 40', () => {
  it('makes the opposite power cut trade, costing 15% of output', () => {
    expect(tradeCutBy(withAlignment(40), 'kessara')).toBeNull()
    expect(tradeCutBy(withAlignment(41), 'kessara')).toBe('tsengai')
    expect(tradeCutBy(withAlignment(-41), 'kessara')).toBe('halvard')

    expect(incomeBreakdown(withAlignment(40), 'kessara').tradeLoss).toBe(0)
    const cut = incomeBreakdown(withAlignment(41), 'kessara')
    expect(cut.tradeLoss).toBe(Math.round(cut.output * 0.15))
  })

  it('blocks trade deals with the power that cut trade', () => {
    const leaning = withAlignment(50)
    expect(checkPlannedAction(leaning, [], { actionId: 'signTradeDeal', targetId: 'tsengai' })).toMatch(/cut trade/)
    expect(checkPlannedAction(leaning, [], { actionId: 'signTradeDeal', targetId: 'halvard' })).toBeNull()
  })

  it('has that power court each neighbour against you every turn', () => {
    // Same seed and actions, so everything but the courting matches the run inside the line.
    const courted = wait(withAlignment(60))
    const baseline = wait(withAlignment(30))
    for (const id of ['valmora', 'ostrel', 'sabu', 'daranth']) {
      expect(courted.countries[id].relations.kessara - baseline.countries[id].relations.kessara).toBe(-2)
      expect(courted.countries[id].stats.alignment - baseline.countries[id].stats.alignment).toBe(-2)
    }
    expect(courted.countries.halvard.relations.kessara).toBe(baseline.countries.halvard.relations.kessara)
  })
})

describe('past plus or minus 70 for 4 turns in a row', () => {
  it('has your patron issue a demand on the 4th turn', () => {
    const threeTurns = wait(withAlignment(90), 3)
    expect(threeTurns.demand).toBeNull()
    expect(threeTurns.demandTurns).toBe(3)

    const fourTurns = wait(threeTurns)
    expect(fourTurns.demand?.fromId).toBe('halvard')
    expect(fourTurns.demandTurns).toBe(0)
    expect(wait(withAlignment(-90), 4).demand?.fromId).toBe('tsengai')
  })

  it('starts counting again after a turn ends inside the line', () => {
    const once = wait(withAlignment(73))
    expect(alignmentOf(once)).toBe(71)
    expect(once.demandTurns).toBe(1)
    const twice = wait(once)
    expect(alignmentOf(twice)).toBe(69)
    expect(twice.demandTurns).toBe(0)
  })

  const demanded: GameState = { ...withAlignment(80), demand: { demandId: 'navalBase', fromId: 'halvard' } }

  it('needs an answer, and accepting pushes alignment further toward the patron', () => {
    expect(() => advanceTurn(demanded, turnWith())).toThrow(/accept or refuse/)
    const accepted = advanceTurn(demanded, { ...turnWith(), demandResponse: 'accept' })
    expect(alignmentOf(accepted)).toBe(90)
    expect(accepted.demand).toBeNull()
    expect(accepted.demandsAccepted.halvard).toBe(1)
    expect(accepted.countries.kessara.stats.defence).toBe(start.countries.kessara.stats.defence + 8)
  })

  it('refusing costs 25 relations and can trigger a recall of loans', () => {
    const outcomes = seeds.map((seed) => {
      const state: GameState = { ...withAlignment(80, quietGame(seed)), demand: demanded.demand }
      const refused = advanceTurn(state, { ...turnWith(), demandResponse: 'refuse' })
      // Rival moves shift relations by up to 2 either way.
      const relationsDrop = state.countries.kessara.relations.halvard - refused.countries.kessara.relations.halvard
      expect(relationsDrop).toBeGreaterThanOrEqual(23)
      expect(relationsDrop).toBeLessThanOrEqual(27)
      return refused.countries.kessara.creditors.halvard
    })
    // Kessara owes Halvard 80: some refusals bring a recall, others don't.
    expect(outcomes).toContain(0)
    expect(outcomes).toContain(80)
  })

  it('makes you a vassal once you accept 3 demands from the same power', () => {
    const twoAccepted = { ...demanded, demandsAccepted: { halvard: 2 } }
    const vassal = advanceTurn(twoAccepted, { ...turnWith(), demandResponse: 'accept' })
    expect(vassal.status).toBe('ended')
    expect(vassal.endReason).toBe('vassal')

    const spread = { ...demanded, demandsAccepted: { tsengai: 2, halvard: 1 } }
    expect(advanceTurn(spread, { ...turnWith(), demandResponse: 'accept' }).status).toBe('playing')
  })
})

describe('broker bonus within plus or minus 20', () => {
  it('gives an extra action point after every 3 turns in a row in range', () => {
    const one = wait(start)
    const two = wait(one)
    const three = wait(two)
    expect([one.actionPoints, two.actionPoints, three.actionPoints]).toEqual([4, 4, 5])
    expect(hedgingStatus(three).bonusPoints).toBe(1)
    expect(wait(three).actionPoints).toBe(4)

    const fivePoints = [{ actionId: 'domesticReform' }, { actionId: 'domesticReform' }, { actionId: 'militarySpending' }]
    expect(() => advanceTurn(three, turnAnswering(three, ...fivePoints))).not.toThrow()
  })

  it('starts counting again after a turn ends outside the range', () => {
    const outside = wait(withAlignment(24))
    expect(alignmentOf(outside)).toBe(22)
    expect(outside.brokerTurns).toBe(0)
    const inside = wait(outside)
    expect(alignmentOf(inside)).toBe(20)
    expect(inside.brokerTurns).toBe(1)
  })
})

describe('factions', () => {
  it('react to every action, one pleased and one annoyed', () => {
    const after = advanceTurn(start, turnWith({ actionId: 'militarySpending' }))
    expect(after.factions.generals).toBe(start.factions.generals + 5)
    expect(after.factions.reformers).toBe(start.factions.reformers - 3)
    expect(after.factions.business).toBe(start.factions.business)
  })

  it('below 15, can trigger their crisis card', () => {
    // The deck is on here. The coup card can't be drawn at random while loyalty is 30 or more.
    const game = (seed: number) => createGameState({ seed, settings: { rivals: false } })
    const drawn = seeds.map((seed) => wait(withFaction('generals', 14, game(seed))).crisis?.cardId)
    expect(drawn).toContain('coupAttempt')
    expect(drawn.some((card) => card !== 'coupAttempt')).toBe(true)

    const calm = seeds.map((seed) => wait(withFaction('generals', 15, game(seed))).crisis?.cardId)
    expect(calm).not.toContain('coupAttempt')
  })

  it("apply the chosen response's effects when the card is answered", () => {
    const crisis: GameState = { ...start, crisis: { cardId: 'coupAttempt', responseIds: ['buyOff', 'purge'], targetId: null } }
    const bought = advanceTurn(crisis, { ...turnWith(), crisisResponse: 'buyOff' })
    const purged = advanceTurn(crisis, { ...turnWith(), crisisResponse: 'purge' })
    expect(bought.factions.generals).toBe(start.factions.generals + 20)
    expect(purged.countries.kessara.stats.treasury - bought.countries.kessara.stats.treasury).toBe(60)
  })
})

describe('strait access and tolls', () => {
  it("earn tolls from the strait's trade share and each power's access", () => {
    // 40% of trade at 0.75 a share is 30: 12 from Halvard (40% of traffic) and 18 from Tsengai (60%).
    expect(straitIncome(start, 'kessara')).toBe(30)
    // Taxed traffic pays 1.6 times: 18 × 1.6 rounds to 29.
    expect(straitIncome(withAccess('open', 'taxed'), 'kessara')).toBe(12 + 29)
    expect(straitIncome(withAccess('open', 'closed'), 'kessara')).toBe(12)
    expect(straitIncome(withAccess('closed', 'closed'), 'kessara')).toBe(0)
    expect(incomeBreakdown(withAccess('taxed', 'taxed'), 'kessara').tolls).toBe(19 + 29)
  })

  it('change with the strait access action, which refuses the current setting', () => {
    const closed = advanceTurn(start, turnWith({ actionId: 'straitAccess', targetId: 'tsengai', option: 'closed' }))
    expect(closed.straitAccess.kessaraStrait.tsengai).toBe('closed')
    expect(checkPlannedAction(closed, [], { actionId: 'straitAccess', targetId: 'tsengai', option: 'closed' })).toMatch(
      /already closed/,
    )
  })

  it('risk a blockade or staged incident while closed, less with more defence', () => {
    expect(closureRisk(0)).toBeCloseTo(0.3)
    expect(closureRisk(40)).toBeCloseTo(0.2)
    expect(closureRisk(120)).toBe(0)

    const strikes = (access: StraitAccess) =>
      seeds.filter((seed) => {
        const state = patchPlayer(withAccess('open', access, quietGame(seed)), { stats: { defence: 0 } })
        return wait(state).log.some((entry) => entry.text.includes('in answer to the closed strait'))
      }).length
    expect(strikes('closed')).toBeGreaterThan(0)
    expect(strikes('open')).toBe(0)
  })
})

describe('alerts', () => {
  it('warn about every active threshold, most urgent first', () => {
    const tense: GameState = {
      ...withFaction('reformers', 10, withAccess('open', 'closed', withAlignment(75))),
      demandTurns: 2,
      demand: { demandId: 'expelCompanies', fromId: 'halvard' },
    }
    const shown = alerts(tense)
    expect(shown.map((alert) => alert.id).sort()).toEqual(
      ['closed-tsengai', 'demand', 'demand-countdown', 'trade-cut', 'unrest-reformers'].sort(),
    )
    expect(shown[0].level).toBe('critical')
    expect(shown.find((alert) => alert.id === 'demand-countdown')?.text).toContain('2 of 4')
    expect(alerts(start)).toEqual([])
  })
})

it('keeps the data in step with these tests', () => {
  expect(GAME_DATA.hedging.tradeCutOutputLoss).toBe(0.15)
  expect(GAME_DATA.straitControl.taxedTollMultiplier).toBe(1.6)
})
