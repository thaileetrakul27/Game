import { MAX_TURNS, quarterLabel } from '../engine/index.ts'
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
          `legitimacy ${stats.legitimacy}, military loyalty ${stats.militaryLoyalty}, alignment ${signed(stats.alignment)}. ` +
          'Open full stats.'
        }
      >
        <Readout label="Treasury" value={stats.treasury} format={money} warn={(value) => value < 0} />
        <Readout
          label="Points"
          value={left}
          format={(value) => `${value}/${game.actionPoints}`}
          className="points-readout"
        />
        <Readout label="Legitimacy" value={stats.legitimacy} />
        <Readout label="Loyalty" value={stats.militaryLoyalty} />
        <span className={`readout alignment-readout ${flash(alignment.moved)}`} aria-hidden="true" data-tour="alignment-readout">
          <span className="readout-value">{signed(Math.round(alignment.shown))}</span>
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

/** One readout, rolling to each new value and flashing as it rises or falls. */
function Readout({
  label,
  value,
  format = (number) => String(number),
  warn = () => false,
  className = '',
}: {
  label: string
  value: number
  format?: (value: number) => string
  warn?: (value: number) => boolean
  className?: string
}) {
  const { shown, moved } = useRollingNumber(value)
  return (
    <span className={`readout ${className} ${warn(value) ? 'bad' : ''} ${flash(moved)}`} aria-hidden="true">
      <span className="readout-value">{format(Math.round(shown))}</span>
      <span className="readout-label">{label}</span>
    </span>
  )
}
