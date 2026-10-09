import { tradeCutBy } from './alignment.ts'
import { GAME_DATA } from './data.ts'
import { straitIncome } from './straits.ts'
import type { CountryId, EconomyRules, GameData, GameState } from './types.ts'

export interface IncomeBreakdown {
  /** Base output adjusted by growth. */
  output: number
  /** Output lost while a great power cuts trade. */
  tradeLoss: number
  /** Tolls from the country's straits plus extra toll income from projects. */
  tolls: number
  interest: number
  upkeep: number
  /** What the treasury gains (or loses) this turn. */
  net: number
}

/** Interest due this turn on a debt, rounded to whole money. Paying it leaves the debt unchanged. */
export function debtInterest(debt: number, rules: EconomyRules = GAME_DATA.economy): number {
  return Math.round(debt * rules.interestRatePerTurn)
}

/**
 * A country's income for one turn (DESIGN.md, "Economy"): base output times
 * growth, minus any trade cut, plus strait tolls, minus debt interest and
 * upkeep. Growth is a percentage, so 100 base output at 3% growth gives 103.
 */
export function incomeBreakdown(state: GameState, countryId: CountryId, data: GameData = GAME_DATA): IncomeBreakdown {
  const country = state.countries[countryId]
  const output = Math.round(country.economy.baseOutput * (1 + country.stats.growth / 100))
  const tradeLoss = tradeCutBy(state, countryId) ? Math.round(output * data.hedging.tradeCutOutputLoss) : 0
  const tolls = straitIncome(state, countryId, data) + country.economy.straitTolls
  const interest = debtInterest(country.stats.debt, data.economy)
  const upkeep = country.economy.upkeep
  return { output, tradeLoss, tolls, interest, upkeep, net: output - tradeLoss + tolls - interest - upkeep }
}
