// Variety between games: the seed varies each neighbour's starting position
// a little, so no two games begin alike. See DESIGN.md, "Variety between games".

import { GAME_DATA } from './data.ts'
import type { Rng } from './rng.ts'
import { clamp } from './state.ts'
import type { Country, CountryId, Personality } from './types.ts'

const PERSONALITIES: Personality[] = ['opportunist', 'hardliner', 'merchant']
const GROWTH_STEP = 0.25

/** "a Hardliner", "an Opportunist". */
function withArticle(personality: Personality): string {
  const name = personality.charAt(0).toUpperCase() + personality.slice(1)
  return `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`
}

/** A whole number from -range to range. */
const shift = (rng: Rng, range: number) => rng.int(-range, range)

/**
 * Vary the neighbours (the smaller states other than the player) within the
 * ranges in src/data/variety.json. Debt, the great powers and the player never
 * vary. Returns new countries and a log line for each changed personality.
 */
export function varyNeighbours(
  countries: Record<CountryId, Country>,
  playerId: CountryId,
  rng: Rng,
): { countries: Record<CountryId, Country>; texts: string[] } {
  const rules = GAME_DATA.variety
  const varied = structuredClone(countries)
  const isNeighbour = (id: CountryId) => varied[id].kind === 'minor' && id !== playerId
  const texts: string[] = []

  for (const country of Object.values(varied)) {
    if (!isNeighbour(country.id)) continue
    const { stats } = country
    stats.alignment = clamp(stats.alignment + shift(rng, rules.alignment), -100, 100)
    for (const stat of ['legitimacy', 'militaryLoyalty', 'defence'] as const) {
      stats[stat] = clamp(stats[stat] + shift(rng, rules.stats), 0, 100)
    }
    stats.treasury = Math.round(stats.treasury * (1 + (rng.next() * 2 - 1) * rules.treasuryShare))
    const growthSteps = Math.round(rules.growth / GROWTH_STEP)
    stats.growth = clamp(
      stats.growth + shift(rng, growthSteps) * GROWTH_STEP,
      GAME_DATA.economy.growthMin,
      GAME_DATA.economy.growthMax,
    )

    const usual = country.personality
    if (usual && rng.next() < rules.personalitySwapChance) {
      country.personality = rng.pick(PERSONALITIES.filter((personality) => personality !== usual))
      texts.push(`This game, ${country.name} is ${withArticle(country.personality)} rather than ${withArticle(usual)}.`)
    }
  }

  // Each pair's relations move by the same amount on both sides.
  const ids = Object.keys(varied)
  for (const [index, a] of ids.entries()) {
    for (const b of ids.slice(index + 1)) {
      if (!isNeighbour(a) && !isNeighbour(b)) continue
      const amount = shift(rng, rules.relations)
      varied[a].relations[b] = clamp((varied[a].relations[b] ?? 0) + amount, -100, 100)
      varied[b].relations[a] = clamp((varied[b].relations[a] ?? 0) + amount, -100, 100)
    }
  }
  return { countries: varied, texts }
}
