import { GAME_DATA } from './data.ts'
import { startTurn } from './phases.ts'
import { createRng, normaliseSeed } from './rng.ts'
import { ACTION_POINTS_PER_TURN } from './types.ts'
import type { Country, CountryId, GameState } from './types.ts'

/** The player's country. See DESIGN.md, "Concept". */
const DEFAULT_PLAYER_ID = 'kessara'

export interface NewGameOptions {
  seed: number
  /** Defaults to Kessara. */
  playerId?: CountryId
  /** Defaults to the countries in src/data/countries.json. */
  countries?: readonly Country[]
}

/** Build the state for turn 1 of a new game, with turn 1's briefing and crisis card. */
export function createGameState({
  seed,
  playerId = DEFAULT_PLAYER_ID,
  countries = GAME_DATA.countries,
}: NewGameOptions): GameState {
  if (!countries.some((country) => country.id === playerId)) {
    throw new Error(`Unknown player country: ${playerId}`)
  }

  const rng = createRng(seed)
  const state: GameState = {
    seed: normaliseSeed(seed),
    rngState: normaliseSeed(seed),
    turn: 1,
    status: 'playing',
    endReason: null,
    playerId,
    actionPoints: ACTION_POINTS_PER_TURN,
    deficitTurns: 0,
    crisis: null,
    // Copy so the game never shares objects with the caller's data.
    countries: Object.fromEntries(countries.map((country) => [country.id, structuredClone(country)])),
    log: [],
  }
  const opened = startTurn(state, rng)
  return { ...opened, rngState: rng.state }
}
