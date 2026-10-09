import { describe, expect, it } from 'vitest'
import {
  actionsCost,
  advanceTurn,
  candidateActions,
  createGameState,
  createRng,
  GAME_DATA,
  latestNews,
  rivalReactions,
  rivalTurn,
  scoreAction,
  tension,
  utility,
  winningSide,
} from './index.ts'
import type { CountryId, GameState, PlayerAction, Stats } from './index.ts'
import { takeAction } from './actions.ts'
import { rivalsPhase } from './phases.ts'
import { changeRelations } from './state.ts'
import { patchPlayer, quietGame, turnWith } from './testHelpers.ts'

// The rivals are on and the event deck is off, so only actions change the state.
const start = createGameState({ seed: 1, settings: { events: false } })
/** The same world in the game's last years, when hostile rivals are at their boldest. */
const lateGame: GameState = { ...start, turn: 36 }
const rivals = Object.values(start.countries).filter((country) => country.id !== start.playerId)
const key = (action: PlayerAction) => `${action.actionId}|${action.targetId ?? ''}|${action.option ?? ''}`
const relationsOf = (state: GameState, a: CountryId, b: CountryId) => state.countries[a].relations[b]

function patchStats(state: GameState, id: CountryId, stats: Partial<Stats>): GameState {
  const country = state.countries[id]
  return { ...state, countries: { ...state.countries, [id]: { ...country, stats: { ...country.stats, ...stats } } } }
}

/** Mark every project as already built, so a rival's first priority is no longer building. */
function builtEverything(state: GameState, id: CountryId): GameState {
  const projects = GAME_DATA.projects.map((project) => ({ projectId: project.id, completesOnTurn: 0 }))
  return { ...state, countries: { ...state.countries, [id]: { ...state.countries[id], projects } } }
}

/** Set relations between two countries, both ways. */
function withRelations(state: GameState, a: CountryId, b: CountryId, value: number): GameState {
  return changeRelations(state, a, b, value - relationsOf(state, a, b))
}

describe('reactions to the player', () => {
  it("make the great power the player turned away from resent it, by 0.6 per point moved", () => {
    const towardHalvard = rivalReactions(patchPlayer(start, { stats: { alignment: 5 } }), 0)
    expect(relationsOf(towardHalvard, 'tsengai', 'kessara')).toBe(relationsOf(start, 'tsengai', 'kessara') - 3)
    expect(relationsOf(towardHalvard, 'kessara', 'tsengai')).toBe(relationsOf(start, 'kessara', 'tsengai') - 3)
    expect(relationsOf(towardHalvard, 'halvard', 'kessara')).toBe(relationsOf(start, 'halvard', 'kessara'))
    expect(towardHalvard.log.at(-1)).toMatchObject({
      phase: 'rivals',
      text: "Tsengai Republic resents Kessara's turn toward Halvard Compact: relations −3.",
    })

    const towardTsengai = rivalReactions(patchPlayer(start, { stats: { alignment: -10 } }), 0)
    expect(relationsOf(towardTsengai, 'halvard', 'kessara')).toBe(relationsOf(start, 'halvard', 'kessara') - 6)

    const still = patchPlayer(start, { stats: { alignment: 5 } })
    expect(rivalReactions(still, 5)).toBe(still)
  })

  it('follow a trade deal: Halvard relations improve and Tsengai relations worsen', () => {
    const withHalvard = advanceTurn(start, turnWith({ actionId: 'signTradeDeal', targetId: 'halvard' }))
    expect(relationsOf(withHalvard, 'kessara', 'halvard')).toBeGreaterThan(relationsOf(start, 'kessara', 'halvard'))
    expect(relationsOf(withHalvard, 'kessara', 'tsengai')).toBeLessThan(relationsOf(start, 'kessara', 'tsengai'))
    expect(latestNews(withHalvard).find((story) => story.countryId === 'tsengai')?.lines[0]).toBe(
      "Tsengai Republic resents Kessara's turn toward Halvard Compact: relations −3.",
    )

    const withTsengai = advanceTurn(start, turnWith({ actionId: 'signTradeDeal', targetId: 'tsengai' }))
    expect(relationsOf(withTsengai, 'kessara', 'tsengai')).toBeGreaterThan(relationsOf(start, 'kessara', 'tsengai'))
    expect(relationsOf(withTsengai, 'kessara', 'halvard')).toBeLessThan(relationsOf(start, 'kessara', 'halvard'))
  })

  it('turn into covert operations once a great power is hostile, late in the game', () => {
    // Late in the game: its projects are built and trade deals no longer raise its growth.
    const alienated = builtEverything(
      patchStats(withRelations(lateGame, 'tsengai', 'kessara', -70), 'tsengai', { treasury: 3000, growth: 8 }),
      'tsengai',
    )
    const { actions } = rivalTurn(alienated, 'tsengai', createRng(1), 0)
    expect(actions).toContainEqual({ actionId: 'covertOperation', targetId: 'kessara' })
  })
})

