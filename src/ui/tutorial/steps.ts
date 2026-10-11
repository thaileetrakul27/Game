// The tutorial's steps over its three turns. Each one points at a part of the
// screen, marked in the components with a data-tour attribute, and either
// waits for the player to try it or offers Next. The numbers in the text come
// from the game data, so they stay true if the data changes.

import { ACTION_POINTS_PER_TURN, DEFAULT_AFTER_DEFICIT_TURNS, GAME_DATA, latestNews, MAX_TURNS } from '../../engine/index.ts'
import type { CountryId, GameState, PlayerAction } from '../../engine/index.ts'
import type { Tab } from '../uiState.ts'

/** What the tutorial watches to know when a step is done. */
export interface TourContext {
  game: GameState
  planned: PlayerAction[]
  crisisResponse: string | null
  offerResponse: string | null
  selectedCountryId: CountryId | null
  tab: Tab
  wide: boolean
  /** Where the player is: reading the briefing, or on the map with its tabs and panels. */
  where: 'briefing' | 'map'
}

export interface TourStep {
  id: string
  /** Which of the tutorial's turns it belongs to: its first, second or third. */
  turn: 0 | 1 | 2
  where: 'briefing' | 'map'
  /** Only with the tab bar on a phone, or only with the side panels on a wide screen. */
  layout?: 'narrow' | 'wide'
  /** What it points at: the first of these on screen. Without one, it is a note on its own. */
  targets?: string[]
  title: string
  text: (context: TourContext) => string
  /** What to do to move on, shown instead of Next. */
  task?: string
  /** True once the player has done what the step asks, and the tutorial moves on. */
  done?: (context: TourContext) => boolean
  /** Leave the step out when there is nothing for it to show. */
  when?: (context: TourContext) => boolean
  /** Where the note goes when there is no room beside what it points at: over the top or the bottom of the screen. */
  overlap?: 'top' | 'bottom'
}

const tour = (name: string) => `[data-tour="${name}"]`
const { hedging } = GAME_DATA
const playerName = (context: TourContext) => context.game.countries[context.game.playerId].name

