// Helpers shared by the engine tests.

import { createGameState } from './createGameState.ts'
import type { CountryId, Economy, GameState, PlayerAction, PlayerTurn, Stats } from './types.ts'

/**
 * A new game with the rivals, the event deck and the variety between games
 * switched off, so a test sees only the data's starting values and the
 * effects of the player's own choices and the rule it is checking.
 */
export function quietGame(seed = 1): GameState {
  return createGameState({ seed, settings: { rivals: false, events: false, variety: false } })
}

/** A turn with no crisis response and the given actions. */
export function turnWith(...actions: PlayerAction[]): PlayerTurn {
  return { crisisResponse: null, actions }
}

/**
 * A turn with the given actions that also answers whatever is pending: the
 * first response to a crisis card, a refusal of any demand and a refusal of
 * any offer.
 */
export function turnAnswering(state: GameState, ...actions: PlayerAction[]): PlayerTurn {
  return {
    crisisResponse: state.crisis?.responseIds[0] ?? null,
    demandResponse: state.demand ? 'refuse' : null,
    offerResponse: state.offer ? 'decline' : null,
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
