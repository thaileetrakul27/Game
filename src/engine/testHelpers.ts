// Helpers shared by the engine tests.

import type { Economy, GameState, PlayerAction, PlayerTurn, Stats } from './types.ts'

/** A turn with no crisis response and the given actions. */
export function turnWith(...actions: PlayerAction[]): PlayerTurn {
  return { crisisResponse: null, actions }
}

/** Overwrite some of the player's stats or economy, to set up a test. */
export function patchPlayer(
  state: GameState,
  patch: { stats?: Partial<Stats>; economy?: Partial<Economy> },
): GameState {
  const player = state.countries[state.playerId]
  return {
    ...state,
    countries: {
      ...state.countries,
      [player.id]: {
        ...player,
        stats: { ...player.stats, ...patch.stats },
        economy: { ...player.economy, ...patch.economy },
      },
    },
  }
}
