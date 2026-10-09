// Offers: actions whose target accepts or declines, such as a Merchant
// power's investment package. A computer country answers at once by its own
// utility; the player answers with the next turn's choices, like a demand.
// See DESIGN.md, "Computer rivals".

import { getAction } from './data.ts'
import { applyEffects } from './effects.ts'
import type { EffectResult } from './effects.ts'
import { createRng } from './rng.ts'
import type { Rng } from './rng.ts'
import { withLog } from './state.ts'
import type { ActionDef, CountryId, GameState, OfferResponse } from './types.ts'
import { utility } from './utility.ts'

function terms(def: ActionDef) {
  if (!def.offer) throw new Error(`${def.name} is not an offer`)
  return def.offer
}

/** Apply the receiver's answer to an offer. */
export function offerOutcome(
  state: GameState,
  receiverId: CountryId,
  offererId: CountryId,
  def: ActionDef,
  response: OfferResponse,
  rng: Rng,
): EffectResult {
  const { accepted, declined } = terms(def)
  return applyEffects(state, response === 'accept' ? accepted : declined, { actorId: receiverId, targetId: offererId, rng })
}

/** A computer country accepts an offer only if it leaves it better off than declining, by its own utility. */
export function rivalAnswer(state: GameState, receiverId: CountryId, offererId: CountryId, def: ActionDef): OfferResponse {
  // A throwaway generator, so weighing the answer never moves the game's own.
  const ifAccepted = offerOutcome(state, receiverId, offererId, def, 'accept', createRng(0)).state
  const ifDeclined = offerOutcome(state, receiverId, offererId, def, 'decline', createRng(0)).state
  return utility(state, ifAccepted, receiverId) > utility(state, ifDeclined, receiverId) ? 'accept' : 'decline'
}

/** Only one offer can wait for the player's answer at a time. */
export function checkNoOfferWaiting(state: GameState): void {
  if (state.offer) {
    const player = state.countries[state.playerId].name
    throw new Error(`${player} has not answered ${state.countries[state.offer.fromId].name}'s last offer yet`)
  }
}

/** Put an offer to the player. */
export function makeOffer(state: GameState, fromId: CountryId, actionId: string): GameState {
  checkNoOfferWaiting(state)
  return { ...state, offer: { fromId, actionId } }
}

/** Answer the offer waiting for the player. */
export function answerOffer(state: GameState, response: OfferResponse | null | undefined, rng: Rng): GameState {
  if (state.offer === null) {
    if (response) throw new Error('There is no offer to answer')
    return state
  }
  const def = getAction(state.offer.actionId)
  const from = state.countries[state.offer.fromId]
  if (response !== 'accept' && response !== 'decline') {
    throw new Error(`${from.name} wants an answer to its offer: accept or decline`)
  }
  const result = offerOutcome({ ...state, offer: null }, state.playerId, from.id, def, response, rng)
  const verb = response === 'accept' ? 'You accept' : 'You decline'
  return withLog(result.state, 'crisis', [`${verb} ${from.name}'s offer: ${terms(def).name}.`, ...result.texts])
}