export const STEPS: TourStep[] = [
  // Turn 1: the briefing, the map, a country's file, orders and ending the turn.
  {
    id: 'welcome',
    turn: 0,
    where: 'briefing',
    targets: [tour('briefing-head')],
    title: 'Your first briefing',
    text: (context) =>
      `You lead ${playerName(context)}, a small state on a strait that two great powers both want. Stay in power for ` +
      `${MAX_TURNS} turns and get richer without ever fully picking a side. Each turn is a quarter, and opens with a briefing like this.`,
  },
  {
    id: 'treasury',
    turn: 0,
    where: 'briefing',
    targets: [tour('treasury')],
    title: 'The treasury',
    text: () =>
      'What came in this quarter and what went out. Keep it out of the red: ' +
      `${DEFAULT_AFTER_DEFICIT_TURNS} quarters in a row below zero and you default on your debts, which ends the game.`,
  },
  {
    id: 'crisis',
    turn: 0,
    where: 'briefing',
    targets: [tour('crisis')],
    title: 'A crisis',
    text: () =>
      'Every quarter brings a crisis to answer. Each answer lists exactly what it will do, and some carry a risk.',
    task: 'Tick an answer to go on.',
    overlap: 'top',
    when: (context) => context.game.crisis !== null,
    done: (context) => context.crisisResponse !== null,
  },
  {
    id: 'offer',
    turn: 0,
    where: 'briefing',
    targets: [tour('offer')],
    title: 'An offer',
    text: () => 'Another country is offering a deal. Accept or decline it, with its effects set out like a crisis.',
    task: 'Accept or decline to go on.',
    overlap: 'top',
    when: (context) => context.game.offer !== null,
    done: (context) => context.offerResponse !== null,
  },
  {
    id: 'to-map',
    turn: 0,
    where: 'briefing',
    targets: [tour('to-map')],
    title: 'To the map',
    text: (context) =>
      context.wide
        ? 'You give your orders on the map. The Briefing button at the top brings this paper back until the turn ends.'
        : 'You give your orders on the map. The tray at the bottom brings this paper back until the turn ends.',
    task: 'Go to the map.',
    done: (context) => context.where === 'map',
  },
  {
    id: 'readouts',
    turn: 0,
    where: 'map',
    targets: [tour('readouts')],
    title: 'Your readouts',
    text: () =>
      'Treasury, action points left this turn, legitimacy, military loyalty, and your alignment between Tsengai ' +
      'and Halvard. Tap them any time for the full stats.',
  },
  {
    id: 'chart',
    turn: 0,
    where: 'map',
    targets: [tour('chart')],
    title: 'The Meridian Sea',
    text: () =>
      'Countries leaning toward the Halvard Compact are blue, and toward the Tsengai Republic orange. ' +
      'The dashed lines are straits, which carry the region’s trade.',
    task: 'Tap a country other than your own.',
    done: (context) => context.selectedCountryId !== null && context.selectedCountryId !== context.game.playerId,
  },
  {
    id: 'file',
    turn: 0,
    where: 'map',
    targets: [tour('country-file'), tour('chart')],
    title: 'Its file',
    text: () =>
      'Where it leans, how it gets on with you, and the orders you can give about it, each with its exact effects.',
    task: 'Add an order to go on.',
    done: (context) => context.planned.length > 0,
  },
  {
    id: 'tray',
    turn: 0,
    where: 'map',
    targets: [tour('tray')],
    title: 'Your orders',
    text: () =>
      `Orders wait here until the turn ends, and × takes one back. Each costs action points, and you have ` +
      `${ACTION_POINTS_PER_TURN} a turn.`,
  },
  {
    id: 'home',
    turn: 0,
    where: 'map',
    targets: [tour('home')],
    title: 'Home',
    text: (context) =>
      `Tap ${playerName(context)} itself for orders at home: domestic reform, military spending and infrastructure.`,
    task: 'Tap your own country.',
    done: (context) => context.selectedCountryId === context.game.playerId,
  },
  {
    id: 'end-turn',
    turn: 0,
    where: 'map',
    targets: [tour('end-turn')],
    title: 'End the turn',
    text: () =>
      'When your orders are in, end the turn. The other countries make their moves, the quarter is settled, ' +
      'and the next briefing arrives.',
    task: 'End the turn when you are ready.',
  },

  // Turn 2: the intelligence in the briefing, then the Economy and Factions panels.
  {
    id: 'intelligence',
    turn: 1,
    where: 'briefing',
    targets: [tour('intelligence')],
    title: 'Intelligence',
    text: () =>
      'What every other country did last quarter. Watch who is courting whom, and who is working on your neighbours.',
    when: (context) => latestNews(context.game).length > 0,
  },
  {
    id: 'economy-tab',
    turn: 1,
    where: 'map',
    layout: 'narrow',
    targets: [tour('tab-economy')],
    title: 'The tabs',
    text: () => 'The tabs along the bottom hold the rest of the picture, next to the map.',
    task: 'Open Economy.',
    done: (context) => context.tab === 'economy',
  },
  {
    id: 'economy',
    turn: 1,
    where: 'map',
    targets: [tour('economy')],
    title: 'Economy',
    text: () =>
      'Your income line by line, debts by creditor, trade deals with the turns each has left, and access to the ' +
      'straits. Anything going wrong with money shows as a warning at the top.',
  },
  {
    id: 'factions-tab',
    turn: 1,
    where: 'map',
    layout: 'narrow',
    targets: [tour('tab-factions')],
    title: 'Factions',
    text: () => 'Politics at home is next door.',
    task: 'Open Factions.',
    done: (context) => context.tab === 'factions',
  },
  {
    id: 'factions',
    turn: 1,
    where: 'map',
    targets: [tour('factions')],
    title: 'Factions',
    text: () =>
      'How satisfied each group at home is. Below the line, a faction can set off a crisis. Legitimacy and the ' +
      'army’s loyalty are what keep you in power.',
  },
  {
    id: 'map-tab',
    turn: 1,
    where: 'map',
    layout: 'narrow',
    targets: [tour('tab-map')],
    title: 'Back to the chart',
    text: () => 'A marker on a tab means a warning is waiting there.',
    task: 'Go back to the map.',
    done: (context) => context.tab === 'map',
  },

  // Turn 3: alignment and its lines.
  {
    id: 'alignment',
    turn: 2,
    where: 'map',
    targets: [tour('alignment'), tour('alignment-readout')],
    title: 'Alignment',
    text: () =>
      'Your alignment runs from Tsengai at −100 to Halvard at +100. Deals and loans pull it toward a power, and ' +
      `it drifts back toward zero by ${hedging.driftPerTurn} a turn when nothing moves it. ` +
      `Stay within ±${hedging.brokerWithin} and you are a broker: every ${hedging.brokerEveryTurns} turns in a row ` +
      `there earn an extra action point.`,
  },
  {
    id: 'lines',
    turn: 2,
    where: 'map',
    targets: [tour('alignment'), tour('alignment-readout')],
    title: 'The lines',
    text: () =>
      `Past ±${hedging.tradeCutPast}, the other power cuts trade with you, costing ` +
      `${Math.round(hedging.tradeCutOutputLoss * 100)}% of your output. Past ±${hedging.demandPast} for ` +
      `${hedging.demandAfterTurns} turns in a row, your patron sends demands, stamped urgent in the briefing. ` +
      `Accept ${hedging.vassalAfterDemands} from the same power and you become its vassal, which ends the game.`,
  },
  {
    id: 'finished',
    turn: 2,
    where: 'map',
    title: 'You have the helm',
    text: () =>
      'That is everything. From here you are on your own, Prime Minister. The menu can run this tutorial again any time.',
  },
]

