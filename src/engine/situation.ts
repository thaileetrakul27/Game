// The player's position for the interface to show: where alignment stands
// against each threshold, the counts toward a demand and the broker bonus,
// and the warnings that apply right now. Every rule comes from the engine.

import { isPast, inBrokerRange, patronOf, tradeCutBy } from './alignment.ts'
import { GAME_DATA, getDemand, getEvent, getFaction } from './data.ts'
import { accessOf, closureRisk, straitOwnedBy } from './straits.ts'
import { ACTION_POINTS_PER_TURN, DEFAULT_AFTER_DEFICIT_TURNS } from './types.ts'
import type { CountryId, FactionId, GameState } from './types.ts'

export interface HedgingStatus {
  alignment: number
  /** The great power the player leans toward, or null at zero. */
  patronId: CountryId | null
  tradeCutBy: CountryId | null
  tradeCutPast: number
  demandPast: number
  /** Alignment is beyond the demand line now. */
  pastDemandLine: boolean
  /** Turns in a row that ended past the demand line, out of demandAfterTurns. */
  demandTurns: number
  demandAfterTurns: number
  brokerWithin: number
  inBrokerRange: boolean
  /** Turns in a row that ended within the broker range, out of brokerEveryTurns. */
  brokerTurns: number
  brokerEveryTurns: number
  /** Extra action points this turn from the broker bonus. */
  bonusPoints: number
  /** Demands accepted from each great power, out of vassalAfterDemands. */
  demandsAccepted: { powerId: CountryId; count: number }[]
  vassalAfterDemands: number
}

export function hedgingStatus(state: GameState): HedgingStatus {
  const rules = GAME_DATA.hedging
  const alignment = state.countries[state.playerId].stats.alignment
  return {
    alignment,
    patronId: patronOf(state)?.id ?? null,
    tradeCutBy: tradeCutBy(state, state.playerId),
    tradeCutPast: rules.tradeCutPast,
    demandPast: rules.demandPast,
    pastDemandLine: isPast(alignment, rules.demandPast),
    demandTurns: state.demandTurns,
    demandAfterTurns: rules.demandAfterTurns,
    brokerWithin: rules.brokerWithin,
    inBrokerRange: inBrokerRange(alignment),
    brokerTurns: state.brokerTurns,
    brokerEveryTurns: rules.brokerEveryTurns,
    bonusPoints: Math.max(0, state.actionPoints - ACTION_POINTS_PER_TURN),
    demandsAccepted: Object.entries(state.demandsAccepted).map(([powerId, count]) => ({ powerId, count })),
    vassalAfterDemands: rules.vassalAfterDemands,
  }
}

export interface FactionStatus {
  id: FactionId
  name: string
  description: string
  satisfaction: number
  /** Below the unrest line, the faction can trigger its crisis card. */
  unrest: boolean
}

/** Each faction's satisfaction and whether it is in unrest. */
export function factionStatus(state: GameState): FactionStatus[] {
  const { unrestBelow, factions } = GAME_DATA.factions
  return factions.map((faction) => ({
    id: faction.id,
    name: faction.name,
    description: faction.description,
    satisfaction: state.factions[faction.id],
    unrest: state.factions[faction.id] < unrestBelow,
  }))
}

/** How urgent a warning is. Each level shows with its own icon and label, never colour alone. */
export type AlertLevel = 'critical' | 'serious' | 'warning' | 'info'

export interface Alert {
  id: string
  level: AlertLevel
  title: string
  text: string
}

const LEVEL_ORDER: AlertLevel[] = ['critical', 'serious', 'warning', 'info']

/** The warnings that apply this turn, most urgent first. */
export function alerts(state: GameState): Alert[] {
  const list: Alert[] = []
  const player = state.countries[state.playerId]
  const status = hedgingStatus(state)
  const name = (id: CountryId) => state.countries[id].name
  const side = (line: number) => `${status.alignment > 0 ? '+' : '−'}${line}`

  if (player.stats.treasury < 0) {
    const left = DEFAULT_AFTER_DEFICIT_TURNS - state.deficitTurns
    list.push({
      id: 'deficit',
      level: 'critical',
      title: 'Treasury below zero',
      text:
        left <= 1
          ? `If it is still below zero when this turn ends, ${player.name} defaults.`
          : `End ${left} turns in a row below zero and ${player.name} defaults.`,
    })
  }

  if (state.demand) {
    list.push({
      id: 'demand',
      level: 'critical',
      title: `${name(state.demand.fromId)} demands: ${getDemand(state.demand.demandId).name}`,
      text: 'Accept or refuse before ending the turn.',
    })
  }

  if (state.crisis) {
    list.push({
      id: 'crisis',
      level: 'serious',
      title: `Crisis: ${getEvent(state.crisis.cardId).name}`,
      text: 'Choose a response before ending the turn.',
    })
  }

  for (const { powerId, count } of status.demandsAccepted) {
    if (count === 0) continue
    list.push({
      id: `vassal-${powerId}`,
      level: count >= status.vassalAfterDemands - 1 ? 'critical' : 'warning',
      title: `Demands accepted from ${name(powerId)}: ${count} of ${status.vassalAfterDemands}`,
      text: `Accept ${status.vassalAfterDemands} and ${player.name} becomes its vassal, which ends the game.`,
    })
  }

  if (status.tradeCutBy) {
    const loss = Math.round(GAME_DATA.hedging.tradeCutOutputLoss * 100)
    list.push({
      id: 'trade-cut',
      level: 'serious',
      title: `${name(status.tradeCutBy)} has cut trade`,
      text:
        `Your alignment is past ${side(status.tradeCutPast)}. Output is down ${loss}%, ${name(status.tradeCutBy)} ` +
        'refuses trade deals, and it courts your neighbours against you every turn.',
    })
  }

  if (status.pastDemandLine && status.patronId) {
    list.push({
      id: 'demand-countdown',
      level: 'warning',
      title: `${name(status.patronId)} is losing patience`,
      text:
        `Turns in a row ended past ${side(status.demandPast)}: ${status.demandTurns} of ${status.demandAfterTurns}. ` +
        `At ${status.demandAfterTurns}, ${name(status.patronId)} issues a demand.`,
    })
  }

  const { unrestBelow, unrestCrisisChance } = GAME_DATA.factions
  for (const faction of factionStatus(state).filter((candidate) => candidate.unrest)) {
    const card = getEvent(getFaction(faction.id).crisisCard)
    list.push({
      id: `unrest-${faction.id}`,
      level: 'serious',
      title: `${faction.name} in unrest (${faction.satisfaction})`,
      text: `Below ${unrestBelow}, each turn brings a ${Math.round(unrestCrisisChance * 100)}% chance of its crisis card: ${card.name}.`,
    })
  }

  const strait = straitOwnedBy(state.playerId)
  if (strait) {
    const risk = Math.round(closureRisk(player.stats.defence) * 100)
    for (const powerId of Object.keys(strait.traffic)) {
      if (accessOf(state, strait.id, powerId) !== 'closed') continue
      list.push({
        id: `closed-${powerId}`,
        level: 'warning',
        title: `${strait.name} closed to ${name(powerId)}`,
        text: `Each turn brings a ${risk}% chance of a blockade or staged incident. More defence lowers it.`,
      })
    }
  }

  if (status.bonusPoints > 0) {
    list.push({
      id: 'broker-bonus',
      level: 'info',
      title: `Broker bonus: +${status.bonusPoints} action point${status.bonusPoints === 1 ? '' : 's'}`,
      text: `Both powers kept bidding for you, so you have ${state.actionPoints} action points this turn.`,
    })
  }

  return list.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
}
