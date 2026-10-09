import { GAME_DATA, getEvent } from './data.ts'
import { applyEffects } from './effects.ts'
import type { Rng } from './rng.ts'
import { withLog } from './state.ts'
import type { GameState, PendingCrisis } from './types.ts'

/**
 * Draw the crisis card for the coming turn. Called when a game starts and at
 * the end of every turn, so the player always sees the card before acting.
 * A faction in unrest (below the line in factions.json) may trigger its own
 * card, starting with the least satisfied.
 */
export function drawCrisis(state: GameState, rng: Rng): PendingCrisis | null {
  const { unrestBelow, unrestCrisisChance, factions } = GAME_DATA.factions
  const restless = factions
    .filter((faction) => state.factions[faction.id] < unrestBelow)
    .sort((a, b) => state.factions[a.id] - state.factions[b.id])
  for (const faction of restless) {
    if (rng.next() < unrestCrisisChance) {
      const card = getEvent(faction.crisisCard)
      return { cardId: card.id, responseIds: card.responses.map((response) => response.id) }
    }
  }
  // Stub: the weighted, conditional event deck arrives in milestone 6.
  return null
}

/** Play the pending crisis card with the player's chosen response. */
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

  const result = applyEffects({ ...state, crisis: null }, response.effects, {
    actorId: state.playerId,
    targetId: null,
    rng,
  })
  return withLog(result.state, 'crisis', [`${card.name}. You chose: ${response.name}.`, ...result.texts])
}
