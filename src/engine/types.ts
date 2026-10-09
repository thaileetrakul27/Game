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

/** The player's domestic factions. See DESIGN.md, "Domestic politics". */
export type FactionId = 'generals' | 'business' | 'reformers'

/** How a power's ships may use a strait. */
export type StraitAccess = 'open' | 'taxed' | 'closed'

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
  /** Extra toll income every turn from projects such as a port, on top of what the country's straits earn. */
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
  /**
   * The part of stats.debt owed to each great power. The rest is owed to
   * lenders outside the region.
   */
  creditors: Record<CountryId, number>
  /** Relations with every other country, -100 to 100. */
  relations: Record<CountryId, number>
  projects: ProjectProgress[]
}

// ---- Content loaded from src/data ----

/** Who an action can be aimed at. No action can target its own country. */
export type ActionTarget = 'none' | 'any' | 'greatPower' | 'minor'

/**
 * One change an action, option, project or event card makes. Where an effect
 * can name "country", its country field says which one.
 */
export type Effect =
  /** Add to a stat of the acting country or the target. Debt changes only through borrow and repayDebt. */
  | { kind: 'stat'; who: 'self' | 'target' | 'country'; country?: CountryId; stat: StatKey; amount: number }
  /** Add to an economy field of the acting country or the target. */
  | { kind: 'economy'; who: 'self' | 'target'; field: EconomyField; amount: number }
  /**
   * Change relations both ways between the actor and the target, or the
   * great power on the other side from the target.
   */
  | { kind: 'relations'; with: 'target' | 'otherGreatPower' | 'country'; country?: CountryId; amount: number }
  /**
   * Pull the smaller party's alignment toward the other's by up to amount.
   * A negative amount pushes it away instead.
   */
  | { kind: 'alignment'; amount: number; toward?: 'target' | 'otherGreatPower' | 'country'; country?: CountryId }
  /** Borrow from the target great power: cash now, owed to that power. */
  | { kind: 'borrow'; amount: number }
  /** Pay the target great power up to amount of what is owed to it, from the treasury. */
  | { kind: 'repayDebt'; amount: number }
  /** Pay for and begin an infrastructure project. */
  | { kind: 'startProject'; projectId: string }
  /** Change the player's faction satisfaction. Has no effect when a computer rival acts. */
  | { kind: 'faction'; faction: FactionId; amount: number }
  /** Set the target great power's access to the strait the actor owns. */
  | { kind: 'straitAccess'; access: StraitAccess }
  /** The target great power demands back everything the actor owes it, at once. */
  | { kind: 'recallLoans' }
  /** The target great power writes off up to amount of what the actor owes it. */
  | { kind: 'forgiveDebt'; amount: number }
  /**
   * Sign a trade deal with the target that raises the actor's growth by growth
   * and the target's by partnerGrowth, for turns turns. Two countries can have
   * only one active deal between them.
   */
  | { kind: 'tradeDeal'; turns: number; growth: number; partnerGrowth: number }
  /** With the given probability, log the text and apply the effects. */
  | { kind: 'chance'; probability: number; text: string; effects: Effect[] }

export interface ActionOption {
  id: string
  name: string
  effects: Effect[]
}

/** Who may take an action. A field left out allows anyone. */
export interface ActionActor {
  kind?: CountryKind
  personality?: Personality
}

/**
 * Terms of an action that offers something to its target, which accepts or
 * declines. The effects apply from the receiver's side: "self" is the
 * receiver and "target" the country making the offer.
 */
export interface OfferDef {
  /** What the receiver sees the offer called, such as "Investment package". */
  name: string
  /** The offer as the receiver sees it. */
  description: string
  accepted: Effect[]
  declined: Effect[]
}

