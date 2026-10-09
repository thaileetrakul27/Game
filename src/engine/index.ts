// Public entry point of the engine. The interface and store import from here.

export { actionsCost, targetsFor } from './actions.ts'
export { advanceTurn, checkActions, checkPlannedAction } from './advanceTurn.ts'
export { inBrokerRange, isPast, patronOf, tradeCutBy } from './alignment.ts'
export { createGameState } from './createGameState.ts'
export type { NewGameOptions } from './createGameState.ts'
export {
  GAME_DATA,
  getAction,
  getDemand,
  getEvent,
  getFaction,
  getProject,
  getStrait,
  validateGameData,
} from './data.ts'
export { describeAction, describeCrisis, describeEffects, describeEffectsInline, STAT_NAMES } from './describe.ts'
export type { CrisisView } from './describe.ts'
export { cardWeight, conditionHolds, drawCrisis } from './deck.ts'
export { debtInterest, incomeBreakdown } from './economy.ts'
export type { IncomeBreakdown } from './economy.ts'
export { createRng, mulberry32, normaliseSeed } from './rng.ts'
export type { Rng } from './rng.ts'
export { candidateActions, rivalReactions, rivalTurn, scoreAction, utility, winningSide } from './rivals.ts'
export { alerts, factionStatus, hedgingStatus, latestNews, rivalNews } from './situation.ts'
export type { Alert, AlertLevel, FactionStatus, HedgingStatus, NewsStory } from './situation.ts'
export { projectTurnsLeft, quarterLabel } from './state.ts'
export { accessOf, accessPhrase, closureRisk, straitIncome, straitOwnedBy, straitTolls } from './straits.ts'
export * from './types.ts'