describe('the actions a rival can choose from', () => {
  it("never include a trade deal signed on the player's behalf", () => {
    for (const rival of rivals) {
      const options = candidateActions(start, rival.id)
      expect(options).not.toContainEqual({ actionId: 'signTradeDeal', targetId: 'kessara' })
      expect(options).toContainEqual({ actionId: 'diplomaticSummit', targetId: 'kessara' })
    }
  })

  it('never include a deal or summit between the two great powers', () => {
    expect(candidateActions(start, 'halvard').some((action) => action.targetId === 'tsengai')).toBe(false)
    expect(candidateActions(start, 'tsengai').some((action) => action.targetId === 'halvard')).toBe(false)
    expect(candidateActions(start, 'valmora')).toContainEqual({ actionId: 'signTradeDeal', targetId: 'halvard' })
  })
})

describe('a rival turn', () => {
  it('spends at most 4 action points and never takes the same action twice', () => {
    for (const rival of rivals) {
      const { actions } = rivalTurn(start, rival.id, createRng(1))
      expect(actions.length, rival.id).toBeGreaterThan(0)
      expect(actionsCost(actions), rival.id).toBeLessThanOrEqual(4)
      expect(new Set(actions.map(key)).size).toBe(actions.length)
    }
  })

  it('does not repeat an action on the same target within 3 turns', () => {
    for (const rival of rivals) {
      const first = rivalTurn(start, rival.id, createRng(1))
      const taken = new Set(first.actions.map(key))
      let state = first.state
      for (const turn of [start.turn + 1, start.turn + 2]) {
        const next = rivalTurn({ ...state, turn }, rival.id, createRng(turn))
        expect(next.actions.filter((action) => taken.has(key(action))), rival.id).toEqual([])
        state = next.state
      }
    }
  })

  it('takes nothing that is not expected to be worth it', () => {
    // Without noise, replay each rival's moves: each must have scored above the minimum where it was taken.
    for (const rival of rivals) {
      let state = start
      for (const action of rivalTurn(start, rival.id, createRng(1), 0).actions) {
        expect(scoreAction(state, rival.id, action)!, `${rival.id} ${key(action)}`).toBeGreaterThan(
          GAME_DATA.rivals.minimumUtility,
        )
        state = takeAction(state, rival.id, action, createRng(1), 'rivals')
      }
    }
  })

  it('gives the same moves from the same state and seed', () => {
    for (const rival of rivals) {
      expect(rivalTurn(start, rival.id, createRng(9))).toEqual(rivalTurn(start, rival.id, createRng(9)))
    }
  })
})

describe('rising tension', () => {
  it('makes hostile rivals bolder as the game goes on, slowly at first', () => {
    expect(tension({ ...start, turn: 1 })).toBe(0)
    expect(tension({ ...start, turn: 14 })).toBeCloseTo(1 / 27)
    expect(tension({ ...start, turn: 40 })).toBe(1)

    // The same feud: Ostrel holds back early in the game and plots late.
    const feud = (turn: number) =>
      builtEverything(patchStats(withRelations({ ...start, turn }, 'ostrel', 'kessara', -90), 'ostrel', { treasury: 600 }), 'ostrel')
    const covert = { actionId: 'covertOperation', targetId: 'kessara' }
    expect(rivalTurn(feud(5), 'ostrel', createRng(1), 0).actions).not.toContainEqual(covert)
    expect(rivalTurn(feud(36), 'ostrel', createRng(1), 0).actions).toContainEqual(covert)
  })
})

