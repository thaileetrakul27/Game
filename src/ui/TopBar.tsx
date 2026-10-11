import { alignmentView, MAX_TURNS, quarterLabel } from '../engine/index.ts'
import { pointsLeft, useGameStore } from '../store/gameStore.ts'
import { money, signed } from './format.ts'
import { useRollingNumber } from './motion.ts'
import { useUiStore } from './uiState.ts'

/** The slim bar of key readouts. Tapping it opens Kessara's full stats. */
export function TopBar({ wide }: { wide: boolean }) {
  const game = useGameStore((store) => store.game)
  const planned = useGameStore((store) => store.planned)
  const setStatsOpen = useUiStore((store) => store.setStatsOpen)
  const setMenuOpen = useUiStore((store) => store.setMenuOpen)
  const openBriefing = useUiStore((store) => store.openBriefing)
  const { stats } = game.countries[game.playerId]
  const left = pointsLeft({ game, planned })
  const alignment = useRollingNumber(stats.alignment)
  const standing = alignmentView(game, stats.alignment)

  const menuButton = (
    <button
      type="button"
      className={wide ? 'ghost' : 'menu-button'}
      onClick={() => setMenuOpen(true)}
      aria-haspopup="dialog"
      aria-label={wide ? undefined : 'Menu'}
      data-tour="menu"
    >
      {wide ? (
        'Menu'
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16 M4 12h16 M4 17h16" />
        </svg>
      )}
    </button>
  )

  return (
    <header className="topbar">
      {wide ? (
        <div className="topbar-title">
          <span className="brand">Faultlines</span>
          <span className="turn">
            {quarterLabel(game.turn)}, turn {game.turn} of {MAX_TURNS}
          </span>
        </div>
      ) : (
        menuButton
      )}
      <button
        type="button"
        className="readouts"
        onClick={() => setStatsOpen(true)}
        aria-haspopup="dialog"
        data-tour="readouts"
        aria-label={
          `Treasury ${money(stats.treasury)}, ${left} of ${game.actionPoints} action points left, ` +
          `legitimacy ${stats.legitimacy}, military loyalty ${stats.militaryLoyalty}, ` +
          `alignment ${signed(stats.alignment)}: ${standing.phrase}. Open full stats.`
        }
      >
        <Treasury value={stats.treasury} />
        <span className="readout" aria-hidden="true">
          <span className="readout-value pips">
            {Array.from({ length: game.actionPoints }, (_, index) => (
              <span key={index} className={index < left ? 'pip' : 'pip spent'} />
            ))}
          </span>
          <span className="readout-label">Points</span>
        </span>
        <Gauge label="Legitimacy" value={stats.legitimacy} />
        <Gauge label="Loyalty" value={stats.militaryLoyalty} />
        <span className={`readout alignment-readout ${flash(alignment.moved)}`} aria-hidden="true" data-tour="alignment-readout">
          <span className={`readout-value standing-word ${standing.powerId ?? 'balanced'}`}>{standing.word}</span>
          <span className="mini-scale">
            <span className="mini-marker" style={{ left: `${(alignment.shown + 100) / 2}%` }} />
          </span>
          <span className="readout-label">Alignment</span>
        </span>
      </button>
      {wide && game.status === 'playing' && (
        <button type="button" className="ghost" onClick={openBriefing}>
          Briefing
        </button>
      )}
      {wide && menuButton}
    </header>
  )
}

const flash = (moved: 'up' | 'down' | null) => (moved ? `moved-${moved}` : '')

/** The treasury, rolling to each new value and flashing as it rises or falls. */
function Treasury({ value }: { value: number }) {
  const { shown, moved } = useRollingNumber(value)
  return (
    <span className={`readout ${value < 0 ? 'bad' : ''} ${flash(moved)}`} aria-hidden="true">
      <span className="readout-value">{money(Math.round(shown))}</span>
      <span className="readout-label">Treasury</span>
    </span>
  )
}

/** A stat from 0 to 100 as a short bar, which slides to each new value and flashes as it rises or falls. */
function Gauge({ label, value }: { label: string; value: number }) {
  const { moved } = useRollingNumber(value)
  return (
    <span className={`readout ${flash(moved)}`} aria-hidden="true">
      <span className="readout-value gauge">
        <span className="gauge-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="readout-label">{label}</span>
    </span>
  )
}
