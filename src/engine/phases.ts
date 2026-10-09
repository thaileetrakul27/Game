// The five phases of a turn, in the order DESIGN.md gives them. Each phase
// takes a state and returns a new one without mutating its input. Stub logic
// is marked with the milestone that replaces it.

import { actionsCost, takeAction } from './actions.ts'
import { resolveCrisis } from './crisis.ts'
import { drawCrisis } from './deck.ts'
import { getProject } from './data.ts'
import { incomeBreakdown } from './economy.ts'
import { applyEffects } from './effects.ts'
import { answerDemand, checkVassal, resolveHedging } from './hedging.ts'
import { answerOffer } from './offers.ts'
import { rivalReactions, rivalTurn } from './rivals.ts'
import { expireTradeDeals } from './trade.ts'
import type { Rng } from './rng.ts'
import { changeStat, quarterLabel, signed, withLog } from './state.ts'
import { ACTION_POINTS_PER_TURN, DEFAULT_AFTER_DEFICIT_TURNS, MAX_TURNS } from './types.ts'
import type { GameState, PlayerAction, PlayerTurn } from './types.ts'

/** 1. Briefing: income arrives in every country's treasury. Called by startTurn. */
export function briefingPhase(state: GameState): GameState {
  let next = state
  for (const country of Object.values(state.countries)) {
    next = changeStat(next, country.id, 'treasury', incomeBreakdown(state, country.id).net)
  }

  const { output, tradeLoss, tolls, interest, upkeep, net } = incomeBreakdown(state, state.playerId)
  const cut = tradeLoss > 0 ? `, trade cut -${tradeLoss}` : ''
  return withLog(next, 'briefing', [
    `${quarterLabel(state.turn)} briefing.`,
    `Income ${signed(net)}: output ${output}${cut}, strait tolls ${tolls}, debt interest -${interest}, upkeep -${upkeep}.`,
  ])
}

/** 2. Crisis: the card drawn last turn, any pending demand and any pending offer are answered with the player's choices. */
export function crisisPhase(state: GameState, playerTurn: PlayerTurn, rng: Rng): GameState {
  const afterCrisis = resolveCrisis(state, playerTurn.crisisResponse, rng)
  const afterDemand = answerDemand(afterCrisis, playerTurn.demandResponse, rng)
  return answerOffer(afterDemand, playerTurn.offerResponse, rng)
}

/** 3. Actions: the player spends action points on actions from src/data/actions.json. */
export function actionsPhase(state: GameState, playerActions: readonly PlayerAction[], rng: Rng): GameState {
  const cost = actionsCost(playerActions)
  if (cost > state.actionPoints) {
    throw new Error(`Not enough action points: the plan needs ${cost} and ${state.actionPoints} are available`)
  }

  let next: GameState = { ...state, actionPoints: state.actionPoints - cost }
  for (const action of playerActions) {
    next = takeAction(next, state.playerId, action, rng)
  }
  return next
}

/**
 * 4. Rival moves: the great power the player turned away from reacts, then
 * every computer-controlled country takes its best actions.
 */
export function rivalsPhase(state: GameState, rng: Rng, alignmentAtStart: number): GameState {
  if (!state.settings.rivals) return state
  let next = rivalReactions(state, alignmentAtStart)
  for (const rival of Object.values(state.countries)) {
    if (rival.id === state.playerId) continue
    next = rivalTurn(next, rival.id, rng).state
  }
  return next
}

/**
 * 5. Resolution: finished projects pay out, trade deals at the end of their
 * term expire, the hedging rules run (drift,
 * courting, strait risks, demands and the broker bonus), and the game checks
 * for default, vassalage and its last turn.
 */
export function resolutionPhase(state: GameState, rng: Rng, alignmentAtStart: number): GameState {
  // Stub: other win and loss checks arrive in milestone 7.
  const hedging = resolveHedging(expireTradeDeals(completeProjects(state, rng)), rng, alignmentAtStart)
  let next = checkDefault(hedging.state)
  if (next.status === 'playing') next = checkVassal(next)
  if (next.status === 'ended') return next

  if (next.turn >= MAX_TURNS) {
    return withLog({ ...next, status: 'ended', endReason: 'turnLimit' }, 'resolution', [
      `Turn ${MAX_TURNS} reached. The game is over.`,
    ])
  }
  return { ...next, turn: next.turn + 1, actionPoints: ACTION_POINTS_PER_TURN + hedging.bonusPoints }
}

/** Apply the payout of every project that finishes this turn. */
function completeProjects(state: GameState, rng: Rng): GameState {
  let next = state
  for (const country of Object.values(state.countries)) {
    for (const progress of country.projects) {
      if (progress.completesOnTurn !== state.turn) continue
      const project = getProject(progress.projectId)
      const result = applyEffects(next, project.effects, { actorId: country.id, targetId: null, rng })
      next = withLog(result.state, 'resolution', [`${country.name} completes ${project.name}.`, ...result.texts])
    }
  }
  return next
}

/** The player defaults after DEFAULT_AFTER_DEFICIT_TURNS turns in a row ending below zero. */
function checkDefault(state: GameState): GameState {
  const player = state.countries[state.playerId]
  if (player.stats.treasury >= 0) return { ...state, deficitTurns: 0 }

  const deficitTurns = state.deficitTurns + 1
  if (deficitTurns >= DEFAULT_AFTER_DEFICIT_TURNS) {
    return withLog({ ...state, deficitTurns, status: 'ended', endReason: 'default' }, 'resolution', [
      `${player.name} defaults on its debts. The game is over.`,
    ])
  }
  const left = DEFAULT_AFTER_DEFICIT_TURNS - deficitTurns
  return withLog({ ...state, deficitTurns }, 'resolution', [
    `The treasury is below zero. ${left === 1 ? 'One more turn' : `${left} more turns`} in deficit means default.`,
  ])
}

/**
 * Open a turn for the player: run its briefing, then draw its crisis card.
 * Runs when the game starts and straight after each resolution, so the player
 * sees both before choosing anything.
 */
export function startTurn(state: GameState, rng: Rng): GameState {
  return drawCrisis(briefingPhase(state), rng)
}
