import { GAME_DATA } from './data.ts'
import type { Country, EconomyRules } from './types.ts'

export interface IncomeBreakdown {
  /** Base output adjusted by growth. */
  output: number
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
 * growth, plus strait tolls, minus debt interest and upkeep. Growth is a
 * percentage, so 100 base output at 3% growth gives 103 output.
 */
export function incomeBreakdown(country: Country, rules: EconomyRules = GAME_DATA.economy): IncomeBreakdown {
  const output = Math.round(country.economy.baseOutput * (1 + country.stats.growth / 100))
  const tolls = country.economy.straitTolls
  const interest = debtInterest(country.stats.debt, rules)
  const upkeep = country.economy.upkeep
  return { output, tolls, interest, upkeep, net: output + tolls - interest - upkeep }
}
