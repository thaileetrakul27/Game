// What is happening in each country, as the map marks it and its file lists
// it: unrest, fortification, a boom, being a client, hostility, trade with
// the player, this quarter's crisis and building. The levels come from
// src/data/conditions.json. See DESIGN.md, "The map reacts".

import { greatPowerOnSide, isPast } from './alignment.ts'
import { GAME_DATA, getEvent, getProject } from './data.ts'
import { factionStatus } from './situation.ts'
import { projectTurnsLeft } from './state.ts'
import { activeDeal } from './trade.ts'
import type { CountryId, GameState } from './types.ts'

export type CountryConditionId =
  | 'crisis'
  | 'unrest'
  | 'hostile'
  | 'client'
  | 'fortified'
  | 'booming'
  | 'trading'
  | 'building'

export interface CountryCondition {
  id: CountryConditionId
  /** A short name, such as "In unrest" or "Halvard Compact's client". */
  name: string
  /** What it means, and how the map shows it, in a sentence. */
  text: string
  /** The other country involved: the patron of a client, or the player for a trade route. */
  otherId?: CountryId
}

/** The conditions that hold for a country now, most pressing first. */
export function countryConditions(state: GameState, countryId: CountryId): CountryCondition[] {
  const levels = GAME_DATA.conditions
  const country = state.countries[countryId]
  const player = state.countries[state.playerId]
  const isPlayer = countryId === state.playerId
  const { stats } = country
  const list: CountryCondition[] = []

  const crisis = state.crisis
  if (crisis && (crisis.targetId ?? state.playerId) === countryId) {
    list.push({
      id: 'crisis',
      name: "This quarter's crisis",
      text: `${getEvent(crisis.cardId).name}: a ring pulses over it until the crisis is answered.`,
    })
  }

  const factionsInUnrest = isPlayer ? factionStatus(state).filter((faction) => faction.unrest) : []
  if (stats.legitimacy < levels.unrestLegitimacyBelow || factionsInUnrest.length > 0) {
    list.push({
      id: 'unrest',
      name: 'In unrest',
      text:
        stats.legitimacy < levels.unrestLegitimacyBelow
          ? 'Its government has lost legitimacy, and smoke rises over the capital.'
          : `${factionsInUnrest.map((faction) => faction.name).join(' and ')} in unrest, and smoke rises over the capital.`,
    })
  }

  if (!isPlayer && (player.relations[countryId] ?? 0) <= levels.hostileRelationsAtMost) {
    list.push({
      id: 'hostile',
      name: `Hostile to ${player.name}`,
      text: `Relations with ${player.name} have broken down: crossed swords over its capital.`,
    })
  }

  const patron = country.kind === 'minor' ? greatPowerOnSide(state, stats.alignment) : null
  if (patron && isPast(stats.alignment, GAME_DATA.hedging.demandPast)) {
    list.push({
      id: 'client',
      name: `${patron.name}'s client`,
      text: `It is deep in ${patron.name}'s camp, and hatched in its colour.`,
      otherId: patron.id,
    })
  }

  if (stats.defence >= levels.fortifiedDefenceAtLeast) {
    list.push({ id: 'fortified', name: 'Fortified', text: 'Its defences are strong: battlements line its borders.' })
  }

  if (stats.growth >= levels.boomingGrowthAtLeast) {
    list.push({ id: 'booming', name: 'Booming', text: 'Its economy is booming, and its towns are lit.' })
  }

  if (!isPlayer && activeDeal(state, state.playerId, countryId)) {
    list.push({
      id: 'trading',
      name: `Trading with ${player.name}`,
      text: `A trade deal is in force: a route runs between the two capitals.`,
      otherId: state.playerId,
    })
  }

  const underWay = country.projects.filter((progress) => projectTurnsLeft(state, progress) > 0)
  if (underWay.length > 0) {
    const names = underWay.map((progress) => getProject(progress.projectId).name)
    list.push({
      id: 'building',
      name: 'Building',
      text: `${names.join(' and ')} under way: scaffolding stands by the capital.`,
    })
  }

  return list
}

/** The projects a country has finished, which stay on the map. */
export function builtProjects(state: GameState, countryId: CountryId): string[] {
  return state.countries[countryId].projects
    .filter((progress) => projectTurnsLeft(state, progress) === 0)
    .map((progress) => progress.projectId)
}
