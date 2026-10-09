import { drawCrisis } from './crisis.ts'
import { createRng, normaliseSeed } from './rng.ts'
import { ACTION_POINTS_PER_TURN } from './types.ts'
import type { Country, CountryId, GameState } from './types.ts'

export interface NewGameOptions {
  seed: number
  playerId: CountryId
  /** Starting countries, normally loaded from src/data. */
  countries: readonly Country[]
}

/** Build the state for turn 1 of a new game, including turn 1's crisis card. */
export function createGameState({ seed, playerId, countries }: NewGameOptions): GameState {
  if (!countries.some((country) => country.id === playerId)) {
    throw new Error(`Unknown player country: ${playerId}`)
  }

  const rng = createRng(seed)
  const state: GameState = {
    seed: normaliseSeed(seed),
    rngState: normaliseSeed(seed),
    turn: 1,
    status: 'playing',
    playerId,
    actionPoints: ACTION_POINTS_PER_TURN,
    crisis: null,
    // Copy so the game never shares objects with the caller's data.
    countries: Object.fromEntries(countries.map((country) => [country.id, structuredClone(country)])),
    log: [],
  }
  const crisis = drawCrisis(state, rng)
  return { ...state, crisis, rngState: rng.state }
}
