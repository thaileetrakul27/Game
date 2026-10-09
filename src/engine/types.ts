// Core data types for the Faultlines engine. See DESIGN.md, "World model".

export const MAX_TURNS = 40
export const ACTION_POINTS_PER_TURN = 4

export type CountryId = string

/** Weights how a computer-controlled country chooses actions. */
export type Personality = 'opportunist' | 'hardliner' | 'merchant'

/** The seven stats every country runs on, player and rivals alike. */
export interface Stats {
  /** Money on hand. Below zero for 2 turns in a row means default. */
  treasury: number
  /** Money owed. Interest drains treasury each turn. */
  debt: number
  /** Percent. Sets next turn's income. */
  growth: number
  /** 0 to 100. Below 20 risks a coup. */
  legitimacy: number
  /** 0 to 100. Below 30 risks a coup. */
  militaryLoyalty: number
  /** 0 to 100. Deters invasion and blockades. */
  defence: number
  /** -100 (Tsengai) to +100 (Halvard). */
  alignment: number
}

export interface Country {
  id: CountryId
  name: string
  /** Null for the human player's country. */
  personality: Personality | null
  stats: Stats
  /** Relations with every other country, -100 to 100. */
  relations: Record<CountryId, number>
}

export interface PlayerAction {
  /** Id of an action defined in src/data. */
  actionId: string
  targetId?: CountryId
}

export type Phase = 'briefing' | 'crisis' | 'actions' | 'rivals' | 'resolution'

export interface LogEntry {
  turn: number
  phase: Phase
  text: string
}

export type GameStatus = 'playing' | 'ended'

export interface GameState {
  /** The seed the game started from, so it can be replayed exactly. */
  seed: number
  /** Current position of the seeded random generator. */
  rngState: number
  /** The turn about to be played, 1 to MAX_TURNS. Each turn is a quarter. */
  turn: number
  status: GameStatus
  playerId: CountryId
  /** Action points available to the player this turn. */
  actionPoints: number
  countries: Record<CountryId, Country>
  log: LogEntry[]
}
