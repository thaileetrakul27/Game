// Where the player stands on the alignment scale, and the thresholds that
// matter there. See DESIGN.md, "Hedging and demands".

import { GAME_DATA } from './data.ts'
import type { Country, CountryId, GameState } from './types.ts'

/** True when alignment is beyond the line on either side. 40 itself is not past 40. */
export function isPast(alignment: number, line: number): boolean {
  return Math.abs(alignment) > line
}

/** True when alignment is within the broker range, both ends included. */
export function inBrokerRange(alignment: number): boolean {
  return Math.abs(alignment) <= GAME_DATA.hedging.brokerWithin
}

/** The great power at the positive (Halvard) or negative (Tsengai) end of the scale. */
export function greatPowerOnSide(state: GameState, side: number): Country | null {
  return (
    Object.values(state.countries).find(
      (country) => country.kind === 'greatPower' && Math.sign(country.stats.alignment) === Math.sign(side),
    ) ?? null
  )
}

/** The great power the player leans toward, or null at exactly zero. */
export function patronOf(state: GameState): Country | null {
  const alignment = state.countries[state.playerId].stats.alignment
  return alignment === 0 ? null : greatPowerOnSide(state, alignment)
}

/**
 * The great power that has cut trade with this country, or null. Past the
 * trade-cut line, the power on the other side cuts trade. Only the player
 * is affected.
 */
export function tradeCutBy(state: GameState, countryId: CountryId): CountryId | null {
  if (countryId !== state.playerId) return null
  const alignment = state.countries[countryId].stats.alignment
  if (!isPast(alignment, GAME_DATA.hedging.tradeCutPast)) return null
  return greatPowerOnSide(state, -alignment)?.id ?? null
}