/** Where the tutorial is: the step to show now, one waiting for its turn or screen, or the end. */
export type TourPosition =
  | { kind: 'show'; index: number; step: TourStep }
  | { kind: 'wait'; index: number }
  | { kind: 'finished' }

/**
 * The step the tutorial is on, from the one it last showed. Steps that don't
 * apply, that the player has already done or whose turn has passed are
 * stepped over, and so are the briefing's steps once the player has gone on
 * to the map. A step for a later turn, or for the map while the player is
 * reading the briefing, waits.
 */
export function tourPosition(from: number, turnsIn: number, context: TourContext): TourPosition {
  for (let index = from; index < STEPS.length; index++) {
    const step = STEPS[index]
    if (step.turn < turnsIn) continue
    if (step.layout && step.layout !== (context.wide ? 'wide' : 'narrow')) continue
    // A later turn's steps wait for it, before asking whether they apply.
    if (step.turn > turnsIn) return { kind: 'wait', index }
    if (step.when && !step.when(context)) continue
    if (step.done?.(context)) continue
    if (step.where !== context.where) {
      // Once the player has gone on to the map, the briefing's part of the turn is over.
      if (step.where === 'briefing') continue
      return { kind: 'wait', index }
    }
    return { kind: 'show', index, step }
  }
  return { kind: 'finished' }
}

/** Which of its turn's steps this is, and how many that turn has, leaving out any that don't apply. */
export function stepCount(index: number, context: TourContext): { number: number; of: number } {
  const turn = STEPS[index].turn
  const applies = (step: TourStep) =>
    step.turn === turn &&
    (!step.layout || step.layout === (context.wide ? 'wide' : 'narrow')) &&
    (!step.when || step.when(context))
  return { number: STEPS.slice(0, index + 1).filter(applies).length, of: STEPS.filter(applies).length }
}
