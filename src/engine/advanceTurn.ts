import { actionsPhase, crisisPhase, resolutionPhase, rivalsPhase, startTurn } from './phases.ts'
import { createRng } from './rng.ts'
import type { GameState, PlayerTurn } from './types.ts'

/**
 * End the player's turn and return the new state.
 * The turn's briefing has already run and its crisis card is in state.crisis,
 * so the player submits all of their choices at once: the crisis response and
 * the actions to take. This plays the crisis, actions, rival moves and
 * resolution phases, then opens the next turn with its briefing and crisis card.
 * Pure: the input state is never mutated, and the same state and choices
 * always give the same result.
 */
export function advanceTurn(state: GameState, playerTurn: PlayerTurn): GameState {
  if (state.status !== 'playing') throw new Error('The game has already ended')

  const rng = createRng(state.rngState)
  let next = crisisPhase(state, playerTurn.crisisResponse)
  next = actionsPhase(next, playerTurn.actions)
  next = rivalsPhase(next, rng)
  next = resolutionPhase(next)
  if (next.status === 'playing') next = startTurn(next, rng)
  return { ...next, rngState: rng.state }
}
