import { hedgingStatus } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'
import { signed } from './format.ts'

/**
 * The alignment scale from Tsengai at -100 to Halvard at +100, marked with
 * the lines that matter to Kessara: the broker range, the trade cut and the
 * demand line.
 */
export function AlignmentScale({ alignment, label }: { alignment: number; label: string }) {
  const game = useGameStore((store) => store.game)
  const status = hedgingStatus(game)
  const lines = [status.brokerWithin, status.tradeCutPast, status.demandPast]

  return (
    <div className="alignment">
      <div className="alignment-head">
        <span>{label}</span>
        <strong>{signed(alignment)}</strong>
      </div>
      <div
        className="alignment-track"
        role="meter"
        aria-label={`${label}, from Tsengai at −100 to Halvard at +100`}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={alignment}
      >
        {lines
          .flatMap((line) => [-line, line])
          .map((value) => (
            <span key={value} className="alignment-tick" style={{ left: `${(value + 100) / 2}%` }} />
          ))}
        <span className="alignment-marker" style={{ left: `${(alignment + 100) / 2}%` }} />
      </div>
      <div className="alignment-ends" aria-hidden="true">
        <span>Tsengai</span>
        <span>Halvard</span>
      </div>
    </div>
  )
}
