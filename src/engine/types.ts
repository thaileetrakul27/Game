// Core data types for the Faultlines engine. See DESIGN.md, "World model".

export const MAX_TURNS = 40
export const ACTION_POINTS_PER_TURN = 4
/** The player defaults after this many turns in a row with treasury below zero. */
export const DEFAULT_AFTER_DEFICIT_TURNS = 2

export type CountryId = string

/** Weights how a computer-controlled country chooses actions. */
export type Personality = 'opportunist' | 'hardliner' | 'merchant'

/** Great powers anchor the alignment scale: Halvard at +100, Tsengai at -100. */
export type CountryKind = 'greatPower' | 'minor'

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

export type StatKey = keyof Stats

/** The fixed parts of a country's income. See economy.ts for the formula. */
export interface Economy {
  /** Output per turn before growth is applied. */
  baseOutput: number
  /** Running costs paid every turn. */
  upkeep: number
  /** Toll income from strait traffic every turn. */
  straitTolls: number
}

export type EconomyField = keyof Economy

/** An infrastructure project a country has started. */
export interface ProjectProgress {
  /** Id of a project defined in src/data/projects.json. */
  projectId: string
  /** The project completes during this turn's resolution. */
  completesOnTurn: number
}

export interface Country {
  id: CountryId
  name: string
  description: string
  kind: CountryKind
  /** Null for the human player's country. */
  personality: Personality | null
  stats: Stats
  economy: Economy
  /** Relations with every other country, -100 to 100. */
  relations: Record<CountryId, number>
  projects: ProjectProgress[]
}

// ---- Content loaded from src/data ----

/** Who an action can be aimed at. No action can target its own country. */
export type ActionTarget = 'none' | 'any' | 'greatPower' | 'minor'

/** One change an action, option or project makes. */
export type Effect =
  /** Add to a stat of the acting country or the target. */
  | { kind: 'stat'; who: 'self' | 'target'; stat: StatKey; amount: number }
  /** Add to an economy field of the acting country or the target. */
  | { kind: 'economy'; who: 'self' | 'target'; field: EconomyField; amount: number }
  /**
   * Change relations both ways between the actor and the target, or the
   * great power on the other side from the target.
   */
  | { kind: 'relations'; with: 'target' | 'otherGreatPower'; amount: number }
  /** Pull the smaller party's alignment toward the other's by up to amount. */
  | { kind: 'alignment'; amount: number }
  /** Pay for and begin an infrastructure project. */
  | { kind: 'startProject'; projectId: string }
  /** With the given probability, log the text and apply the effects. */
  | { kind: 'chance'; probability: number; text: string; effects: Effect[] }

export interface ActionOption {
  id: string
  name: string
  effects: Effect[]
}

export interface ActionDef {
  id: string
  name: string
  /** Action points. */
  cost: number
  description: string
  target: ActionTarget
  /** Applied every time the action is taken. */
  effects: Effect[]
  /** When present, the player picks one option and its effects apply too. */
  options?: ActionOption[]
}

export interface ProjectDef {
  id: string
  name: string
  description: string
  /** Paid from the treasury when building starts. */
  cost: number
  /** Turns to build, counting the turn it starts. */
  turns: number
  /** Applied once on completion, so they last for the rest of the game. */
  effects: Effect[]
}

export interface EconomyRules {
  /** Share of debt paid as interest each turn. */
  interestRatePerTurn: number
  growthMin: number
  growthMax: number
}

/** Country data as written in src/data/countries.json. */
export type CountryDef = Omit<Country, 'projects'>

export interface GameData {
  countries: Country[]
  actions: ActionDef[]
  projects: ProjectDef[]
  economy: EconomyRules
}

// ---- Turns and game state ----

export interface PlayerAction {
  /** Id of an action defined in src/data/actions.json. */
  actionId: string
  targetId?: CountryId
  /** Id of one of the action's options, for actions that have them. */
  option?: string
}

/** Everything the player decides for one turn, submitted together. */
export interface PlayerTurn {
  /** Id of the chosen response to the pending crisis, or null when there is none. */
  crisisResponse: string | null
  actions: PlayerAction[]
}

/** A crisis card drawn ahead of its turn, so the player sees it before acting. */
export interface PendingCrisis {
  /** Id of an event card defined in src/data. */
  cardId: string
  /** Ids of the responses the player can choose from. */
  responseIds: string[]
}

export type Phase = 'briefing' | 'crisis' | 'actions' | 'rivals' | 'resolution'

export interface LogEntry {
  turn: number
  phase: Phase
  text: string
}

export type GameStatus = 'playing' | 'ended'

/** Why the game ended. Endings and their scoring arrive in milestone 7. */
export type EndReason = 'turnLimit' | 'default'

export interface GameState {
  /** The seed the game started from, so it can be replayed exactly. */
  seed: number
  /** Current position of the seeded random generator. */
  rngState: number
  /** The turn about to be played, 1 to MAX_TURNS. Each turn is a quarter. */
  turn: number
  status: GameStatus
  /** Null while the game is being played. */
  endReason: EndReason | null
  playerId: CountryId
  /** Action points available to the player this turn. */
  actionPoints: number
  /** Turns in a row the player's treasury has ended below zero. */
  deficitTurns: number
  /** The crisis card for this turn, drawn at the end of the previous one. */
  crisis: PendingCrisis | null
  countries: Record<CountryId, Country>
  log: LogEntry[]
}
