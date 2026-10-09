// Applies the effects that actions, options and projects list in src/data.

import { getProject } from './data.ts'
import type { Rng } from './rng.ts'
import { changeEconomy, changeRelations, changeStat, updateCountry } from './state.ts'
import type { CountryId, Effect, GameState } from './types.ts'

export interface EffectContext {
  actorId: CountryId
  /** Null for effects with no target, such as a finished project's payout. */
  targetId: CountryId | null
  rng: Rng
}

export interface EffectResult {
  state: GameState
  /** Lines for the turn log, such as a covert operation being exposed. */
  texts: string[]
}

/** Apply effects in order. */
export function applyEffects(
  state: GameState,
  effects: readonly Effect[],
  context: EffectContext,
): EffectResult {
  let next = state
  const texts: string[] = []
  for (const effect of effects) {
    const result = applyEffect(next, effect, context)
    next = result.state
    texts.push(...result.texts)
  }
  return { state: next, texts }
}

function applyEffect(state: GameState, effect: Effect, context: EffectContext): EffectResult {
  switch (effect.kind) {
    case 'stat':
      return { state: changeStat(state, subject(effect.who, context), effect.stat, effect.amount), texts: [] }
    case 'economy':
      return { state: changeEconomy(state, subject(effect.who, context), effect.field, effect.amount), texts: [] }
    case 'relations': {
      const targetId = requireTarget(context)
      const otherId = effect.with === 'target' ? targetId : otherGreatPower(state, targetId)
      if (otherId === null) return { state, texts: [] }
      return { state: changeRelations(state, context.actorId, otherId, effect.amount), texts: [] }
    }
    case 'alignment':
      return { state: pullAlignment(state, context.actorId, requireTarget(context), effect.amount), texts: [] }
    case 'borrow':
      return { state: borrow(state, context.actorId, requireTarget(context), effect.amount), texts: [] }
    case 'repayDebt':
      return repayDebt(state, context.actorId, requireTarget(context), effect.amount)
    case 'startProject':
      return startProject(state, context.actorId, effect.projectId)
    case 'chance': {
      if (context.rng.next() >= effect.probability) return { state, texts: [] }
      const result = applyEffects(state, effect.effects, context)
      return { state: result.state, texts: [effect.text, ...result.texts] }
    }
  }
}

function requireTarget(context: EffectContext): CountryId {
  if (context.targetId === null) throw new Error('This effect needs a target country')
  return context.targetId
}

function subject(who: 'self' | 'target', context: EffectContext): CountryId {
  return who === 'self' ? context.actorId : requireTarget(context)
}

/** The great power on the other side from the target, or null if the target is not a great power. */
export function otherGreatPower(state: GameState, targetId: CountryId): CountryId | null {
  if (state.countries[targetId].kind !== 'greatPower') return null
  const other = Object.values(state.countries).find(
    (country) => country.kind === 'greatPower' && country.id !== targetId,
  )
  return other?.id ?? null
}

/**
 * Pull the smaller party's alignment toward the other's by up to amount,
 * never past it, or push it away for a negative amount. Great powers anchor
 * the scale and never move. Between two minor states, the actor moves.
 */
function pullAlignment(state: GameState, actorId: CountryId, targetId: CountryId, amount: number): GameState {
  const actor = state.countries[actorId]
  const target = state.countries[targetId]
  const [mover, anchor] = actor.kind === 'minor' ? [actor, target] : [target, actor]
  if (mover.kind !== 'minor') return state

  const gap = anchor.stats.alignment - mover.stats.alignment
  if (amount >= 0) {
    return changeStat(state, mover.id, 'alignment', Math.sign(gap) * Math.min(Math.abs(gap), amount))
  }
  // Pushing away from a country you are level with moves you back toward the centre.
  const toward = gap !== 0 ? Math.sign(gap) : Math.sign(anchor.stats.alignment)
  return changeStat(state, mover.id, 'alignment', toward * amount)
}

/** Take cash now, owed to the lender. */
function borrow(state: GameState, borrowerId: CountryId, lenderId: CountryId, amount: number): GameState {
  const withCash = changeStat(changeStat(state, borrowerId, 'treasury', amount), borrowerId, 'debt', amount)
  return updateCountry(withCash, borrowerId, (country) => ({
    ...country,
    creditors: { ...country.creditors, [lenderId]: (country.creditors[lenderId] ?? 0) + amount },
  }))
}

/** Pay a creditor up to amount of what it is owed, from the treasury. */
function repayDebt(state: GameState, debtorId: CountryId, creditorId: CountryId, amount: number): EffectResult {
  const debtor = state.countries[debtorId]
  const creditor = state.countries[creditorId]
  const owed = debtor.creditors[creditorId] ?? 0
  if (owed <= 0) throw new Error(`${debtor.name} owes nothing to ${creditor.name}`)

  const paid = Math.min(amount, owed)
  let next = changeStat(state, debtorId, 'treasury', -paid)
  next = changeStat(next, debtorId, 'debt', -paid)
  next = updateCountry(next, debtorId, (country) => ({
    ...country,
    creditors: { ...country.creditors, [creditorId]: owed - paid },
  }))
  return { state: next, texts: [`Repaid ${paid} to ${creditor.name}, leaving ${owed - paid} owed.`] }
}

/** Pay for a project and schedule its completion. Each project can be built once. */
function startProject(state: GameState, builderId: CountryId, projectId: string): EffectResult {
  const project = getProject(projectId)
  const builder = state.countries[builderId]
  if (builder.projects.some((progress) => progress.projectId === projectId)) {
    throw new Error(`${builder.name} has already started ${project.name}`)
  }

  const paid = changeStat(state, builderId, 'treasury', -project.cost)
  const next = updateCountry(paid, builderId, (country) => ({
    ...country,
    projects: [...country.projects, { projectId, completesOnTurn: state.turn + project.turns - 1 }],
  }))
  const turns = project.turns === 1 ? '1 turn' : `${project.turns} turns`
  return { state: next, texts: [`Work begins on ${project.name}. It will take ${turns}.`] }
}
