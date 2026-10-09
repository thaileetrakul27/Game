// Strait access and tolls. See DESIGN.md, "Strait control".

import { GAME_DATA } from './data.ts'
import type { CountryId, GameData, GameState, StraitAccess, StraitDef } from './types.ts'

/** A power's access to a strait. Every power starts open. */
export function accessOf(state: GameState, straitId: string, powerId: CountryId): StraitAccess {
  return state.straitAccess[straitId]?.[powerId] ?? 'open'
}

/** How an access setting reads before a power's name: "open to", "taxed for" or "closed to". */
export function accessPhrase(access: StraitAccess): string {
  return access === 'taxed' ? 'taxed for' : `${access} to`
}

/** The strait a country owns, if any. */
export function straitOwnedBy(countryId: CountryId, data: GameData = GAME_DATA): StraitDef | undefined {
  return data.straits.find((strait) => strait.controlledBy === countryId)
}

/**
 * What each great power pays this turn to use a strait: its share of the
 * strait's traffic, times the strait's share of regional trade, times the
 * toll per share, times its access rate (open 1, taxed more, closed 0).
 */
export function straitTolls(state: GameState, strait: StraitDef, data: GameData = GAME_DATA): Record<CountryId, number> {
  const rules = data.straitControl
  const rate: Record<StraitAccess, number> = { open: 1, taxed: rules.taxedTollMultiplier, closed: 0 }
  const tolls: Record<CountryId, number> = {}
  for (const [powerId, traffic] of Object.entries(strait.traffic)) {
    const toll = strait.tradeShare * rules.tollPerTradeShare * (traffic / 100) * rate[accessOf(state, strait.id, powerId)]
    tolls[powerId] = Math.round(toll)
  }
  return tolls
}

/** Total tolls a country earns this turn from the straits it owns. */
export function straitIncome(state: GameState, countryId: CountryId, data: GameData = GAME_DATA): number {
  return data.straits
    .filter((strait) => strait.controlledBy === countryId)
    .flatMap((strait) => Object.values(straitTolls(state, strait, data)))
    .reduce((total, toll) => total + toll, 0)
}

/** Chance each turn that a power shut out of the strait strikes back, given the owner's defence. */
export function closureRisk(defence: number, data: GameData = GAME_DATA): number {
  const rules = data.straitControl
  return Math.max(0, rules.closureRiskBase - defence * rules.closureRiskLessPerDefence)
}