export interface ActionDef {
  id: string
  name: string
  /** Action points. */
  cost: number
  description: string
  target: ActionTarget
  /** Only these countries may take the action. */
  actor?: ActionActor
  /** The action is an offer: its target accepts or declines, and the effects are in here. */
  offer?: OfferDef
  /** A power that has cut trade with the actor refuses this action. */
  blockedByTradeCut?: boolean
  /** Aimed at the player, this needs the player's agreement, so computer rivals never choose it. */
  playerMustAgree?: boolean
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

/** A sea chokepoint that regional trade passes through. */
export interface StraitDef {
  id: string
  name: string
  description: string
  /** The country on its shore, which sets access and earns the tolls. */
  controlledBy: CountryId
  /** Percent of regional trade passing through it at the start of the game. */
  tradeShare: number
  /** Percent of the strait's traffic sent by each great power. Adds up to 100. */
  traffic: Record<CountryId, number>
}

export interface StraitControlRules {
  /** Toll earned each turn per percentage point of regional trade, at open access. */
  tollPerTradeShare: number
  /** Taxed traffic pays this many times the open toll. */
  taxedTollMultiplier: number
  /** Chance each turn that a power shut out of the strait strikes back, before defence. */
  closureRiskBase: number
  /** Each point of the owner's defence lowers that chance by this much. */
  closureRiskLessPerDefence: number
  /** What a shut-out power may do. The target of the effects is that power. */
  closureEvents: { id: string; name: string; text: string; effects: Effect[] }[]
}

export interface HedgingRules {
  driftPerTurn: number
  tradeCutPast: number
  /** Share of output lost while a power cuts trade. */
  tradeCutOutputLoss: number
  courtingRelations: number
  courtingAlignment: number
  demandPast: number
  demandAfterTurns: number
  vassalAfterDemands: number
  brokerWithin: number
  brokerEveryTurns: number
  brokerBonusPoints: number
  /** Effects of refusing a demand. The target is the patron. */
  demandRefusal: Effect[]
}

/** A demand a patron can make. The target of its effects is the patron. */
export interface DemandDef {
  id: string
  name: string
  description: string
  /** Effects of accepting. */
  accept: Effect[]
}

export interface FactionDef {
  id: FactionId
  name: string
  description: string
  /** Satisfaction at the start of the game, 0 to 100. */
  start: number
  /** Event card the faction can trigger while in unrest. */
  crisisCard: string
}

export interface FactionRules {
  /** A faction below this satisfaction is in unrest. */
  unrestBelow: number
  /** Chance each turn that a faction in unrest triggers its crisis card. */
  unrestCrisisChance: number
  factions: FactionDef[]
}

/** A test on the game state. above and below are strict: above 40 means more than 40. */
export type Condition =
  /** A stat of a country, the player's when no country is named. */
  | { kind: 'stat'; country?: CountryId; stat: StatKey; above?: number; below?: number }
  /** The player's relations with a country. */
  | { kind: 'relations'; country: CountryId; above?: number; below?: number }
  | { kind: 'faction'; faction: FactionId; above?: number; below?: number }
  /** The player's strait is closed to at least one power. */
  | { kind: 'straitClosed' }
  | { kind: 'turn'; from?: number; to?: number }

/** Who a card is about: a named country, or one picked from the situation when it is drawn. */
export type CardTarget = CountryId | 'patron' | 'otherPower' | 'largestCreditor'

export interface EventResponse {
  id: string
  name: string
  /** Shown before the player chooses. */
  effects: Effect[]
  /** Applied after the visible effects, and only revealed in the log. */
  hidden?: Effect[]
  /** A chance of a follow-up card some turns later, about the same target. */
  chain?: { card: string; chance: number; after: number }
}

/** A crisis card. Its responses' effects apply to the player, with no target. */
export interface EventCard {
  id: string
  name: string
  /** May include {target}, replaced by the target country's name. */
  description: string
  /** Relative chance of a random draw. 0 means only drawn by a chain or a faction. */
  weight: number
  target?: CardTarget
  /** All must hold for the card to be drawn at random. */
  conditions?: Condition[]
  /** Multiply the weight while a condition holds. */
  boosts?: { when: Condition; times: number }[]
  responses: EventResponse[]
}

export interface DeckRules {
  /** Turns before a card drawn at random can be drawn again. */
  cooldownTurns: number
}

export type PersonalityWeights = Record<
  'treasury' | 'income' | 'legitimacy' | 'militaryLoyalty' | 'defence' | 'relations' | 'bloc' | 'harm',
  number
>

/** How computer rivals score actions. See DESIGN.md, "Computer rivals". */
export interface RivalRules {
  /** Random spread added to each score, up to this much either way. */
  noise: number
  /** An action's expected score must be above this for it to be taken. */
  minimumUtility: number
  /** A rival won't take the same action, with the same target and option, again within this many turns. */
  repeatAfterTurns: number
  /** Longer waits for particular actions, by action id. */
  repeatAfterTurnsFor: Record<string, number>
  /** Turns of income an action's change in income is counted over. */
  incomeHorizon: number
  /** Money matters less the more a country has: this sets how fast. */
  treasuryScale: number
  /** Utility lost per point of treasury below zero. */
  deficitPenalty: number
  /** Relations with great powers count this many times as much. */
  greatPowerRelations: number
  /** Gains in relations matter less the better relations already are: this sets how fast. */
  relationsScale: number
  /** Gains in legitimacy, loyalty, defence and depth of alignment matter less the higher they already are. */
  statScale: number
  /** For a great power, moving Kessara counts this many times as much as moving another state. */
  playerBloc: number
  /** A great power's bloc weight, used in place of its personality's so both powers want their bloc equally. */
  greatPowerBloc: number
  /**
   * Rising tension: harm counts for its full weight on the last turn, and on
   * earlier turns for the share of the game played raised to this power.
   */
  tensionCurve: number
  /** A project is valued as if built, times this. */
  projectDiscount: number
  /** Relations a great power loses per point the player's alignment moves away from it in a turn. */
  reactionPerAlignment: number
  personalities: Record<Personality, PersonalityWeights>
}

/** Country data as written in src/data/countries.json. */
export type CountryDef = Omit<Country, 'projects'>

export interface GameData {
  countries: Country[]
  actions: ActionDef[]
  projects: ProjectDef[]
  straits: StraitDef[]
  economy: EconomyRules
  straitControl: StraitControlRules
  hedging: HedgingRules
  demands: DemandDef[]
  factions: FactionRules
  events: EventCard[]
  deck: DeckRules
  rivals: RivalRules
}

// ---- Turns and game state ----

export interface PlayerAction {
  /** Id of an action defined in src/data/actions.json. */
  actionId: string
  targetId?: CountryId
  /** Id of one of the action's options, for actions that have them. */
  option?: string
}

export type DemandResponse = 'accept' | 'refuse'

export type OfferResponse = 'accept' | 'decline'

/** Everything the player decides for one turn, submitted together. */
export interface PlayerTurn {
  /** Id of the chosen response to the pending crisis, or null when there is none. */
  crisisResponse: string | null
  /** The answer to a pending demand. Required when there is one. */
  demandResponse?: DemandResponse | null
  /** The answer to a pending offer. Required when there is one. */
  offerResponse?: OfferResponse | null
  actions: PlayerAction[]
}

/** A demand from the player's patron, answered with the next turn's choices. */
export interface PendingDemand {
  /** Id of a demand in src/data/demands.json. */
  demandId: string
  /** The great power making the demand. */
  fromId: CountryId
}

/** An offer made to the player by a computer rival, answered with the next turn's choices. */
export interface PendingOffer {
  /** The country making the offer. */
  fromId: CountryId
  /** Id of the offer action in src/data/actions.json. */
  actionId: string
}

/** A crisis card drawn ahead of its turn, so the player sees it before acting. */
export interface PendingCrisis {
  /** Id of an event card defined in src/data. */
  cardId: string
  /** Ids of the responses the player can choose from. */
  responseIds: string[]
  /** The country the card is about, if any. */
  targetId: CountryId | null
}

/** A trade deal in force. See DESIGN.md, "Economy". */
export interface TradeDeal {
  signerId: CountryId
  partnerId: CountryId
  /** The deal expires at the end of this turn. */
  endsOnTurn: number
  /** The growth the deal added to the signer, after limits, taken away again when it expires. */
  growth: number
  /** The same for the partner. */
  partnerGrowth: number
}

/** A follow-up card waiting to be drawn. */
export interface PendingChain {
  cardId: string
  /** Drawn at the start of this turn. */
  dueTurn: number
  targetId: CountryId | null
}

/** Systems that can be switched off, for a gentler start or to test one system alone. */
export interface GameSettings {
  rivals: boolean
  events: boolean
}

export type Phase = 'briefing' | 'crisis' | 'actions' | 'rivals' | 'resolution'

export interface LogEntry {
  turn: number
  phase: Phase
  text: string
  /** The country whose action or reaction this entry reports, if any. */
  actorId?: CountryId
}

export type GameStatus = 'playing' | 'ended'

/** Why the game ended. Endings and their scoring arrive in milestone 7. */
export type EndReason = 'turnLimit' | 'default' | 'vassal'

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
  settings: GameSettings
  /** The crisis card for this turn, drawn at the end of the previous one. */
  crisis: PendingCrisis | null
  /** Follow-up cards that have been set off and are waiting to be drawn. */
  chains: PendingChain[]
  /** The turn each card was last drawn at random. */
  lastDrawn: Record<string, number>
  /** Trade deals in force between any two countries. */
  tradeDeals: TradeDeal[]
  /** For each rival, the turn it last took each action, keyed by action, target and option. */
  rivalHistory: Record<CountryId, Record<string, number>>
  /** A demand from the player's patron waiting for an answer. */
  demand: PendingDemand | null
  /** An offer from a computer rival waiting for an answer. */
  offer: PendingOffer | null
  /** Turns in a row the player's alignment has ended past the demand line. */
  demandTurns: number
  /** Demands the player has accepted from each great power. */
  demandsAccepted: Record<CountryId, number>
  /** Turns in a row the player's alignment has ended within the broker range, since the last bonus. */
  brokerTurns: number
  /** Satisfaction of the player's factions, 0 to 100. */
  factions: Record<FactionId, number>
  /** Each great power's access to each strait. */
  straitAccess: Record<string, Record<CountryId, StraitAccess>>
  countries: Record<CountryId, Country>
  log: LogEntry[]
}
