// The five phases of a turn, in the order DESIGN.md gives them. Each phase
// takes a state and returns a new one without mutating its input. Stub logic
// is marked with the milestone that replaces it.

import { actionsCost, takeAction } from './actions.ts'
import { drawCrisis } from './crisis.ts'
import { getProject } from './data.ts'
import { incomeBreakdown } from './economy.ts'
import { applyEffects } from './effects.ts'
import type { Rng } from './rng.ts'
import { changeRelations, changeStat, quarterLabel, signed, withLog } from './state.ts'
import { ACTION_POINTS_PER_TURN, DEFAULT_AFTER_DEFICIT_TURNS, MAX_TURNS } from './types.ts'
import type { GameState, PlayerAction } from './types.ts'

/** 1. Briefing: income arrives in every country's treasury. Called by startTurn. */
export function briefingPhase(state: GameState): GameState {
  let next = state
  for (const country of Object.values(state.countries)) {
    next = changeStat(next, country.id, 'treasury', incomeBreakdown(country).net)
  }

  // Stub: the news ticker arrives with the rivals in milestone 6.
  const { output, tolls, interest, upkeep, net } = incomeBreakdown(state.countries[state.playerId])
  return withLog(next, 'briefing', [
    `${quarterLabel(state.turn)} briefing.`,
    `Income ${signed(net)}: output ${output}, strait tolls ${tolls}, debt interest -${interest}, upkeep -${upkeep}.`,
  ])
}

/** 2. Crisis: the card drawn last turn is resolved with the player's response. */
export function crisisPhase(state: GameState, crisisResponse: string | null): GameState {
  const { crisis } = state
  if (crisis === null) {
    if (crisisResponse !== null) throw new Error('There is no crisis to respond to')
    return withLog(state, 'crisis', ['No crisis this quarter.'])
  }
  if (crisisResponse === null || !crisis.responseIds.includes(crisisResponse)) {
    throw new Error(
      `Crisis "${crisis.cardId}" needs one of these responses: ${crisis.responseIds.join(', ')}`,
    )
  }

  // Stub: response effects arrive in milestone 6.
  return withLog({ ...state, crisis: null }, 'crisis', [
    `Crisis "${crisis.cardId}": chose "${crisisResponse}".`,
  ])
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

/** 4. Rival moves: every computer-controlled country acts. */
export function rivalsPhase(state: GameState, rng: Rng): GameState {
  // Stub until the utility-based rivals arrive in milestone 6: each rival's
  // relations with the player drift by a random -2 to +2.
  const player = state.countries[state.playerId]
  let next = state
  const texts: string[] = []
  for (const rival of Object.values(state.countries)) {
    if (rival.id === state.playerId) continue
    const shift = rng.int(-2, 2)
    next = changeRelations(next, rival.id, player.id, shift)
    if (shift !== 0) texts.push(`${rival.name} relations with ${player.name} ${signed(shift)}.`)
  }
  return withLog(next, 'rivals', texts)
}

/**
 * 5. Resolution: finished projects pay out, and the game checks for the
 * player's default and for its last turn.
 */
export function resolutionPhase(state: GameState, rng: Rng): GameState {
  // Stub: thresholds and demands arrive in milestone 5, other win and loss checks in milestone 7.
  let next = completeProjects(state, rng)
  next = checkDefault(next)
  if (next.status === 'ended') return next

  if (next.turn >= MAX_TURNS) {
    return withLog({ ...next, status: 'ended', endReason: 'turnLimit' }, 'resolution', [
      `Turn ${MAX_TURNS} reached. The game is over.`,
    ])
  }
  return { ...next, turn: next.turn + 1, actionPoints: ACTION_POINTS_PER_TURN }
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
  const briefed = briefingPhase(state)
  return { ...briefed, crisis: drawCrisis(briefed, rng) }
}
