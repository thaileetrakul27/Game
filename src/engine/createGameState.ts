import { GAME_DATA } from './data.ts'
import { startTurn } from './phases.ts'
import { createRng, normaliseSeed } from './rng.ts'
import { withLog } from './state.ts'
import { ACTION_POINTS_PER_TURN } from './types.ts'
import type { Country, CountryId, FactionId, GameSettings, GameState } from './types.ts'
import { varyNeighbours } from './variety.ts'

/** The player's country. See DESIGN.md, "Concept". */
const DEFAULT_PLAYER_ID = 'kessara'

export interface NewGameOptions {
  seed: number
  /** Defaults to Kessara. */
  playerId?: CountryId
  /** Defaults to the countries in src/data/countries.json. */
  countries?: readonly Country[]
  /** Switch off the computer rivals, the event deck or the variety between games. All are on by default. */
  settings?: Partial<GameSettings>
}

function startingFactions(): Record<FactionId, number> {
  const entries = GAME_DATA.factions.factions.map((faction) => [faction.id, faction.start])
  return Object.fromEntries(entries) as Record<FactionId, number>
}

/** Every great power starts with open access to every strait. */
function openStraits(): GameState['straitAccess'] {
  const access: GameState['straitAccess'] = {}
  for (const strait of GAME_DATA.straits) {
    access[strait.id] = Object.fromEntries(Object.keys(strait.traffic).map((powerId) => [powerId, 'open' as const]))
  }
  return access
}

/** Build the state for turn 1 of a new game, with turn 1's briefing and crisis card. */
export function createGameState({
  seed,
  playerId = DEFAULT_PLAYER_ID,
  countries = GAME_DATA.countries,
  settings = {},
}: NewGameOptions): GameState {
  if (!countries.some((country) => country.id === playerId)) {
    throw new Error(`Unknown player country: ${playerId}`)
  }

  const rng = createRng(seed)
  const allSettings: GameSettings = { rivals: true, events: true, variety: true, ...settings }
  // Copy so the game never shares objects with the caller's data.
  const copied = Object.fromEntries(countries.map((country) => [country.id, structuredClone(country)]))
  const varied = allSettings.variety ? varyNeighbours(copied, playerId, rng) : { countries: copied, texts: [] }
  const state: GameState = {
    seed: normaliseSeed(seed),
    rngState: normaliseSeed(seed),
    turn: 1,
    status: 'playing',
    endReason: null,
    playerId,
    actionPoints: ACTION_POINTS_PER_TURN,
    deficitTurns: 0,
    settings: allSettings,
    crisis: null,
    chains: [],
    lastDrawn: {},
    tradeDeals: [],
    rivalHistory: {},
    demand: null,
    offer: null,
    demandTurns: 0,
    demandsAccepted: {},
    brokerTurns: 0,
    factions: startingFactions(),
    straitAccess: openStraits(),
    countries: varied.countries,
    log: [],
  }
  const opened = startTurn(withLog(state, 'briefing', varied.texts), rng)
  return { ...opened, rngState: rng.state }
}
