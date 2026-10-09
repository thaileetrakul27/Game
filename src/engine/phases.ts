// The five phases of a turn, in the order DESIGN.md gives them. Each phase
// takes a state and returns a new one without mutating its input.
// Milestone 1: every phase is stub logic, marked with the milestone that
// replaces it.

import { drawCrisis } from './crisis.ts'
import type { Rng } from './rng.ts'
import { ACTION_POINTS_PER_TURN, MAX_TURNS } from './types.ts'
import type { GameState, LogEntry, Phase, PlayerAction } from './types.ts'

// Stub until action data arrives in milestone 2: every action costs 1 point.
const STUB_ACTION_COST = 1

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

function withLog(state: GameState, phase: Phase, texts: string[]): GameState {
  const entries: LogEntry[] = texts.map((text) => ({ turn: state.turn, phase, text }))
  return { ...state, log: [...state.log, ...entries] }
}

/** 1. Briefing: income arrives, trade flows and the news ticker runs. Called by startTurn. */
export function briefingPhase(state: GameState): GameState {
  // Stub: income and strait trade arrive in milestone 2.
  const year = Math.ceil(state.turn / 4)
  const quarter = ((state.turn - 1) % 4) + 1
  return withLog(state, 'briefing', [`Year ${year}, Q${quarter} briefing.`])
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

/** 3. Actions: the player spends action points. */
export function actionsPhase(state: GameState, playerActions: readonly PlayerAction[]): GameState {
  const cost = playerActions.length * STUB_ACTION_COST
  if (cost > state.actionPoints) {
    throw new Error(`Actions cost ${cost} points but only ${state.actionPoints} are available`)
  }
  for (const action of playerActions) {
    if (action.targetId !== undefined && !Object.hasOwn(state.countries, action.targetId)) {
      throw new Error(`Unknown target country: ${action.targetId}`)
    }
  }

  // Stub: action effects arrive in milestone 2.
  const player = state.countries[state.playerId]
  const texts = playerActions.map((action) => {
    const target = action.targetId ? ` targeting ${state.countries[action.targetId].name}` : ''
    return `${player.name} takes action "${action.actionId}"${target}.`
  })
  return withLog({ ...state, actionPoints: state.actionPoints - cost }, 'actions', texts)
}

/** 4. Rival moves: every computer-controlled country acts. */
export function rivalsPhase(state: GameState, rng: Rng): GameState {
  // Stub until the utility-based rivals arrive in milestone 6: each rival's
  // relations with the player drift by a random -2 to +2.
  const countries = { ...state.countries }
  const texts: string[] = []
  for (const rival of Object.values(state.countries)) {
    if (rival.id === state.playerId) continue
    const player = countries[state.playerId]
    const shift = rng.int(-2, 2)
    countries[rival.id] = {
      ...rival,
      relations: {
        ...rival.relations,
        [player.id]: clamp((rival.relations[player.id] ?? 0) + shift, -100, 100),
      },
    }
    countries[player.id] = {
      ...player,
      relations: {
        ...player.relations,
        [rival.id]: clamp((player.relations[rival.id] ?? 0) + shift, -100, 100),
      },
    }
    if (shift !== 0) texts.push(`${rival.name} relations with ${player.name} ${signed(shift)}.`)
  }
  return withLog({ ...state, countries }, 'rivals', texts)
}

/** 5. Resolution: stats update, thresholds are checked, the game checks for its end. */
export function resolutionPhase(state: GameState): GameState {
  // Stub: thresholds and demands arrive in milestone 5, win and loss checks in milestone 7.
  if (state.turn >= MAX_TURNS) {
    return withLog({ ...state, status: 'ended' }, 'resolution', [
      `Turn ${MAX_TURNS} reached. The game is over.`,
    ])
  }
  return { ...state, turn: state.turn + 1, actionPoints: ACTION_POINTS_PER_TURN }
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
