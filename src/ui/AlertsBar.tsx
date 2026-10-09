import { alerts } from '../engine/index.ts'
import type { AlertLevel } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'

/** Each level has its own icon and label, so colour never carries the meaning alone. */
const LEVELS: Record<AlertLevel, { icon: string; label: string }> = {
  critical: { icon: '!', label: 'Critical' },
  serious: { icon: '▲', label: 'Serious' },
  warning: { icon: '●', label: 'Warning' },
  info: { icon: 'i', label: 'Good news' },
}

/** The warnings that apply this turn, most urgent first. */
export function AlertsBar() {
  const game = useGameStore((store) => store.game)
  if (game.status !== 'playing') return null
  const list = alerts(game)
  if (list.length === 0) return null

  return (
    <section className="alerts" aria-label="Warnings">
      <ul className="plain">
        {list.map((alert) => (
          <li key={alert.id} className={`alert alert-${alert.level}`}>
            <span className="alert-icon" aria-hidden="true">
              {LEVELS[alert.level].icon}
            </span>
            <span>
              <span className="alert-level">{LEVELS[alert.level].label}:</span> <strong>{alert.title}.</strong>{' '}
              {alert.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
