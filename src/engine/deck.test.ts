import { describe, expect, it } from 'vitest'
import { resolveCrisis } from './crisis.ts'
import { advanceTurn, cardWeight, createGameState, createRng, describeCrisis, drawCrisis, GAME_DATA, getEvent } from './index.ts'
import type { CountryId, GameState, Stats } from './index.ts'
import { patchPlayer } from './testHelpers.ts'

// The deck is on and the rivals and the variety between games are off, so only the cards change the state.
const start = createGameState({ seed: 1, settings: { rivals: false, variety: false } })
const seeds = Array.from({ length: 40 }, (_, index) => index + 1)
const weightOf = (state: GameState, cardId: string) => cardWeight(state, getEvent(cardId))

function patchStats(state: GameState, id: CountryId, stats: Partial<Stats>): GameState {
  const country = state.countries[id]
  return { ...state, countries: { ...state.countries, [id]: { ...country, stats: { ...country.stats, ...stats } } } }
}

/** Put every other card on its repeat cooldown, so a draw by weight can only pick this one. */
function onlyDrawable(state: GameState, cardId: string): GameState {
  const others = GAME_DATA.events.filter((card) => card.id !== cardId)
  return { ...state, lastDrawn: Object.fromEntries(others.map((card) => [card.id, state.turn])) }
}

function withCard(state: GameState, cardId: string, targetId: CountryId | null): GameState {
  const responseIds = getEvent(cardId).responses.map((response) => response.id)
  return { ...state, crisis: { cardId, responseIds, targetId } }
}

describe('the starter deck', () => {
  it('has 20 cards, including the three faction crisis cards', () => {
    const ids = GAME_DATA.events.map((card) => card.id)
    expect(ids).toHaveLength(20)
    for (const faction of GAME_DATA.factions.factions) expect(ids).toContain(faction.crisisCard)
  })

  it('can reach every card that is never drawn at random, through a faction or a chain', () => {
    const reachable = new Set([
      ...GAME_DATA.factions.factions.map((faction) => faction.crisisCard),
      ...GAME_DATA.events.flatMap((card) => card.responses.flatMap((response) => response.chain?.card ?? [])),
    ])
    for (const card of GAME_DATA.events.filter((candidate) => candidate.weight === 0)) {
      expect(reachable.has(card.id), card.id).toBe(true)
    }
  })

  it('has cards about each of the four neighbours', () => {
    const targets = GAME_DATA.events.map((card) => card.target)
    for (const neighbour of ['valmora', 'ostrel', 'sabu', 'daranth']) expect(targets).toContain(neighbour)
  })
})

describe('card weights', () => {
  it('leave out a card while its conditions do not hold', () => {
    // A coup attempt needs military loyalty below 30, and 30 itself is not below.
    expect(weightOf(patchPlayer(start, { stats: { militaryLoyalty: 30 } }), 'coupAttempt')).toBe(0)
    expect(weightOf(patchPlayer(start, { stats: { militaryLoyalty: 29 } }), 'coupAttempt')).toBe(3)

    // Conditions can be about a neighbour: Daranth's debt crisis needs its debt above 400.
    expect(weightOf(patchStats(start, 'daranth', { debt: 401 }), 'daranthDebtCrisis')).toBe(2)
    expect(weightOf(patchStats(start, 'daranth', { debt: 400 }), 'daranthDebtCrisis')).toBe(0)
  })

  it('boost a card while its boost condition holds', () => {
    const closed = { ...start, straitAccess: { ...start.straitAccess, kessaraStrait: { halvard: 'open', tsengai: 'closed' } } }
    expect(weightOf(start, 'navalStandoff')).toBe(3)
    expect(weightOf(closed as GameState, 'navalStandoff')).toBe(6)

    // A border clash is twice as likely while defence is below 40.
    expect(weightOf(patchPlayer(start, { stats: { defence: 40 } }), 'ostrelBorderClash')).toBe(2)
    expect(weightOf(patchPlayer(start, { stats: { defence: 39 } }), 'ostrelBorderClash')).toBe(4)
  })

  it('never let a card come back within 6 turns of its last draw', () => {
    const drawn = { ...start, lastDrawn: { typhoon: start.turn } }
    expect(weightOf({ ...drawn, turn: start.turn + 5 }, 'typhoon')).toBe(0)
    expect(weightOf({ ...drawn, turn: start.turn + 6 }, 'typhoon')).toBe(2)
  })

  it('keep weight-0 cards out of the random draw', () => {
    expect(weightOf(start, 'massProtests')).toBe(0)
    expect(weightOf(start, 'straitBlockade')).toBe(0)
  })
})

