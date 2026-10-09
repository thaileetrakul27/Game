// How much better off a country is after a change, by its personality's
// weights. Computer rivals use it to choose actions and to answer offers.
// See DESIGN.md, "Computer rivals".

import { tradeCutBy } from './alignment.ts'
import { GAME_DATA } from './data.ts'
import { straitIncome } from './straits.ts'
import { MAX_TURNS } from './types.ts'
import type { Country, CountryId, GameState } from './types.ts'

const rules = () => GAME_DATA.rivals

/** What a treasury is worth: each extra coin matters less to a rich country, and debt below zero hurts. */
function moneyValue(treasury: number): number {
  const { treasuryScale, deficitPenalty } = rules()
  return treasury >= 0 ? treasuryScale * Math.log1p(treasury / treasuryScale) : deficitPenalty * treasury
}

/**
 * What a stat, relations score or depth of alignment is worth: in full below
 * zero, and less for each point above it, so a rival stops chasing a score
 * that is already high.
 */
function softValue(value: number, scale: number): number {
  return value <= 0 ? value : scale * (1 - Math.exp(-value / scale))
}

/** The gain from moving a value from one level to another, counted with diminishing returns. */
function softGain(from: number, to: number, scale: number): number {
  return softValue(to, scale) - softValue(from, scale)
}

/** Income per turn without rounding, so small changes in growth still count. */
function incomeValue(state: GameState, id: CountryId): number {
  const country = state.countries[id]
  const output = country.economy.baseOutput * (1 + country.stats.growth / 100)
  const cut = tradeCutBy(state, id) ? output * GAME_DATA.hedging.tradeCutOutputLoss : 0
  const interest = country.stats.debt * GAME_DATA.economy.interestRatePerTurn
  return output - cut + straitIncome(state, id) + country.economy.straitTolls - interest - country.economy.upkeep
}

/** The end of the scale the smaller states lean toward overall: 1 for Halvard, -1 for Tsengai, 0 if even. */
export function winningSide(state: GameState): number {
  const minors = Object.values(state.countries).filter((country) => country.kind === 'minor')
  return Math.sign(minors.reduce((sum, country) => sum + country.stats.alignment, 0))
}

/** How far an action moved things the way this rival wants on the alignment scale. */
function blocGain(before: GameState, after: GameState, actor: Country): number {
  if (actor.kind === 'greatPower') {
    // A great power wants the smaller states, Kessara above all, to move toward its end.
    const side = Math.sign(actor.stats.alignment)
    return Object.values(before.countries)
      .filter((country) => country.kind === 'minor')
      .reduce((sum, country) => {
        const moved = (after.countries[country.id].stats.alignment - country.stats.alignment) * side
        return sum + moved * (country.id === before.playerId ? rules().playerBloc : 1)
      }, 0)
  }
  const from = actor.stats.alignment
  const to = after.countries[actor.id].stats.alignment
  const deeper = (side: number) => softGain(from * side, to * side, rules().statScale)
  switch (actor.personality) {
    case 'hardliner':
      return deeper(Math.sign(from))
    case 'opportunist':
      return deeper(winningSide(before))
    default:
      // Merchants like to stay balanced.
      return Math.abs(from) - Math.abs(to)
  }
}

/**
 * Hostile rivals grow bolder as the game goes on: the weight they put on
 * harming an enemy rises from nothing on the first turn to its full value on
 * the last, slowly at first.
 */
export function tension(state: GameState): number {
  return ((state.turn - 1) / (MAX_TURNS - 1)) ** rules().tensionCurve
}

/** How much better off a rival is after an action, by its personality's weights. */
export function utility(before: GameState, after: GameState, actorId: CountryId): number {
  const actor = before.countries[actorId]
  const weights = rules().personalities[actor.personality ?? 'opportunist']
  const { statScale, relationsScale } = rules()
  const was = actor.stats
  const now = after.countries[actorId].stats

  let score = weights.treasury * (moneyValue(now.treasury) - moneyValue(was.treasury))
  score += weights.income * rules().incomeHorizon * (incomeValue(after, actorId) - incomeValue(before, actorId))
  score += weights.legitimacy * softGain(was.legitimacy, now.legitimacy, statScale)
  score += weights.militaryLoyalty * softGain(was.militaryLoyalty, now.militaryLoyalty, statScale)
  score += weights.defence * softGain(was.defence, now.defence, statScale)

  for (const other of Object.values(before.countries)) {
    if (other.id === actorId) continue
    const relationsBefore = actor.relations[other.id] ?? 0
    const relationsAfter = after.countries[actorId].relations[other.id] ?? 0
    const weight = other.kind === 'greatPower' ? rules().greatPowerRelations : 1
    score += weights.relations * weight * softGain(relationsBefore, relationsAfter, relationsScale)

    // Damage done to a country counts in proportion to how hostile the rival is to it.
    const hostility = Math.max(0, -relationsBefore) / 100
    const hurt = after.countries[other.id].stats
    const damage =
      other.stats.legitimacy - hurt.legitimacy + (other.stats.defence - hurt.defence) +
      (other.stats.militaryLoyalty - hurt.militaryLoyalty)
    score += weights.harm * tension(before) * hostility * damage
  }

  const blocWeight = actor.kind === 'greatPower' ? rules().greatPowerBloc : weights.bloc
  return score + blocWeight * blocGain(before, after, actor)
}
