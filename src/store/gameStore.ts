// The game store. The interface reads the game from here and sends the
// player's choices back. Every rule runs in the engine.

import { create } from 'zustand'
import { actionsCost, advanceTurn, checkActions, createGameState } from '../engine/index.ts'
import type { GameState, PlayerAction } from '../engine/index.ts'

export interface GameStore {
  game: GameState
  /** Actions planned for this turn. They are taken when the turn ends. */
  planned: PlayerAction[]
  /** The chosen response to this turn's crisis card, if there is one. */
  crisisResponse: string | null
  /** Start a new game. Without a seed, one is taken from the clock. */
  newGame: (seed?: number) => void
  /** Add an action to this turn's plan. Returns why it can't be added, or null if it was. */
  planAction: (action: PlayerAction) => string | null
  /** Remove a planned action, and any later ones that no longer work without it. */
  unplanAction: (index: number) => void
  chooseCrisisResponse: (responseId: string) => void
  /** Take the planned actions and play the rest of the turn. */
  endTurn: () => void
}

function freshGame(seed: number): Pick<GameStore, 'game' | 'planned' | 'crisisResponse'> {
  return { game: createGameState({ seed }), planned: [], crisisResponse: null }
}

export const useGameStore = create<GameStore>()((set, get) => ({
  ...freshGame(Date.now()),

  newGame: (seed = Date.now()) => set(freshGame(seed)),

  planAction: (action) => {
    const { game, planned } = get()
    const problem = checkActions(game, [...planned, action])
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

  endTurn: () => {
    const { game, planned, crisisResponse } = get()
    set({ game: advanceTurn(game, { crisisResponse, actions: planned }), planned: [], crisisResponse: null })
  },
}))

/** Action points left after the planned actions. */
export function pointsLeft({ game, planned }: Pick<GameStore, 'game' | 'planned'>): number {
  return game.actionPoints - actionsCost(planned)
}
