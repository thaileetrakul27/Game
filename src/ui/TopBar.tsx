import { MAX_TURNS, quarterLabel } from '../engine/index.ts'
import { pointsLeft, useGameStore } from '../store/gameStore.ts'
import { money, signed } from './format.ts'
import { useUiStore } from './uiState.ts'

/** The slim bar of key readouts. Tapping it opens Kessara's full stats. */
export function TopBar({ wide }: { wide: boolean }) {
  const game = useGameStore((store) => store.game)
  const planned = useGameStore((store) => store.planned)
  const setStatsOpen = useUiStore((store) => store.setStatsOpen)
  const openBriefing = useUiStore((store) => store.openBriefing)
  const { stats } = game.countries[game.playerId]
  const left = pointsLeft({ game, planned })

  return (
    <header className="topbar">
      {wide && (
        <div className="topbar-title">
          <span className="brand">Faultlines</span>
          <span className="turn">
            {quarterLabel(game.turn)}, turn {game.turn} of {MAX_TURNS}
          </span>
        </div>
      )}
      <button
        type="button"
        className="readouts"
        onClick={() => setStatsOpen(true)}
        aria-haspopup="dialog"
        aria-label={
          `Treasury ${money(stats.treasury)}, ${left} of ${game.actionPoints} action points left, ` +
          `legitimacy ${stats.legitimacy}, military loyalty ${stats.militaryLoyalty}, alignment ${signed(stats.alignment)}. ` +
          'Open full stats.'
        }
      >
        <Readout label="Treasury" value={money(stats.treasury)} bad={stats.treasury < 0} />
        <Readout label="Points" value={`${left}/${game.actionPoints}`} />
        <Readout label="Legitimacy" value={String(stats.legitimacy)} />
        <Readout label="Loyalty" value={String(stats.militaryLoyalty)} />
        <span className="readout alignment-readout" aria-hidden="true">
          <span className="readout-value">{signed(stats.alignment)}</span>
          <span className="mini-scale">
            <span className="mini-marker" style={{ left: `${(stats.alignment + 100) / 2}%` }} />
          </span>
          <span className="readout-label">Alignment</span>
        </span>
      </button>
      {wide && game.status === 'playing' && (
        <button type="button" className="ghost" onClick={openBriefing}>
          Briefing
        </button>
      )}
    </header>
  )
}

function Readout({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) {
  return (
    <span className={bad ? 'readout bad' : 'readout'} aria-hidden="true">
      <span className="readout-value">{value}</span>
      <span className="readout-label">{label}</span>
    </span>
  )
}
