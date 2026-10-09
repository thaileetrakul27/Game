// Public entry point of the engine. The interface and store import from here.

export { advanceTurn } from './advanceTurn.ts'
export { createGameState } from './createGameState.ts'
export type { NewGameOptions } from './createGameState.ts'
export { GAME_DATA, getAction, getProject, validateGameData } from './data.ts'
export { debtInterest, incomeBreakdown } from './economy.ts'
export type { IncomeBreakdown } from './economy.ts'
export { createRng, mulberry32, normaliseSeed } from './rng.ts'
export type { Rng } from './rng.ts'
export * from './types.ts'
