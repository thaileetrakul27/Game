// Plain-language descriptions built from the same effect data the engine
// applies, so the interface shows exactly what an action will do.

import { GAME_DATA, getAction, getFaction, getProject } from './data.ts'
import { otherGreatPower } from './effects.ts'
import { accessOf, accessPhrase, closureRisk, straitOwnedBy } from './straits.ts'
import type { CountryId, EconomyField, Effect, GameState, PlayerAction, StatKey } from './types.ts'

/** Display names for the seven stats. */
export const STAT_NAMES: Record<StatKey, string> = {
  treasury: 'Treasury',
  debt: 'Debt',
  growth: 'Growth',
  legitimacy: 'Legitimacy',
  militaryLoyalty: 'Military loyalty',
  defence: 'Defence',
  alignment: 'Alignment',
}

const ECONOMY_NAMES: Record<EconomyField, string> = {
  baseOutput: 'Base output',
  upkeep: 'Upkeep',
  straitTolls: 'Strait tolls',
}

function change(value: number, unit = ''): string {
  return `${value < 0 ? '−' : '+'}${Math.abs(value)}${unit}`
}

/** Lower-case the first letter to continue a sentence, unless the line starts with a country's name. */
function lowerFirst(state: GameState, text: string): string {
  if (Object.values(state.countries).some((country) => text.startsWith(country.name))) return text
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** What an action does with its chosen target and option, one line per effect. */
export function describeAction(state: GameState, actorId: CountryId, action: PlayerAction): string[] {
  const def = getAction(action.actionId)
  const option = def.options?.find((candidate) => candidate.id === action.option)
  const effects = [...def.effects, ...(option?.effects ?? [])]
  return describeEffects(state, actorId, action.targetId ?? null, effects)
}

/** Effects as one phrase to continue a sentence, such as "treasury −40, growth −0.5%". */
export function describeEffectsInline(
  state: GameState,
  actorId: CountryId,
  targetId: CountryId | null,
  effects: readonly Effect[],
): string {
  return describeEffects(state, actorId, targetId, effects)
    .map((line) => lowerFirst(state, line))
    .join(', ')
}

export function describeEffects(
  state: GameState,
  actorId: CountryId,
  targetId: CountryId | null,
  effects: readonly Effect[],
): string[] {
  return effects.flatMap((effect) => describeEffect(state, actorId, targetId, effect))
}

function describeEffect(state: GameState, actorId: CountryId, targetId: CountryId | null, effect: Effect): string[] {
  const target = targetId ? state.countries[targetId].name : 'the target'
  const joined = (effects: readonly Effect[], forTarget: CountryId | null) =>
    describeEffectsInline(state, actorId, forTarget, effects)

  switch (effect.kind) {
    case 'stat': {
      const line = `${STAT_NAMES[effect.stat]} ${change(effect.amount, effect.stat === 'growth' ? '%' : '')}`
      return [effect.who === 'self' ? line : `${target}: ${lowerFirst(state, line)}`]
    }
    case 'economy': {
      const line = `${ECONOMY_NAMES[effect.field]} ${change(effect.amount)} a turn`
      return [effect.who === 'self' ? line : `${target}: ${lowerFirst(state, line)}`]
    }
    case 'relations': {
      if (effect.with === 'target') return [`Relations with ${target} ${change(effect.amount)}`]
      const otherId = targetId ? otherGreatPower(state, targetId) : null
      const other = otherId ? state.countries[otherId].name : 'the other great power'
      return [`Relations with ${other} ${change(effect.amount)}`]
    }
    case 'alignment':
      return [
        effect.amount >= 0
          ? `Alignment up to ${effect.amount} toward ${target}`
          : `Alignment ${-effect.amount} away from ${target}`,
      ]
    case 'borrow':
      return [`Borrow ${effect.amount} from ${target}: treasury +${effect.amount}, debt +${effect.amount}`]
    case 'repayDebt': {
      const owed = targetId ? (state.countries[actorId].creditors[targetId] ?? 0) : null
      const owing = owed === null ? '' : ` (you owe ${owed})`
      return [`Repay up to ${effect.amount} of the debt to ${target}${owing}, from the treasury`]
    }
    case 'recallLoans': {
      const owed = targetId ? (state.countries[actorId].creditors[targetId] ?? 0) : 0
      return [`Repay everything you owe ${target} at once (${owed})`]
    }
    case 'faction':
      return [`${getFaction(effect.faction).name} ${change(effect.amount)}`]
    case 'straitAccess': {
      const strait = straitOwnedBy(actorId)
      const name = strait?.name ?? 'Your strait'
      const now = strait && targetId ? accessOf(state, strait.id, targetId) : null
      const current = now && now !== effect.access ? ` (now ${now})` : ''
      const lines = [`${name} ${accessPhrase(effect.access)} ${target}${current}`]
      if (effect.access === 'closed') {
        const risk = Math.round(closureRisk(state.countries[actorId].stats.defence) * 100)
        const events = GAME_DATA.straitControl.closureEvents.map((event) => event.name.toLowerCase()).join(' or ')
        lines.push(`While closed, ${risk}% chance each turn of a ${events}`)
      }
      return lines
    }
    case 'startProject': {
      const project = getProject(effect.projectId)
      return [`Costs ${project.cost}, takes ${project.turns} turns, then ${joined(project.effects, null)}`]
    }
    case 'chance': {
      const outcome = lowerFirst(state, effect.text.replace(/\.$/, ''))
      return [`${Math.round(effect.probability * 100)}% chance ${outcome}: ${joined(effect.effects, targetId)}`]
    }
  }
}
