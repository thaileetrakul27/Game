// Computer rivals. Each scores every legal action with a utility function
// weighted by its personality, plus a little randomness, and takes the best
// until its action points run out. See DESIGN.md, "Computer rivals".

import { canTake, takeAction, targetsFor } from './actions.ts'
import { greatPowerOnSide } from './alignment.ts'
import { GAME_DATA, getAction, getProject } from './data.ts'
import { applyEffects } from './effects.ts'
import type { Rng } from './rng.ts'
import { changeRelations, withLog } from './state.ts'
import { ACTION_POINTS_PER_TURN } from './types.ts'
import type { ActionDef, CountryId, GameState, PlayerAction } from './types.ts'
import { utility } from './utility.ts'

const rules = () => GAME_DATA.rivals

/** A generator that always rolls the same value, to score chance effects as certain or as never happening. */
function fixedRng(value: number): Rng {
  return {
    next: () => value,
    int: (min) => min,
    pick: (items) => items[0],
    get state() {
      return 0
    },
  }
}

/**
 * Every action a rival could try: each action with each allowed target and
 * option. The two great powers are rivals for the region and never deal with
 * each other, and nobody signs a deal with the player on the player's behalf.
 */
export function candidateActions(state: GameState, actorId: CountryId): PlayerAction[] {
  const actor = state.countries[actorId]
  const allowed = (def: ActionDef, targetId: CountryId) =>
    !(def.playerMustAgree && targetId === state.playerId) &&
    !(actor.kind === 'greatPower' && state.countries[targetId].kind === 'greatPower')

  const candidates: PlayerAction[] = []
  for (const def of GAME_DATA.actions) {
    if (!canTake(state, actorId, def)) continue
    const targets =
      def.target === 'none' ? [undefined] : targetsFor(state, actorId, def.id).filter((id) => allowed(def, id))
    const options = def.options ? def.options.map((option) => option.id) : [undefined]
    for (const targetId of targets) {
      for (const option of options) {
        const action: PlayerAction = { actionId: def.id }
        if (targetId) action.targetId = targetId
        if (option) action.option = option
        candidates.push(action)
      }
    }
  }
  return candidates
}

/** Utility of one possible outcome, counting a newly started project as if built, at a discount. */
function outcomeUtility(before: GameState, actorId: CountryId, action: PlayerAction, rng: Rng): number | null {
  let after: GameState
  try {
    // An offer to the player is weighed as if the player accepts it.
    after = takeAction(before, actorId, action, rng, 'rivals', true)
  } catch {
    return null
  }
  const now = utility(before, after, actorId)
  const started = after.countries[actorId].projects.filter(
    (progress) => !before.countries[actorId].projects.some((old) => old.projectId === progress.projectId),
  )
  if (started.length === 0) return now

  let built = after
  for (const progress of started) {
    built = applyEffects(built, getProject(progress.projectId).effects, { actorId, targetId: null, rng }).state
  }
  return now + rules().projectDiscount * (utility(before, built, actorId) - now)
}

/**
 * The expected utility of an action for a rival, or null when the rules don't
 * allow it. A chance effect is scored at its expected value, so the rival
 * can't see the outcome in advance.
 */
export function scoreAction(state: GameState, actorId: CountryId, action: PlayerAction): number | null {
  // An empty log keeps the trial runs cheap.
  const before: GameState = { ...state, log: [] }
  const def = getAction(action.actionId)
  const option = def.options?.find((candidate) => candidate.id === action.option)
  const chance = [...def.effects, ...(option?.effects ?? [])].find((effect) => effect.kind === 'chance')
  const probability = chance?.kind === 'chance' ? chance.probability : 0

  const without = outcomeUtility(before, actorId, action, fixedRng(0.999999))
  if (without === null || probability === 0) return without
  const withIt = outcomeUtility(before, actorId, action, fixedRng(0)) ?? without
  return (1 - probability) * without + probability * withIt
}

const actionKey = (action: PlayerAction) => `${action.actionId}|${action.targetId ?? ''}|${action.option ?? ''}`

/** Whether the rival took this same action, with the same target and option, too recently to take it again. */
function tookRecently(state: GameState, rivalId: CountryId, action: PlayerAction): boolean {
  const last = state.rivalHistory[rivalId]?.[actionKey(action)]
  const wait = rules().repeatAfterTurnsFor[action.actionId] ?? rules().repeatAfterTurns
  return last !== undefined && state.turn - last < wait
}

function remember(state: GameState, rivalId: CountryId, action: PlayerAction): GameState {
  const history = { ...state.rivalHistory[rivalId], [actionKey(action)]: state.turn }
  return { ...state, rivalHistory: { ...state.rivalHistory, [rivalId]: history } }
}

/**
 * One rival's turn: take the best legal action again and again until its
 * points run out or nothing is expected to score above the minimum. The
 * randomness only changes the order of actions worth taking, never makes a
 * worthless one worth it. A rival doesn't repeat an action on the same
 * target within a few turns, so it never takes the same one twice in a turn.
 */
export function rivalTurn(
  state: GameState,
  rivalId: CountryId,
  rng: Rng,
  noise: number = rules().noise,
): { state: GameState; actions: PlayerAction[] } {
  let next = state
  let points = ACTION_POINTS_PER_TURN
  const taken: PlayerAction[] = []

  for (;;) {
    let best: { action: PlayerAction; score: number } | null = null
    for (const action of candidateActions(next, rivalId)) {
      if (getAction(action.actionId).cost > points || tookRecently(next, rivalId, action)) continue
      const expected = scoreAction(next, rivalId, action)
      if (expected === null || expected <= rules().minimumUtility) continue
      const score = expected + (rng.next() * 2 - 1) * noise
      if (!best || score > best.score) best = { action, score }
    }
    if (!best) return { state: next, actions: taken }

    next = remember(takeAction(next, rivalId, best.action, rng, 'rivals'), rivalId, best.action)
    taken.push(best.action)
    points -= getAction(best.action.actionId).cost
  }
}

/**
 * The great power the player's alignment moved away from this turn resents
 * it, losing relations in proportion to how far it moved.
 */
export function rivalReactions(state: GameState, alignmentAtStart: number): GameState {
  const player = state.countries[state.playerId]
  const moved = player.stats.alignment - alignmentAtStart
  const resentful = greatPowerOnSide(state, -moved)
  const favoured = greatPowerOnSide(state, moved)
  const loss = Math.round(Math.abs(moved) * rules().reactionPerAlignment)
  if (moved === 0 || loss === 0 || !resentful || !favoured) return state
  return withLog(
    changeRelations(state, resentful.id, player.id, -loss),
    'rivals',
    [`${resentful.name} resents ${player.name}'s turn toward ${favoured.name}: relations −${loss}.`],
    resentful.id,
  )
}