describe('personalities', () => {
  it('make a Hardliner hurt a neighbour it is hostile to, where a Merchant would not', () => {
    const feud = (id: CountryId) =>
      builtEverything(patchStats(withRelations(lateGame, id, 'kessara', -90), id, { treasury: 600 }), id)
    const covert = { actionId: 'covertOperation', targetId: 'kessara' }
    expect(rivalTurn(feud('ostrel'), 'ostrel', createRng(1), 0).actions).toContainEqual(covert)
    expect(rivalTurn(feud('sabu'), 'sabu', createRng(1), 0).actions).not.toContainEqual(covert)
  })

  it('make an Opportunist lean toward whichever power the smaller states favour', () => {
    const loanFrom = (state: GameState, powerId: CountryId) =>
      scoreAction(state, 'valmora', { actionId: 'acceptLoan', targetId: powerId })!

    // At the start the smaller states lean toward Tsengai overall.
    expect(winningSide(start)).toBe(-1)
    expect(loanFrom(start, 'tsengai')).toBeGreaterThan(loanFrom(start, 'halvard'))

    let halvardWinning = start
    for (const id of ['ostrel', 'sabu', 'daranth']) halvardWinning = patchStats(halvardWinning, id, { alignment: 50 })
    expect(winningSide(halvardWinning)).toBe(1)
    expect(loanFrom(halvardWinning, 'halvard')).toBeGreaterThan(loanFrom(halvardWinning, 'tsengai'))
  })

  it('leave both great powers wanting their bloc equally, though Halvard is a Merchant and Tsengai a Hardliner', () => {
    const towardHalvard = patchStats(start, 'valmora', { alignment: start.countries.valmora.stats.alignment + 5 })
    const towardTsengai = patchStats(start, 'valmora', { alignment: start.countries.valmora.stats.alignment - 5 })
    expect(utility(start, towardHalvard, 'halvard')).toBe(utility(start, towardTsengai, 'tsengai'))
    expect(utility(start, towardHalvard, 'halvard')).toBe(GAME_DATA.rivals.greatPowerBloc * 5)
  })

  it('make a Merchant value income and a Hardliner value defence', () => {
    // The same country scored with each personality, so only the weights differ.
    const as = (personality: 'merchant' | 'hardliner') => ({
      ...start,
      countries: { ...start.countries, sabu: { ...start.countries.sabu, personality } },
    })
    const tax = { actionId: 'straitAccess', targetId: 'halvard', option: 'taxed' }
    const arm = { actionId: 'militarySpending' }
    const merchant = as('merchant')
    const hardliner = as('hardliner')
    expect(scoreAction(merchant, 'sabu', tax)!).toBeGreaterThan(scoreAction(hardliner, 'sabu', tax)!)
    expect(scoreAction(hardliner, 'sabu', arm)!).toBeGreaterThan(scoreAction(merchant, 'sabu', arm)!)
  })

  it('make a rival care less about a score that is already high', () => {
    const summit = { actionId: 'diplomaticSummit', targetId: 'halvard' }
    const cool = withRelations(start, 'valmora', 'halvard', 0)
    const warm = withRelations(start, 'valmora', 'halvard', 80)
    expect(scoreAction(cool, 'valmora', summit)!).toBeGreaterThan(scoreAction(warm, 'valmora', summit)!)

    const weak = patchStats(start, 'ostrel', { defence: 20, treasury: 500 })
    const strong = patchStats(start, 'ostrel', { defence: 90, treasury: 500 })
    const arm = { actionId: 'militarySpending' }
    expect(scoreAction(weak, 'ostrel', arm)!).toBeGreaterThan(scoreAction(strong, 'ostrel', arm)!)
  })
})

describe('the rivals phase', () => {
  it('changes nothing with the rivals switched off, so relations no longer drift at random', () => {
    const quiet = quietGame(1)
    expect(rivalsPhase(quiet, createRng(1), quiet.countries.kessara.stats.alignment)).toBe(quiet)
    const next = advanceTurn(quiet, turnWith())
    for (const country of Object.values(quiet.countries)) {
      expect(next.countries[country.id].relations).toEqual(country.relations)
    }
  })

  it('reports what each rival did last turn as the news, grouped by country', () => {
    expect(latestNews(start)).toEqual([])
    const next = advanceTurn(start, turnWith({ actionId: 'signTradeDeal', targetId: 'halvard' }))
    const news = latestNews(next)

    // One story per country that did something, each line taken from that country's log entries.
    const rivalEntries = next.log.filter((entry) => entry.turn === start.turn && entry.phase === 'rivals')
    expect(news.flatMap((story) => story.lines)).toHaveLength(rivalEntries.length)
    expect(new Set(news.map((story) => story.countryId)).size).toBe(news.length)
    expect(news.map((story) => story.countryId)).not.toContain('kessara')

    // A move reads without the country's name in front; the story already names it.
    const halvard = news.find((story) => story.countryId === 'halvard')!
    const move = rivalEntries.find((entry) => entry.actorId === 'halvard')!.text
    expect(halvard.name).toBe('Halvard Compact')
    expect(halvard.lines[0]).toBe(move.replace('Halvard Compact: ', ''))
  })
})
