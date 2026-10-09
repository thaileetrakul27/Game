import type { Rng } from './rng.ts'
import type { GameState, PendingCrisis } from './types.ts'

/**
 * Draw the crisis card for the coming turn. Called when a game starts and at
 * the end of every turn, so the player always sees the card before acting.
 */
export function drawCrisis(_state: GameState, _rng: Rng): PendingCrisis | null {
  // Stub: the weighted, conditional event deck arrives in milestone 6.
  return null
}
