// The event deck: which cards can be drawn now, how likely each is, and the
// draw itself. See DESIGN.md, "Crises and events".

import { patronOf } from './alignment.ts'
import { GAME_DATA, getEvent } from './data.ts'
import { otherGreatPower } from './effects.ts'
import type { Rng } from './rng.ts'
import { accessOf, straitOwnedBy } from './straits.ts'
import type { Condition, CountryId, EventCard, GameState, PendingCrisis } from './types.ts'

function inRange(value: number, above: number | undefined, below: number | undefined): boolean {
  return (above === undefined || value > above) && (below === undefined || value < below)
}

export function conditionHolds(state: GameState, condition: Condition): boolean {
  switch (condition.kind) {
    case 'stat': {
      const country = state.countries[condition.country ?? state.playerId]
      return inRange(country.stats[condition.stat], condition.above, condition.below)
    }
    case 'relations': {
      const relations = state.countries[state.playerId].relations[condition.country] ?? 0
      return inRange(relations, condition.above, condition.below)
    }
    case 'faction':
      return inRange(state.factions[condition.faction], condition.above, condition.below)
    case 'straitClosed': {
      const strait = straitOwnedBy(state.playerId)
      return !!strait && Object.keys(strait.traffic).some((powerId) => accessOf(state, strait.id, powerId) === 'closed')
    }
    case 'turn':
      return (condition.from === undefined || state.turn >= condition.from) && (condition.to === undefined || state.turn <= condition.to)
  }
}

/** The great power the player owes most, or undefined when the player owes the great powers nothing. */
function largestCreditor(state: GameState): CountryId | undefined {
  const owed = Object.entries(state.countries[state.playerId].creditors).filter(([, amount]) => amount > 0)
  return owed.sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** A card's chance weight right now, counting its conditions, boosts and repeat limit. 0 means it can't be drawn. */
export function cardWeight(state: GameState, card: EventCard): number {
  if (card.weight <= 0) return 0
  if (!(card.conditions ?? []).every((condition) => conditionHolds(state, condition))) return 0
  if (card.target === 'largestCreditor' && !largestCreditor(state)) return 0
  const lastDrawn = state.lastDrawn[card.id]
  if (lastDrawn !== undefined && state.turn - lastDrawn < GAME_DATA.deck.cooldownTurns) return 0
  return (card.boosts ?? []).reduce(
    (weight, boost) => (conditionHolds(state, boost.when) ? weight * boost.times : weight),
    card.weight,
  )
}

/** Who a drawn card is about. With the player at exactly zero alignment, either power may be the patron. */
function cardTarget(state: GameState, card: EventCard, rng: Rng): CountryId | null {
  switch (card.target) {
    case undefined:
      return null
    case 'largestCreditor':
      return largestCreditor(state) ?? null
    case 'patron':
    case 'otherPower': {
      const powers = Object.values(state.countries).filter((country) => country.kind === 'greatPower')
      const patron = patronOf(state) ?? rng.pick(powers)
      return card.target === 'patron' ? patron.id : otherGreatPower(state, patron.id)
    }
    default:
      return card.target
  }
}

function pending(card: EventCard, targetId: CountryId | null): PendingCrisis {
  return { cardId: card.id, responseIds: card.responses.map((response) => response.id), targetId }
}

/**
 * Draw the crisis card for the coming turn. Called when a game starts and at
 * the end of every turn, so the player always sees the card before acting.
 * In order: a chained card that has come due, a faction's card if it is in
 * unrest, then a card picked by weight from those that can be drawn.
 */
export function drawCrisis(state: GameState, rng: Rng): GameState {
  if (!state.settings.events) return { ...state, crisis: null }

  const due = state.chains.find((chain) => chain.dueTurn <= state.turn)
  if (due) {
    return {
      ...state,
      chains: state.chains.filter((chain) => chain !== due),
      crisis: pending(getEvent(due.cardId), due.targetId),
    }
  }

  const { unrestBelow, unrestCrisisChance, factions } = GAME_DATA.factions
  const restless = factions
    .filter((faction) => state.factions[faction.id] < unrestBelow)
    .sort((a, b) => state.factions[a.id] - state.factions[b.id])
  for (const faction of restless) {
    if (rng.next() < unrestCrisisChance) return { ...state, crisis: pending(getEvent(faction.crisisCard), null) }
  }

  const weighted = GAME_DATA.events
    .map((card) => ({ card, weight: cardWeight(state, card) }))
    .filter((entry) => entry.weight > 0)
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  if (total === 0) return { ...state, crisis: null }

  let roll = rng.next() * total
  const drawn = weighted.find((entry) => (roll -= entry.weight) < 0) ?? weighted[weighted.length - 1]
  return {
    ...state,
    crisis: pending(drawn.card, cardTarget(state, drawn.card, rng)),
    lastDrawn: { ...state.lastDrawn, [drawn.card.id]: state.turn },
  }
}
