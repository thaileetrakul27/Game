import type { GameState } from '../engine/index.ts'
import { alertsFor, LEVELS } from './alertTabs.ts'
import type { Tab } from './uiState.ts'

export function Warnings({ game, tab }: { game: GameState; tab: Tab }) {
  const list = alertsFor(game, tab)
  if (list.length === 0) return null
  return (
    <ul className="plain warnings" aria-label="Warnings">
      {list.map((alert) => (
        <li key={alert.id} className={`warning warning-${alert.level}`}>
          <span className="warning-icon" aria-hidden="true">
            {LEVELS[alert.level].icon}
          </span>
          <span>
            <span className="visually-hidden">{LEVELS[alert.level].label}: </span>
            <strong>{alert.title}.</strong> {alert.text}
          </span>
        </li>
      ))}
    </ul>
  )
}
