// The hedging rules that run at the end of each turn, and answering demands.
// See DESIGN.md, "Hedging and demands" and "Strait control". These rules
// apply to the player.

import { inBrokerRange, isPast, patronOf, tradeCutBy } from './alignment.ts'
import { GAME_DATA, getDemand } from './data.ts'
import { describeEffectsInline } from './describe.ts'
import { applyEffects, pullAlignment } from './effects.ts'
import type { Rng } from './rng.ts'
import { changeRelations, changeStat, withLog } from './state.ts'
import { accessOf, closureRisk, straitOwnedBy } from './straits.ts'
import type { DemandResponse, GameState } from './types.ts'

const rules = () => GAME_DATA.hedging

/**
 * Run the end-of-turn hedging rules in order: drift, courting, the risks of
 * a closed strait, the count toward a demand, and the count toward the
 * broker bonus. Returns the new state and the bonus action points for the
 * next turn.
 */
export function resolveHedging(
  state: GameState,
  rng: Rng,
  alignmentAtStart: number,
): { state: GameState; bonusPoints: number } {
  let next = drift(state, alignmentAtStart)
  next = court(next)
  next = closureStrikes(next, rng)
  next = countTowardDemand(next, rng)
  return countTowardBroker(next)
}

/** If nothing moved the player's alignment this turn, it drifts toward zero, never past it. */
function drift(state: GameState, alignmentAtStart: number): GameState {
  const alignment = state.countries[state.playerId].stats.alignment
  if (alignment !== alignmentAtStart || alignment === 0) return state
  const step = Math.min(Math.abs(alignment), rules().driftPerTurn)
  return withLog(changeStat(state, state.playerId, 'alignment', -Math.sign(alignment) * step), 'resolution', [
    `With nothing pulling it, alignment drifts ${step} toward the centre.`,
  ])
}

/** A power that has cut trade courts each neighbour against the player. */
function court(state: GameState): GameState {
  const powerId = tradeCutBy(state, state.playerId)
  if (!powerId) return state
  let next = state
  for (const neighbour of Object.values(state.countries)) {
    if (neighbour.kind !== 'minor' || neighbour.id === state.playerId) continue
    next = changeRelations(next, neighbour.id, state.playerId, rules().courtingRelations)
    next = pullAlignment(next, powerId, neighbour.id, rules().courtingAlignment)
  }
  return withLog(next, 'resolution', [
    `${state.countries[powerId].name} has cut trade and courts your neighbours against you.`,
  ])
}

/** Each power shut out of the player's strait may answer with a blockade or an incident. */
function closureStrikes(state: GameState, rng: Rng): GameState {
  const strait = straitOwnedBy(state.playerId)
  if (!strait) return state
  let next = state
  for (const powerId of Object.keys(strait.traffic)) {
    if (accessOf(next, strait.id, powerId) !== 'closed') continue
    if (rng.next() >= closureRisk(next.countries[state.playerId].stats.defence)) continue

    const event = rng.pick(GAME_DATA.straitControl.closureEvents)
    const context = { actorId: state.playerId, targetId: powerId, rng }
    const outcome = describeEffectsInline(next, state.playerId, powerId, event.effects)
    const result = applyEffects(next, event.effects, context)
    const text = event.text.replace('{power}', next.countries[powerId].name).replace(/\.$/, '')
    next = withLog(result.state, 'resolution', [`${text}: ${outcome}.`, ...result.texts])
  }
  return next
}

/** Count turns past the demand line. After enough in a row, the patron issues a demand. */
function countTowardDemand(state: GameState, rng: Rng): GameState {
  const alignment = state.countries[state.playerId].stats.alignment
  if (!isPast(alignment, rules().demandPast)) return { ...state, demandTurns: 0 }

  const demandTurns = state.demandTurns + 1
  const patron = patronOf(state)
  if (demandTurns < rules().demandAfterTurns || state.demand !== null || !patron) return { ...state, demandTurns }

  const demand = rng.pick(GAME_DATA.demands)
  return withLog({ ...state, demandTurns: 0, demand: { demandId: demand.id, fromId: patron.id } }, 'resolution', [
    `${patron.name} issues a demand: ${demand.name}.`,
  ])
}

/** Count turns in the broker range. Every so many in a row earns bonus action points next turn. */
function countTowardBroker(state: GameState): { state: GameState; bonusPoints: number } {
  const alignment = state.countries[state.playerId].stats.alignment
  if (!inBrokerRange(alignment)) return { state: { ...state, brokerTurns: 0 }, bonusPoints: 0 }

  const brokerTurns = state.brokerTurns + 1
  if (brokerTurns < rules().brokerEveryTurns) return { state: { ...state, brokerTurns }, bonusPoints: 0 }

  const bonus = rules().brokerBonusPoints
  const points = bonus === 1 ? '1 extra action point' : `${bonus} extra action points`
  return {
    state: withLog({ ...state, brokerTurns: 0 }, 'resolution', [`Both powers keep bidding for you: ${points} next turn.`]),
    bonusPoints: bonus,
  }
}

/** Answer the pending demand. Accepting applies the demand's effects; refusing applies the refusal's. */
export function answerDemand(state: GameState, response: DemandResponse | null | undefined, rng: Rng): GameState {
  if (state.demand === null) {
    if (response) throw new Error('There is no demand to answer')
    return state
  }
  const demand = getDemand(state.demand.demandId)
  const patron = state.countries[state.demand.fromId]
  if (response !== 'accept' && response !== 'refuse') {
    throw new Error(`${patron.name} demands an answer: accept or refuse`)
  }

  const effects = response === 'accept' ? demand.accept : rules().demandRefusal
  const result = applyEffects({ ...state, demand: null }, effects, { actorId: state.playerId, targetId: patron.id, rng })
  let next = result.state
  if (response === 'accept') {
    const accepted = (next.demandsAccepted[patron.id] ?? 0) + 1
    next = { ...next, demandsAccepted: { ...next.demandsAccepted, [patron.id]: accepted } }
  }
  const verb = response === 'accept' ? 'You accept' : 'You refuse'
  return withLog(next, 'crisis', [`${verb} ${patron.name}'s demand: ${demand.name}.`, ...result.texts])
}

/** Accepting enough demands from one power makes the player its vassal, which ends the game. */
export function checkVassal(state: GameState): GameState {
  const entry = Object.entries(state.demandsAccepted).find(([, count]) => count >= rules().vassalAfterDemands)
  if (!entry) return state
  const player = state.countries[state.playerId]
  const power = state.countries[entry[0]]
  return withLog({ ...state, status: 'ended', endReason: 'vassal' }, 'resolution', [
    `${player.name} has accepted ${entry[1]} demands from ${power.name} and is now its vassal. The game is over.`,
  ])
}
