// Plain-language descriptions built from the same effect data the engine
// applies, so the interface shows exactly what an action will do.

import { greatPowerOnSide } from './alignment.ts'
import { GAME_DATA, getAction, getEvent, getFaction, getProject } from './data.ts'
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

/**
 * When the player's alignment shifts relative to a great power, the power it
 * moves away from resents it (DESIGN.md, "Computer rivals"). This previews
 * that reaction. The real one is worked out from the whole turn's shift.
 */
function reactionPreview(state: GameState, actorId: CountryId, towardId: CountryId | null, amount: number): string[] {
  if (actorId !== state.playerId || !towardId || state.countries[towardId].kind !== 'greatPower') return []
  const resentfulId = amount >= 0 ? otherGreatPower(state, towardId) : towardId
  const loss = Math.round(Math.abs(amount) * GAME_DATA.rivals.reactionPerAlignment)
  if (!resentfulId || loss === 0) return []
  return [`${state.countries[resentfulId].name} resents it: relations up to −${loss}`]
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

/** Whether an effect helps the country taking it, hurts it, or neither, such as a shift in alignment. */
export type Tone = 'good' | 'bad' | 'neutral'

/** One line describing an effect, and whether it helps or hurts. */
export interface EffectLine {
  text: string
  tone: Tone
}

/** The same lines as describeEffects, each marked as helping or hurting the actor. */
export function describeEffectLines(
  state: GameState,
  actorId: CountryId,
  targetId: CountryId | null,
  effects: readonly Effect[],
): EffectLine[] {
  return effects.flatMap((effect) => {
    const lines = describeEffect(state, actorId, targetId, effect)
    const tones = tonesOf(state, actorId, targetId, effect)
    return lines.map((text, index) => ({ text, tone: tones[index] ?? 'neutral' }))
  })
}

/** What an action does, line by line, each marked as helping or hurting the actor. */
export function describeActionLines(state: GameState, actorId: CountryId, action: PlayerAction): EffectLine[] {
  const def = getAction(action.actionId)
  const option = def.options?.find((candidate) => candidate.id === action.option)
  return describeEffectLines(state, actorId, action.targetId ?? null, [...def.effects, ...(option?.effects ?? [])])
}

const toneOfChange = (amount: number): Tone => (amount > 0 ? 'good' : amount < 0 ? 'bad' : 'neutral')

/**
 * The tone of each line describeEffect writes for an effect, in the same
 * order. More money, growth, standing at home and friends help; more debt
 * and upkeep hurt. Effects on other countries, and alignment, which is the
 * player's own choice of direction, are neither.
 */
function tonesOf(state: GameState, actorId: CountryId, targetId: CountryId | null, effect: Effect): Tone[] {
  switch (effect.kind) {
    case 'stat':
      if (effect.who !== 'self' || effect.stat === 'alignment') return ['neutral']
      return [toneOfChange(effect.stat === 'debt' ? -effect.amount : effect.amount)]
    case 'economy':
      if (effect.who !== 'self') return ['neutral']
      return [toneOfChange(effect.field === 'upkeep' ? -effect.amount : effect.amount)]
    case 'relations':
    case 'faction':
      return [toneOfChange(effect.amount)]
    case 'alignment':
      // The shift itself, then the resentment it may cause.
      return ['neutral', 'bad']
    case 'forgiveDebt':
      return ['good']
    case 'recallLoans':
      return ['bad']
    case 'tradeDeal':
      return [toneOfChange(effect.growth), 'neutral']
    case 'straitAccess':
      // The new access, then the risk of closing it.
      return ['neutral', 'bad']
    case 'chance': {
      const inner = describeEffectLines(state, actorId, targetId, effect.effects).map((line) => line.tone)
      return [inner.length > 0 && inner.every((tone) => tone === inner[0]) ? inner[0] : 'neutral']
    }
    case 'borrow':
    case 'repayDebt':
    case 'startProject':
      return ['neutral']
  }
}

/** Where a country stands between the two great powers, in a word that follows the rules' own lines. */
export type Standing = 'balanced' | 'leaning' | 'siding' | 'client'

export interface AlignmentView {
  standing: Standing
  /** The great power it leans toward, or null when balanced. */
  powerId: CountryId | null
  /** Balanced, Leaning, Siding or Client. */
  word: string
  /** The same in a phrase, naming the power: "Leans toward Halvard Compact". */
  phrase: string
}

/**
 * Alignment in words. Balanced is the broker range, Leaning runs to the
 * trade-cut line, Siding to the demand line, and Client is beyond it.
 */
export function alignmentView(state: GameState, alignment: number): AlignmentView {
  const { brokerWithin, tradeCutPast, demandPast } = GAME_DATA.hedging
  const size = Math.abs(alignment)
  if (size <= brokerWithin) {
    return { standing: 'balanced', powerId: null, word: 'Balanced', phrase: 'Balanced between the powers' }
  }
  const power = greatPowerOnSide(state, alignment)
  const name = power?.name ?? 'a great power'
  const powerId = power?.id ?? null
  if (size <= tradeCutPast) return { standing: 'leaning', powerId, word: 'Leaning', phrase: `Leans toward ${name}` }
  if (size <= demandPast) return { standing: 'siding', powerId, word: 'Siding', phrase: `Sides with ${name}` }
  return { standing: 'client', powerId, word: 'Client', phrase: `In ${name}'s camp` }
}

/** Relations in a word: Hostile, Unfriendly, Neutral, Friendly or Close. */
export function relationsWord(score: number): string {
  if (score < -50) return 'Hostile'
  if (score < -20) return 'Unfriendly'
  if (score <= 20) return 'Neutral'
  if (score <= 50) return 'Friendly'
  return 'Close'
}

function describeEffect(state: GameState, actorId: CountryId, targetId: CountryId | null, effect: Effect): string[] {
  const target = targetId ? state.countries[targetId].name : 'the target'
  const joined = (effects: readonly Effect[], forTarget: CountryId | null) =>
    describeEffectsInline(state, actorId, forTarget, effects)

  const nameOf = (id: CountryId | null | undefined, fallback: string) => (id ? state.countries[id].name : fallback)
  const otherPowerId = targetId ? otherGreatPower(state, targetId) : null

  switch (effect.kind) {
    case 'stat': {
      const line = `${STAT_NAMES[effect.stat]} ${change(effect.amount, effect.stat === 'growth' ? '%' : '')}`
      if (effect.who === 'self') return [line]
      const who = effect.who === 'country' ? nameOf(effect.country, 'a country') : target
      return [`${who}: ${lowerFirst(state, line)}`]
    }
    case 'economy': {
      const line = `${ECONOMY_NAMES[effect.field]} ${change(effect.amount)} a turn`
      return [effect.who === 'self' ? line : `${target}: ${lowerFirst(state, line)}`]
    }
    case 'relations': {
      const withId = effect.with === 'target' ? targetId : effect.with === 'country' ? effect.country : otherPowerId
      const fallback = effect.with === 'otherGreatPower' ? 'the other great power' : 'the target'
      return [`Relations with ${nameOf(withId, fallback)} ${change(effect.amount)}`]
    }
    case 'alignment': {
      const toward = effect.toward ?? 'target'
      const towardId = toward === 'target' ? targetId : toward === 'country' ? effect.country : otherPowerId
      const name = nameOf(towardId, 'the target')
      const line =
        effect.amount >= 0 ? `Alignment up to ${effect.amount} toward ${name}` : `Alignment ${-effect.amount} away from ${name}`
      return [line, ...reactionPreview(state, actorId, towardId ?? null, effect.amount)]
    }
    case 'forgiveDebt': {
      const owed = targetId ? (state.countries[actorId].creditors[targetId] ?? 0) : null
      const owing = owed === null ? '' : ` (you owe ${owed})`
      return [`${target} writes off up to ${effect.amount} of your debt to it${owing}`]
    }
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
    case 'tradeDeal': {
      const turns = `for ${effect.turns} turns`
      return [`Growth ${change(effect.growth, '%')} ${turns}`, `${target}: growth ${change(effect.partnerGrowth, '%')} ${turns}`]
    }
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

export interface OfferView {
  fromId: CountryId
  fromName: string
  name: string
  description: string
  /** What accepting and declining would do, as the player sees it. */
  accept: string[]
  decline: string[]
  /** The same, each line marked as helping or hurting the player. */
  acceptLines: EffectLine[]
  declineLines: EffectLine[]
}

/** The offer waiting for the player's answer, or null when there is none. */
export function describeOffer(state: GameState): OfferView | null {
  if (!state.offer) return null
  const terms = getAction(state.offer.actionId).offer
  if (!terms) return null
  const { fromId } = state.offer
  return {
    fromId,
    fromName: state.countries[fromId].name,
    name: terms.name,
    description: terms.description,
    accept: describeEffects(state, state.playerId, fromId, terms.accepted),
    decline: describeEffects(state, state.playerId, fromId, terms.declined),
    acceptLines: describeEffectLines(state, state.playerId, fromId, terms.accepted),
    declineLines: describeEffectLines(state, state.playerId, fromId, terms.declined),
  }
}

export interface CrisisView {
  name: string
  description: string
  /**
   * Each response with its visible effects, as text and as lines marked as
   * helping or hurting. Hidden effects stay hidden until chosen.
   */
  responses: { id: string; name: string; effects: string[]; lines: EffectLine[] }[]
}

/** The pending crisis card as the player sees it, or null when there is none. */
export function describeCrisis(state: GameState): CrisisView | null {
  const { crisis } = state
  if (!crisis) return null
  const card = getEvent(crisis.cardId)
  const targetName = crisis.targetId ? state.countries[crisis.targetId].name : ''
  return {
    name: card.name,
    description: card.description.replaceAll('{target}', targetName),
    responses: card.responses
      .filter((response) => crisis.responseIds.includes(response.id))
      .map((response) => ({
        id: response.id,
        name: response.name,
        effects: describeEffects(state, state.playerId, crisis.targetId, response.effects),
        lines: describeEffectLines(state, state.playerId, crisis.targetId, response.effects),
      })),
  }
}
