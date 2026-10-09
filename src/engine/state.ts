// Helpers for building a new GameState from an old one without mutating it.

import { GAME_DATA } from './data.ts'
import type { Country, CountryId, EconomyField, GameState, LogEntry, Phase, StatKey } from './types.ts'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

export function withLog(state: GameState, phase: Phase, texts: string[]): GameState {
  const entries: LogEntry[] = texts.map((text) => ({ turn: state.turn, phase, text }))
  return { ...state, log: [...state.log, ...entries] }
}

export function updateCountry(
  state: GameState,
  id: CountryId,
  update: (country: Country) => Country,
): GameState {
  return { ...state, countries: { ...state.countries, [id]: update(state.countries[id]) } }
}

/** The range each stat is kept within. See DESIGN.md, "World model". */
function statRange(stat: StatKey): [number, number] {
  switch (stat) {
    case 'treasury':
      return [-Infinity, Infinity]
    case 'debt':
      return [0, Infinity]
    case 'growth':
      return [GAME_DATA.economy.growthMin, GAME_DATA.economy.growthMax]
    case 'alignment':
      return [-100, 100]
    case 'legitimacy':
    case 'militaryLoyalty':
    case 'defence':
      return [0, 100]
  }
}

export function changeStat(state: GameState, id: CountryId, stat: StatKey, amount: number): GameState {
  const [min, max] = statRange(stat)
  return updateCountry(state, id, (country) => ({
    ...country,
    stats: { ...country.stats, [stat]: clamp(country.stats[stat] + amount, min, max) },
  }))
}

export function changeEconomy(
  state: GameState,
  id: CountryId,
  field: EconomyField,
  amount: number,
): GameState {
  return updateCountry(state, id, (country) => ({
    ...country,
    economy: { ...country.economy, [field]: Math.max(0, country.economy[field] + amount) },
  }))
}

/** Change relations between two countries, both ways. */
export function changeRelations(state: GameState, a: CountryId, b: CountryId, amount: number): GameState {
  const shift = (current: GameState, from: CountryId, to: CountryId) =>
    updateCountry(current, from, (country) => ({
      ...country,
      relations: { ...country.relations, [to]: clamp((country.relations[to] ?? 0) + amount, -100, 100) },
    }))
  return shift(shift(state, a, b), b, a)
}