describe('drawing a card', () => {
  it('picks by weight from the cards that can be drawn, and remembers when', () => {
    const fresh: GameState = { ...start, crisis: null, lastDrawn: {} }
    const drawn = seeds.map((seed) => drawCrisis(fresh, createRng(seed)))
    const ids = new Set(drawn.map((state) => state.crisis?.cardId))
    expect(ids.size).toBeGreaterThan(5)
    for (const state of drawn) {
      const cardId = state.crisis!.cardId
      expect(weightOf(fresh, cardId), cardId).toBeGreaterThan(0)
      expect(state.lastDrawn[cardId]).toBe(start.turn)
    }
  })

  it('draws a chained card first, once it has come due', () => {
    const chain = { cardId: 'straitBlockade', dueTurn: start.turn, targetId: 'halvard' }
    const restless = { ...start, factions: { ...start.factions, reformers: 0 } }
    const due = drawCrisis({ ...restless, chains: [chain] }, createRng(1))
    expect(due.crisis).toEqual({ cardId: 'straitBlockade', responseIds: ['negotiate', 'sendNavy', 'waitItOut'], targetId: 'halvard' })
    expect(due.chains).toEqual([])

    const later = drawCrisis({ ...start, chains: [{ ...chain, dueTurn: start.turn + 1 }] }, createRng(1))
    expect(later.crisis?.cardId).not.toBe('straitBlockade')
    expect(later.chains).toHaveLength(1)
  })

  it("draws a faction's crisis card before a card picked by weight", () => {
    const restless = { ...start, factions: { ...start.factions, reformers: 14 } }
    const drawn = seeds.map((seed) => drawCrisis(restless, createRng(seed)).crisis?.cardId)
    expect(drawn).toContain('massProtests')
    expect(drawn.some((cardId) => cardId !== 'massProtests')).toBe(true)
  })

  it('draws nothing while the deck is switched off', () => {
    const off = createGameState({ seed: 1, settings: { events: false } })
    expect(off.crisis).toBeNull()
    expect(drawCrisis(off, createRng(1)).crisis).toBeNull()
  })
})

describe('card targets', () => {
  it('name a country, or the patron, the other power or the largest creditor at the time of the draw', () => {
    const target = (state: GameState, cardId: string, seed = 1) =>
      drawCrisis(onlyDrawable(state, cardId), createRng(seed)).crisis

    expect(target(start, 'fleetVisit')?.targetId).toBe('halvard')

    // A loan offer comes from the power the player does not lean toward.
    const short = patchPlayer(start, { stats: { treasury: 100 } })
    expect(target(patchPlayer(short, { stats: { alignment: 30 } }), 'loanOffer')?.targetId).toBe('tsengai')
    expect(target(patchPlayer(short, { stats: { alignment: -30 } }), 'loanOffer')?.targetId).toBe('halvard')
    const evenly = new Set(seeds.map((seed) => target(patchPlayer(short, { stats: { alignment: 0 } }), 'loanOffer', seed)?.targetId))
    expect(evenly).toEqual(new Set(['halvard', 'tsengai']))

    // The debt trap comes from whichever power the player owes most, and not at all without such a debt.
    const indebted = patchPlayer(start, { stats: { debt: 350 }, creditors: { halvard: 100, tsengai: 250 } })
    expect(target(indebted, 'debtTrap')?.targetId).toBe('tsengai')
    expect(weightOf(patchPlayer(indebted, { creditors: {} }), 'debtTrap')).toBe(0)
  })

  it("put the target's name in the card's text", () => {
    const offer = withCard(start, 'loanOffer', 'tsengai')
    expect(describeCrisis(offer)?.description).toMatch(/^Tsengai Republic bankers offer/)
  })
})

describe('card responses', () => {
  const trap = withCard(patchPlayer(start, { stats: { debt: 350 }, creditors: { tsengai: 250 } }), 'debtTrap', 'tsengai')

  it('show only the visible effects before the choice, and reveal hidden ones in the log', () => {
    const view = describeCrisis(trap)!
    const stake = view.responses.find((response) => response.id === 'handOverStake')!
    expect(stake.effects.join(' ')).not.toMatch(/egitimacy/)

    const after = resolveCrisis(trap, 'handOverStake', createRng(1))
    const player = after.countries.kessara
    expect(player.stats.legitimacy).toBe(trap.countries.kessara.stats.legitimacy - 5)
    expect(player.stats.debt).toBe(200)
    expect(player.creditors.tsengai).toBe(100)
    expect(after.log.map((entry) => entry.text)).toContain('Hidden effect: legitimacy −5.')
    expect(after.crisis).toBeNull()
  })

  it('can set off a follow-up card a set number of turns later, about the same country', () => {
    const standoff = withCard(start, 'navalStandoff', 'halvard')
    const backed = seeds.map((seed) => resolveCrisis(standoff, 'backHalvard', createRng(seed)).chains)
    expect(backed).toContainEqual([{ cardId: 'straitBlockade', dueTurn: start.turn + 1, targetId: 'halvard' }])
    expect(backed).toContainEqual([])

    const talks = seeds.map((seed) => resolveCrisis(standoff, 'mediate', createRng(seed)).chains)
    expect(talks.every((chains) => chains.length === 0)).toBe(true)

    // Played through a whole turn, a chain that is set off is the next turn's card. The blockade has
    // weight 0, so it can't turn up any other way.
    const nextCards = seeds.map((seed) => {
      const next = advanceTurn({ ...standoff, rngState: seed }, { crisisResponse: 'backHalvard', actions: [] })
      expect(next.chains).toEqual([])
      return next.crisis
    })
    expect(nextCards).toContainEqual({ cardId: 'straitBlockade', responseIds: ['negotiate', 'sendNavy', 'waitItOut'], targetId: 'halvard' })
    expect(nextCards.some((crisis) => crisis?.cardId !== 'straitBlockade')).toBe(true)
  })
})
