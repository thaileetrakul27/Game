// Helpers shared by the engine tests.

import type { CountryId, Economy, GameState, PlayerAction, PlayerTurn, Stats } from './types.ts'

/** A turn with no crisis response and the given actions. */
export function turnWith(...actions: PlayerAction[]): PlayerTurn {
  return { crisisResponse: null, actions }
}

/**
 * A turn with the given actions that also answers whatever is pending: the
 * first response to a crisis card, and a refusal of any demand.
 */
export function turnAnswering(state: GameState, ...actions: PlayerAction[]): PlayerTurn {
  return {
    crisisResponse: state.crisis?.responseIds[0] ?? null,
    demandResponse: state.demand ? 'refuse' : null,
    actions,
  }
}

/** Overwrite some of the player's stats, economy or creditors, to set up a test. */
export function patchPlayer(
  state: GameState,
  patch: { stats?: Partial<Stats>; economy?: Partial<Economy>; creditors?: Record<CountryId, number> },
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
        creditors: patch.creditors ?? player.creditors,
      },
    },
  }
}
