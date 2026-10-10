// Which tab each warning belongs in. Presentation only: the warnings
// themselves come from the engine.

import { alerts } from '../engine/index.ts'
import type { Alert, AlertLevel, GameState } from '../engine/index.ts'
import type { Tab } from './uiState.ts'

/** Each level has its own icon and label, so colour never carries the meaning alone. */
export const LEVELS: Record<AlertLevel, { icon: string; label: string }> = {
  critical: { icon: '!', label: 'Critical' },
  serious: { icon: '▲', label: 'Serious' },
  warning: { icon: '●', label: 'Warning' },
  info: { icon: 'i', label: 'Good news' },
}

/**
 * The tab each warning belongs in. The crisis, demands and offers are answered
 * in the briefing, so they have no tab.
 */
function tabOf(alert: Alert): Tab | null {
  if (alert.id === 'deficit' || alert.id === 'trade-cut' || alert.id.startsWith('closed-')) return 'economy'
  if (
    alert.id.startsWith('unrest-') ||
    alert.id.startsWith('vassal-') ||
    alert.id === 'demand-countdown' ||
    alert.id === 'broker-bonus'
  ) {
    return 'factions'
  }
  return null
}

export function alertsFor(game: GameState, tab: Tab): Alert[] {
  if (game.status !== 'playing') return []
  return alerts(game).filter((alert) => tabOf(alert) === tab)
}

/** The most urgent level among a tab's warnings, for its marker, or null. Good news gets no marker. */
export function tabMarker(game: GameState, tab: Tab): AlertLevel | null {
  const level = alertsFor(game, tab).find((alert) => alert.level !== 'info')?.level
  return level ?? null
}
