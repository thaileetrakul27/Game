// Computer rivals. Each scores every legal action with a utility function
// weighted by its personality, plus a little randomness, and takes the best
// until its action points run out. See DESIGN.md, "Computer rivals".

import { takeAction, targetsFor } from './actions.ts'
import { greatPowerOnSide, tradeCutBy } from './alignment.ts'
import { GAME_DATA, getAction, getProject } from './data.ts'
import { applyEffects } from './effects.ts'
import type { Rng } from './rng.ts'
import { changeRelations, withLog } from './state.ts'
import { straitIncome } from './straits.ts'
import { ACTION_POINTS_PER_TURN } from './types.ts'
import type { ActionDef, Country, CountryId, GameState, PlayerAction } from './types.ts'

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

/** What a treasury is worth: each extra coin matters less to a rich country, and debt below zero hurts. */
function moneyValue(treasury: number): number {
  const { treasuryScale, deficitPenalty } = rules()
  return treasury >= 0 ? treasuryScale * Math.log1p(treasury / treasuryScale) : deficitPenalty * treasury
}

/**
 * What a stat, relations score or depth of alignment is worth: in full below
 * zero, and less for each point above it, so a rival stops chasing a score
 * that is already high.
 */
function softValue(value: number, scale: number): number {
  return value <= 0 ? value : scale * (1 - Math.exp(-value / scale))
}

/** The gain from moving a value from one level to another, counted with diminishing returns. */
function softGain(from: number, to: number, scale: number): number {
  return softValue(to, scale) - softValue(from, scale)
}

/** Income per turn without rounding, so small changes in growth still count. */
function incomeValue(state: GameState, id: CountryId): number {
  const country = state.countries[id]
  const output = country.economy.baseOutput * (1 + country.stats.growth / 100)
  const cut = tradeCutBy(state, id) ? output * GAME_DATA.hedging.tradeCutOutputLoss : 0
  const interest = country.stats.debt * GAME_DATA.economy.interestRatePerTurn
  return output - cut + straitIncome(state, id) + country.economy.straitTolls - interest - country.economy.upkeep
}

/** The end of the scale the smaller states lean toward overall: 1 for Halvard, -1 for Tsengai, 0 if even. */
export function winningSide(state: GameState): number {
  const minors = Object.values(state.countries).filter((country) => country.kind === 'minor')
  return Math.sign(minors.reduce((sum, country) => sum + country.stats.alignment, 0))
}

/** How far an action moved things the way this rival wants on the alignment scale. */
function blocGain(before: GameState, after: GameState, actor: Country): number {
  if (actor.kind === 'greatPower') {
    // A great power wants the smaller states, Kessara above all, to move toward its end.
    const side = Math.sign(actor.stats.alignment)
    return Object.values(before.countries)
      .filter((country) => country.kind === 'minor')
      .reduce((sum, country) => {
        const moved = (after.countries[country.id].stats.alignment - country.stats.alignment) * side
        return sum + moved * (country.id === before.playerId ? rules().playerBloc : 1)
      }, 0)
  }
  const from = actor.stats.alignment
  const to = after.countries[actor.id].stats.alignment
  const deeper = (side: number) => softGain(from * side, to * side, rules().statScale)
  switch (actor.personality) {
    case 'hardliner':
      return deeper(Math.sign(from))
    case 'opportunist':
      return deeper(winningSide(before))
    default:
      // Merchants like to stay balanced.
      return Math.abs(from) - Math.abs(to)
  }
}

/** How much better off a rival is after an action, by its personality's weights. */
export function utility(before: GameState, after: GameState, actorId: CountryId): number {
  const actor = before.countries[actorId]
  const weights = rules().personalities[actor.personality ?? 'opportunist']
  const { statScale, relationsScale } = rules()
  const was = actor.stats
  const now = after.countries[actorId].stats

  let score = weights.treasury * (moneyValue(now.treasury) - moneyValue(was.treasury))
  score += weights.income * rules().incomeHorizon * (incomeValue(after, actorId) - incomeValue(before, actorId))
  score += weights.legitimacy * softGain(was.legitimacy, now.legitimacy, statScale)
  score += weights.militaryLoyalty * softGain(was.militaryLoyalty, now.militaryLoyalty, statScale)
  score += weights.defence * softGain(was.defence, now.defence, statScale)

  for (const other of Object.values(before.countries)) {
    if (other.id === actorId) continue
    const relationsBefore = actor.relations[other.id] ?? 0
    const relationsAfter = after.countries[actorId].relations[other.id] ?? 0
    const weight = other.kind === 'greatPower' ? rules().greatPowerRelations : 1
    score += weights.relations * weight * softGain(relationsBefore, relationsAfter, relationsScale)

    // Damage done to a country counts in proportion to how hostile the rival is to it.
    const hostility = Math.max(0, -relationsBefore) / 100
    const hurt = after.countries[other.id].stats
    const damage =
      other.stats.legitimacy - hurt.legitimacy + (other.stats.defence - hurt.defence) +
      (other.stats.militaryLoyalty - hurt.militaryLoyalty)
    score += weights.harm * hostility * damage
  }

  return score + weights.bloc * blocGain(before, after, actor)
}

/** Utility of one possible outcome, counting a newly started project as if built, at a discount. */
function outcomeUtility(before: GameState, actorId: CountryId, action: PlayerAction, rng: Rng): number | null {
  let after: GameState
  try {
    after = takeAction(before, actorId, action, rng, 'rivals')
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
  return last !== undefined && state.turn - last < rules().repeatAfterTurns
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
