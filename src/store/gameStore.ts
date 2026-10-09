// The game store. The interface reads the game from here and sends the
// player's choices back. Every rule runs in the engine.

import { create } from 'zustand'
import { actionsCost, advanceTurn, checkActions, checkPlannedAction, createGameState } from '../engine/index.ts'
import type { CountryId, DemandResponse, GameState, PlayerAction } from '../engine/index.ts'

export interface GameStore {
  game: GameState
  /** Actions planned for this turn. They are taken when the turn ends. */
  planned: PlayerAction[]
  /** The chosen response to this turn's crisis card, if there is one. */
  crisisResponse: string | null
  /** The chosen answer to a pending demand, if there is one. */
  demandResponse: DemandResponse | null
  /** The country picked on the map, whose stats and relations are shown. */
  selectedCountryId: CountryId | null
  /** Start a new game. Without a seed, one is taken from the clock. */
  newGame: (seed?: number) => void
  /** Add an action to this turn's plan. Returns why it can't be added, or null if it was. */
  planAction: (action: PlayerAction) => string | null
  /** Remove a planned action, and any later ones that no longer work without it. */
  unplanAction: (index: number) => void
  chooseCrisisResponse: (responseId: string) => void
  chooseDemandResponse: (response: DemandResponse) => void
  selectCountry: (id: CountryId | null) => void
  /** Take the planned actions and play the rest of the turn. */
  endTurn: () => void
}

type Fresh = Pick<GameStore, 'game' | 'planned' | 'crisisResponse' | 'demandResponse' | 'selectedCountryId'>

function freshGame(seed: number): Fresh {
  return { game: createGameState({ seed }), planned: [], crisisResponse: null, demandResponse: null, selectedCountryId: null }
}

export const useGameStore = create<GameStore>()((set, get) => ({
  ...freshGame(Date.now()),

  newGame: (seed = Date.now()) => set(freshGame(seed)),

  planAction: (action) => {
    const { game, planned } = get()
    const problem = checkPlannedAction(game, planned, action)
    if (problem === null) set({ planned: [...planned, action] })
    return problem
  },

  unplanAction: (index) => {
    const { game, planned } = get()
    const kept: PlayerAction[] = []
    for (const action of planned.filter((_, i) => i !== index)) {
      if (checkActions(game, [...kept, action]) === null) kept.push(action)
    }
    set({ planned: kept })
  },

  chooseCrisisResponse: (responseId) => set({ crisisResponse: responseId }),

  chooseDemandResponse: (response) => set({ demandResponse: response }),

  selectCountry: (id) => set({ selectedCountryId: id }),

  endTurn: () => {
    const { game, planned, crisisResponse, demandResponse } = get()
    set({
      game: advanceTurn(game, { crisisResponse, demandResponse, actions: planned }),
      planned: [],
      crisisResponse: null,
      demandResponse: null,
    })
  },
}))

/** What still needs answering before the turn can end, or an empty list when nothing does. */
export function unanswered({ game, crisisResponse, demandResponse }: Pick<GameStore, 'game' | 'crisisResponse' | 'demandResponse'>): string[] {
  const missing: string[] = []
  if (game.demand && !demandResponse) missing.push('the demand')
  if (game.crisis && !crisisResponse) missing.push('the crisis')
  return missing
}

/** Action points left after the planned actions. */
export function pointsLeft({ game, planned }: Pick<GameStore, 'game' | 'planned'>): number {
  return game.actionPoints - actionsCost(planned)
}
