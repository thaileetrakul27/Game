import { actionsPhase, briefingPhase, crisisPhase, resolutionPhase, rivalsPhase } from './phases.ts'
import { createRng } from './rng.ts'
import type { GameState, PlayerTurn } from './types.ts'

/**
 * Play one turn: run the five phases in order and return the new state.
 * The player submits all of the turn's choices at once: the response to the
 * crisis card already in state.crisis, and the actions to take.
 * Pure: the input state is never mutated, and the same state and choices
 * always give the same result.
 */
export function advanceTurn(state: GameState, playerTurn: PlayerTurn): GameState {
  if (state.status !== 'playing') throw new Error('The game has already ended')

  const rng = createRng(state.rngState)
  let next = briefingPhase(state)
  next = crisisPhase(next, playerTurn.crisisResponse)
  next = actionsPhase(next, playerTurn.actions)
  next = rivalsPhase(next, rng)
  next = resolutionPhase(next, rng)
  return { ...next, rngState: rng.state }
}
