import { actionsCost } from './actions.ts'
import { getAction } from './data.ts'
import { actionsPhase, crisisPhase, resolutionPhase, rivalsPhase, startTurn } from './phases.ts'
import { createRng } from './rng.ts'
import type { GameState, PlayerAction, PlayerTurn } from './types.ts'

/**
 * End the player's turn and return the new state.
 * The turn's briefing has already run, and its crisis card and any demand are
 * in the state, so the player submits all of their choices at once: the
 * crisis response, the answer to a demand, and the actions to take. This plays the crisis, actions, rival moves and
 * resolution phases, then opens the next turn with its briefing and crisis card.
 * Pure: the input state is never mutated, and the same state and choices
 * always give the same result.
 */
export function advanceTurn(state: GameState, playerTurn: PlayerTurn): GameState {
  if (state.status !== 'playing') throw new Error('The game has already ended')

  const rng = createRng(state.rngState)
  const alignmentAtStart = state.countries[state.playerId].stats.alignment
  let next = crisisPhase(state, playerTurn, rng)
  next = actionsPhase(next, playerTurn.actions, rng)
  next = rivalsPhase(next, rng, alignmentAtStart)
  next = resolutionPhase(next, rng, alignmentAtStart)
  if (next.status === 'playing') next = startTurn(next, rng)
  return { ...next, rngState: rng.state }
}

/**
 * Why the player can't add this action to the actions already planned, or
 * null if they can. A shortage of action points reads "Needs 2 points, only
 * 1 left". Every other problem comes from the same checks as checkActions.
 */
export function checkPlannedAction(
  state: GameState,
  planned: readonly PlayerAction[],
  action: PlayerAction,
): string | null {
  const left = state.actionPoints - actionsCost(planned)
  const cost = getAction(action.actionId).cost
  if (cost > left) return `Needs ${cost} ${cost === 1 ? 'point' : 'points'}, only ${left} left`
  return checkActions(state, [...planned, action])
}

/**
 * Why the player can't take these actions this turn, or null if they can.
 * Runs the engine's own actions phase and throws the result away, so the
 * interface can check choices without repeating any rules.
 */
export function checkActions(state: GameState, actions: readonly PlayerAction[]): string | null {
  try {
    actionsPhase(state, actions, createRng(state.rngState))
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
