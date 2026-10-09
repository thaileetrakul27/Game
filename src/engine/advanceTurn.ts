import { actionsPhase, briefingPhase, crisisPhase, resolutionPhase, rivalsPhase } from './phases.ts'
import { createRng } from './rng.ts'
import type { GameState, PlayerAction } from './types.ts'

/**
 * Play one turn: run the five phases in order and return the new state.
 * Pure: the input state is never mutated, and the same state and actions
 * always give the same result.
 */
export function advanceTurn(state: GameState, playerActions: readonly PlayerAction[]): GameState {
  if (state.status !== 'playing') throw new Error('The game has already ended')

  const rng = createRng(state.rngState)
  let next = briefingPhase(state)
  next = crisisPhase(next)
  next = actionsPhase(next, playerActions)
  next = rivalsPhase(next, rng)
  next = resolutionPhase(next)
  return { ...next, rngState: rng.state }
}
