import { describe, expect, it } from 'vitest'
import { takeAction } from './actions.ts'
import {
  advanceTurn,
  alerts,
  createRng,
  describeOffer,
  GAME_DATA,
  getAction,
  rivalTurn,
  scoreAction,
} from './index.ts'
import type { ActionDef, CountryId, GameState, PlayerAction } from './index.ts'
import { rivalAnswer } from './offers.ts'
import { quietGame, turnWith } from './testHelpers.ts'

const start = quietGame(1)
const offerTo = (targetId: CountryId): PlayerAction => ({ actionId: 'investmentPackage', targetId })
const stats = (state: GameState, id: CountryId) => state.countries[id].stats

/** Halvard makes an offer to the player, as it would in the rivals phase. */
const offered = takeAction(start, 'halvard', offerTo('kessara'), createRng(1), 'rivals')

describe('investment packages', () => {
  it('are open only to a Merchant great power', () => {
    expect(() => takeAction(start, 'tsengai', offerTo('valmora'), createRng(1))).toThrow('not open to Tsengai Republic')
    expect(() => takeAction(start, 'kessara', offerTo('valmora'), createRng(1))).toThrow('not open to Kessara')
  })

  it("give a neighbour that accepts cash, output and a lean toward Halvard, paid from Halvard's treasury", () => {
    const after = takeAction(start, 'halvard', offerTo('valmora'), createRng(1), 'rivals')
    expect(stats(after, 'valmora').treasury).toBe(stats(start, 'valmora').treasury + 80)
    expect(after.countries.valmora.economy.baseOutput).toBe(start.countries.valmora.economy.baseOutput + 3)
    expect(stats(after, 'valmora').alignment).toBe(stats(start, 'valmora').alignment + 8)
    expect(after.countries.valmora.relations.halvard).toBe(start.countries.valmora.relations.halvard + 8)
    expect(stats(after, 'halvard').treasury).toBe(stats(start, 'halvard').treasury - 80)
    expect(after.log.slice(-2).map((entry) => entry.text)).toEqual([
      'Halvard Compact: Offer investment package (Valmora).',
      'Valmora accepts.',
    ])
  })

  it('are declined by a computer country that would be worse off accepting', () => {
    // The same offer with terms no country would want.
    const package_ = getAction('investmentPackage')
    const ruinous: ActionDef = {
      ...package_,
      offer: { ...package_.offer!, accepted: [{ kind: 'stat', who: 'self', stat: 'treasury', amount: -500 }] },
    }
    expect(rivalAnswer(start, 'valmora', 'halvard', package_)).toBe('accept')
    expect(rivalAnswer(start, 'valmora', 'halvard', ruinous)).toBe('decline')
  })

  it('wait 8 turns before Halvard offers the same country another', () => {
    expect(GAME_DATA.rivals.repeatAfterTurnsFor.investmentPackage).toBe(8)
    // Halvard with its projects built and growth at its limit, so packages are among its best moves.
    const projects = GAME_DATA.projects.map((project) => ({ projectId: project.id, completesOnTurn: 0 }))
    const halvard = start.countries.halvard
    const busy: GameState = {
      ...start,
      countries: { ...start.countries, halvard: { ...halvard, projects, stats: { ...halvard.stats, growth: 8 } } },
    }
    const offersOstrel = (turnsAgo: number | null) => {
      const state: GameState =
        turnsAgo === null
          ? busy
          : { ...busy, turn: start.turn + turnsAgo, rivalHistory: { halvard: { 'investmentPackage|ostrel|': start.turn } } }
      return rivalTurn(state, 'halvard', createRng(1), 0).actions.some(
        (action) => action.actionId === 'investmentPackage' && action.targetId === 'ostrel',
      )
    }
    expect(offersOstrel(null)).toBe(true)
    // Longer than the usual 3-turn wait before a rival repeats an action.
    for (const turnsAgo of [3, 5, 7]) expect(offersOstrel(turnsAgo), `${turnsAgo} turns ago`).toBe(false)
    expect(offersOstrel(8)).toBe(true)
  })
})

describe('an offer to the player', () => {
  it('waits for the answer with the next turn, shown with what each answer would do', () => {
    expect(offered.offer).toEqual({ fromId: 'halvard', actionId: 'investmentPackage' })
    expect(offered.log.at(-1)?.text).toBe('Kessara will answer next turn.')
    expect(alerts(offered).map((alert) => alert.title)).toContain('Halvard Compact offers: Investment package')

    const view = describeOffer(offered)!
    expect(view.fromName).toBe('Halvard Compact')
    expect(view.accept).toEqual([
      'Treasury +80',
      'Base output +3 a turn',
      'Halvard Compact: treasury −80',
      'Relations with Halvard Compact +8',
      'Alignment up to 8 toward Halvard Compact',
      'Tsengai Republic resents it: relations up to −5',
      'Business +3',
      'Reformers −2',
    ])
    expect(view.decline).toEqual(['Relations with Halvard Compact −4'])
  })

  it('must be answered before the turn can end', () => {
    expect(() => advanceTurn(offered, turnWith())).toThrow('Halvard Compact wants an answer to its offer: accept or decline')
    expect(() => advanceTurn(start, { ...turnWith(), offerResponse: 'accept' })).toThrow('There is no offer to answer')
  })

  it('applies the package when accepted, and costs relations when declined', () => {
    const accepted = advanceTurn(offered, { ...turnWith(), offerResponse: 'accept' })
    const declined = advanceTurn(offered, { ...turnWith(), offerResponse: 'decline' })
    expect(accepted.offer).toBeNull()
    expect(declined.offer).toBeNull()

    expect(accepted.countries.kessara.economy.baseOutput).toBe(start.countries.kessara.economy.baseOutput + 3)
    expect(stats(accepted, 'kessara').alignment).toBe(8)
    expect(accepted.countries.kessara.relations.halvard).toBe(start.countries.kessara.relations.halvard + 8)
    expect(accepted.factions.business).toBe(start.factions.business + 3)
    expect(accepted.log.map((entry) => entry.text)).toContain("You accept Halvard Compact's offer: Investment package.")

    expect(declined.countries.kessara.economy.baseOutput).toBe(start.countries.kessara.economy.baseOutput)
    expect(declined.countries.kessara.relations.halvard).toBe(start.countries.kessara.relations.halvard - 4)
    expect(stats(accepted, 'kessara').treasury - stats(declined, 'kessara').treasury).toBeGreaterThanOrEqual(80)
  })

  it('stands alone: Halvard cannot make another until the player answers', () => {
    expect(() => takeAction(offered, 'halvard', offerTo('kessara'), createRng(1), 'rivals')).toThrow(
      "Kessara has not answered Halvard Compact's last offer yet",
    )
    // Halvard weighs an offer to the player as if the player will accept it.
    expect(scoreAction(start, 'halvard', offerTo('kessara'))).not.toBeNull()
    expect(scoreAction(offered, 'halvard', offerTo('kessara'))).toBeNull()
  })
})
