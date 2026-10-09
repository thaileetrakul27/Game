import { getEvent } from './data.ts'
import { describeEffectsInline } from './describe.ts'
import { applyEffects } from './effects.ts'
import type { Rng } from './rng.ts'
import { withLog } from './state.ts'
import type { Effect, GameState } from './types.ts'

/**
 * Play the pending crisis card with the player's chosen response: its visible
 * effects, then its hidden ones, which only show in the log. A response with
 * a chain may also set off a follow-up card for a later turn.
 */
export function resolveCrisis(state: GameState, responseId: string | null, rng: Rng): GameState {
  const { crisis } = state
  if (crisis === null) {
    if (responseId !== null) throw new Error('There is no crisis to respond to')
    return withLog(state, 'crisis', ['No crisis this quarter.'])
  }
  const card = getEvent(crisis.cardId)
  const response = card.responses.find((candidate) => candidate.id === responseId)
  if (!response || !crisis.responseIds.includes(response.id)) {
    throw new Error(`${card.name} needs one of these responses: ${card.responses.map((r) => r.name).join(', ')}`)
  }

  const context = { actorId: state.playerId, targetId: crisis.targetId, rng }
  const visible = applyEffects({ ...state, crisis: null }, response.effects, context)
  const hidden = applyEffects(visible.state, response.hidden ?? [], context)
  let next = hidden.state

  const texts = [`${card.name}. You chose: ${response.name}.`, ...visible.texts]
  const plainHidden = (response.hidden ?? []).filter((effect: Effect) => effect.kind !== 'chance')
  if (plainHidden.length > 0) {
    texts.push(`Hidden effect: ${describeEffectsInline(state, state.playerId, crisis.targetId, plainHidden)}.`)
  }
  texts.push(...hidden.texts)

  if (response.chain && rng.next() < response.chain.chance) {
    const chain = { cardId: response.chain.card, dueTurn: state.turn + response.chain.after, targetId: crisis.targetId }
    next = { ...next, chains: [...next.chains, chain] }
  }
  return withLog(next, 'crisis', texts)
}
