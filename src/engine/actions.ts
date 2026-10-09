import { tradeCutBy } from './alignment.ts'
import { GAME_DATA, getAction } from './data.ts'
import { applyEffects } from './effects.ts'
import { checkNoOfferWaiting, makeOffer, offerOutcome, rivalAnswer } from './offers.ts'
import type { Rng } from './rng.ts'
import { withLog } from './state.ts'
import type { ActionDef, ActionOption, Country, CountryId, GameState, Phase, PlayerAction } from './types.ts'

/** Whether a country may take an action at all. Some are open only to one kind of country or personality. */
export function canTake(state: GameState, actorId: CountryId, def: ActionDef): boolean {
  const actor = state.countries[actorId]
  const { kind, personality } = def.actor ?? {}
  return (kind === undefined || kind === actor.kind) && (personality === undefined || personality === actor.personality)
}

/** The actions a country may take, in the order of the action data. */
export function actionsFor(state: GameState, actorId: CountryId): ActionDef[] {
  return GAME_DATA.actions.filter((def) => canTake(state, actorId, def))
}

/**
 * Take one action for a country: check its target and option against the
 * action's data, then apply the effects. The caller spends the action points.
 * The player and the computer rivals use the same rules.
 *
 * An offer to a computer country is answered at once. An offer to the player
 * waits for the player's answer next turn, unless assumeAccepted is set, as a
 * rival does when weighing whether to make it.
 */
export function takeAction(
  state: GameState,
  actorId: CountryId,
  action: PlayerAction,
  rng: Rng,
  phase: Phase = 'actions',
  assumeAccepted = false,
): GameState {
  const def = getAction(action.actionId)
  const actor = state.countries[actorId]
  if (!canTake(state, actorId, def)) throw new Error(`${def.name} is not open to ${actor.name}`)
  const target = resolveTarget(state, actor, def, action.targetId)
  const option = resolveOption(def, action.option)
  if (def.blockedByTradeCut && target && tradeCutBy(state, actorId) === target.id) {
    throw new Error(`${target.name} has cut trade with ${actor.name}`)
  }

  const details = [option?.name, target?.name].filter(Boolean).join(', ')
  const header = `${actor.name}: ${def.name}${details ? ` (${details})` : ''}.`

  if (def.offer && target) {
    if (target.id === state.playerId) checkNoOfferWaiting(state)
    if (target.id === state.playerId && !assumeAccepted) {
      return withLog(makeOffer(state, actorId, def.id), phase, [header, `${target.name} will answer next turn.`], actorId)
    }
    const response = target.id === state.playerId ? 'accept' : rivalAnswer(state, target.id, actorId, def)
    const result = offerOutcome(state, target.id, actorId, def, response, rng)
    const answer = `${target.name} ${response === 'accept' ? 'accepts' : 'declines'}.`
    return withLog(result.state, phase, [header, answer, ...result.texts], actorId)
  }

  const effects = [...def.effects, ...(option?.effects ?? [])]
  const result = applyEffects(state, effects, { actorId, targetId: target?.id ?? null, rng })
  return withLog(result.state, phase, [header, ...result.texts], actorId)
}

function resolveTarget(
  state: GameState,
  actor: Country,
  def: ActionDef,
  targetId: CountryId | undefined,
): Country | null {
  if (def.target === 'none') {
    if (targetId !== undefined) throw new Error(`${def.name} does not take a target`)
    return null
  }
  if (targetId === undefined) throw new Error(`${def.name} needs a target`)
  if (!Object.hasOwn(state.countries, targetId)) throw new Error(`Unknown target country: ${targetId}`)

  const target = state.countries[targetId]
  const problem = targetProblem(def, actor, target)
  if (problem) throw new Error(problem)
  return target
}

/** Why the action's target rule rules out this target, or null if it allows it. */
function targetProblem(def: ActionDef, actor: Country, target: Country): string | null {
  if (target.id === actor.id) return `${def.name} cannot target your own country`
  if (def.target === 'greatPower' && target.kind !== 'greatPower') return `${def.name} must target a great power`
  if (def.target === 'minor' && target.kind !== 'minor') return `${def.name} must target a smaller state`
  return null
}

/** The countries an action's target rule allows. Empty for actions with no target. */
export function targetsFor(state: GameState, actorId: CountryId, actionId: string): CountryId[] {
  const def = getAction(actionId)
  if (def.target === 'none') return []
  const actor = state.countries[actorId]
  return Object.values(state.countries)
    .filter((country) => targetProblem(def, actor, country) === null)
    .map((country) => country.id)
}

/** Total action points a list of actions costs. */
export function actionsCost(actions: readonly PlayerAction[]): number {
  return actions.reduce((total, action) => total + getAction(action.actionId).cost, 0)
}

function resolveOption(def: ActionDef, optionId: string | undefined): ActionOption | null {
  if (!def.options) {
    if (optionId !== undefined) throw new Error(`${def.name} has no options`)
    return null
  }
  const option = def.options.find((candidate) => candidate.id === optionId)
  if (!option) {
    throw new Error(`${def.name} needs one of these options: ${def.options.map((o) => o.id).join(', ')}`)
  }
  return option
}
