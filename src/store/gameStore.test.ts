import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_TURNS } from '../engine/index.ts'
import { patchPlayer } from '../engine/testHelpers.ts'
import { pointsLeft, unanswered, useGameStore } from './gameStore.ts'

const store = () => useGameStore.getState()

/** Answer the crisis card and any demand, as a player must before ending the turn. */
function answerPending(): void {
  const { crisis, demand } = store().game
  if (crisis) store().chooseCrisisResponse(crisis.responseIds[0])
  if (demand) store().chooseDemandResponse('refuse')
}

describe('game store', () => {
  beforeEach(() => store().newGame(1))

  it('plays 40 turns end to end', () => {
    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      expect(store().game.status).toBe('playing')
      answerPending()
      expect(unanswered(store())).toEqual([])
      const partner = turn % 2 === 1 ? 'halvard' : 'tsengai'
      expect(store().planAction({ actionId: 'signTradeDeal', targetId: partner })).toBeNull()
      expect(store().planAction({ actionId: 'diplomaticSummit', targetId: 'valmora' })).toBeNull()
      store().endTurn()
    }
    expect(store().game.status).toBe('ended')
    expect(store().game.endReason).toBe('turnLimit')
  })

  it('spends action points as actions are planned and refuses to overspend', () => {
    expect(pointsLeft(store())).toBe(4)
    expect(store().planAction({ actionId: 'buildInfrastructure', option: 'powerGrid' })).toBeNull()
    expect(store().planAction({ actionId: 'domesticReform' })).toBeNull()
    expect(pointsLeft(store())).toBe(0)

    expect(store().planAction({ actionId: 'militarySpending' })).toBe('Needs 1 point, only 0 left')
    expect(store().planned).toHaveLength(2)
  })

  it('ends the turn with the planned actions and clears the plan', () => {
    store().planAction({ actionId: 'militarySpending' })
    answerPending()
    store().endTurn()
    expect(store().game.turn).toBe(2)
    expect(store().planned).toEqual([])
    expect(store().game.log).toContainEqual({ turn: 1, phase: 'actions', text: 'Kessara: Military spending.', actorId: 'kessara' })
  })

  it('drops planned actions that stop working when an earlier one is removed', () => {
    // Owing Halvard nothing, repaying it only works after borrowing from it.
    useGameStore.setState({ game: patchPlayer(store().game, { creditors: {} }) })
    expect(store().planAction({ actionId: 'acceptLoan', targetId: 'halvard' })).toBeNull()
    expect(store().planAction({ actionId: 'repayDebt', targetId: 'halvard' })).toBeNull()
    expect(store().planAction({ actionId: 'militarySpending' })).toBeNull()

    store().unplanAction(0)
    expect(store().planned).toEqual([{ actionId: 'militarySpending' }])
  })

  it('lists what must be answered before the turn can end', () => {
    useGameStore.setState({
      game: {
        ...store().game,
        crisis: { cardId: 'generalStrike', responseIds: ['meetDemands', 'breakStrike'], targetId: null },
        demand: { demandId: 'navalBase', fromId: 'halvard' },
      },
    })
    expect(unanswered(store())).toEqual(['the demand', 'the crisis'])
    store().chooseDemandResponse('accept')
    store().chooseCrisisResponse('meetDemands')
    expect(unanswered(store())).toEqual([])
    store().endTurn()
    expect(store().game.demandsAccepted.halvard).toBe(1)
    expect(store().demandResponse).toBeNull()
  })

  it('starts a new game from a seed', () => {
    store().selectCountry('ostrel')
    store().planAction({ actionId: 'militarySpending' })
    answerPending()
    store().endTurn()
    store().newGame(5)
    expect(store().game.seed).toBe(5)
    expect(store().game.turn).toBe(1)
    expect(store().planned).toEqual([])
    expect(store().selectedCountryId).toBeNull()
  })
})
