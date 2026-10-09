import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_TURNS } from '../engine/index.ts'
import { patchPlayer } from '../engine/testHelpers.ts'
import { pointsLeft, useGameStore } from './gameStore.ts'

const store = () => useGameStore.getState()

describe('game store', () => {
  beforeEach(() => store().newGame(1))

  it('plays 40 turns end to end', () => {
    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      expect(store().game.status).toBe('playing')
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
    store().endTurn()
    expect(store().game.turn).toBe(2)
    expect(store().planned).toEqual([])
    expect(store().game.log).toContainEqual({ turn: 1, phase: 'actions', text: 'Kessara: Military spending.' })
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

  it('starts a new game from a seed', () => {
    store().selectCountry('ostrel')
    store().planAction({ actionId: 'militarySpending' })
    store().endTurn()
    store().newGame(5)
    expect(store().game.seed).toBe(5)
    expect(store().game.turn).toBe(1)
    expect(store().planned).toEqual([])
    expect(store().selectedCountryId).toBeNull()
  })
})
