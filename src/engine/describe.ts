// Plain-language descriptions built from the same effect data the engine
// applies, so the interface shows exactly what an action will do.

import { getAction, getProject } from './data.ts'
import { otherGreatPower } from './effects.ts'
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

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** What an action does with its chosen target and option, one line per effect. */
export function describeAction(state: GameState, actorId: CountryId, action: PlayerAction): string[] {
  const def = getAction(action.actionId)
  const option = def.options?.find((candidate) => candidate.id === action.option)
  const effects = [...def.effects, ...(option?.effects ?? [])]
  return describeEffects(state, actorId, action.targetId ?? null, effects)
}

export function describeEffects(
  state: GameState,
  actorId: CountryId,
  targetId: CountryId | null,
  effects: readonly Effect[],
): string[] {
  return effects.map((effect) => describeEffect(state, actorId, targetId, effect))
}

function describeEffect(state: GameState, actorId: CountryId, targetId: CountryId | null, effect: Effect): string {
  const target = targetId ? state.countries[targetId].name : 'the target'
  switch (effect.kind) {
    case 'stat': {
      const line = `${STAT_NAMES[effect.stat]} ${change(effect.amount, effect.stat === 'growth' ? '%' : '')}`
      return effect.who === 'self' ? line : `${target}: ${lowerFirst(line)}`
    }
    case 'economy': {
      const line = `${ECONOMY_NAMES[effect.field]} ${change(effect.amount)} a turn`
      return effect.who === 'self' ? line : `${target}: ${lowerFirst(line)}`
    }
    case 'relations': {
      if (effect.with === 'target') return `Relations with ${target} ${change(effect.amount)}`
      const otherId = targetId ? otherGreatPower(state, targetId) : null
      const other = otherId ? state.countries[otherId].name : 'the other great power'
      return `Relations with ${other} ${change(effect.amount)}`
    }
    case 'alignment':
      return effect.amount >= 0
        ? `Alignment up to ${effect.amount} toward ${target}`
        : `Alignment ${-effect.amount} away from ${target}`
    case 'borrow':
      return `Borrow ${effect.amount} from ${target}: treasury +${effect.amount}, debt +${effect.amount}`
    case 'repayDebt': {
      const owed = targetId ? (state.countries[actorId].creditors[targetId] ?? 0) : null
      const owing = owed === null ? '' : ` (you owe ${owed})`
      return `Repay up to ${effect.amount} of the debt to ${target}${owing}, from the treasury`
    }
    case 'startProject': {
      const project = getProject(effect.projectId)
      const payout = describeEffects(state, actorId, null, project.effects).map(lowerFirst).join(', ')
      return `Costs ${project.cost}, takes ${project.turns} turns, then ${payout}`
    }
    case 'chance': {
      const outcome = lowerFirst(effect.text.replace(/\.$/, ''))
      const results = describeEffects(state, actorId, targetId, effect.effects).map(lowerFirst).join(', ')
      return `${Math.round(effect.probability * 100)}% chance ${outcome}: ${results}`
    }
  }
}
