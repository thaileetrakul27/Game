import { STAT_NAMES } from '../engine/index.ts'
import type { StatKey } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'
import { AlignmentScale } from './AlignmentScale.tsx'
import { Dialog } from './Dialog.tsx'
import { money, percent, signed } from './format.ts'

const GAUGES: StatKey[] = ['legitimacy', 'militaryLoyalty', 'defence']

/** Kessara's full stats, opened from the top bar, with the game's seed and New game. */
export function StatsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="stats-title" className="sheet-dialog">
      <StatsBody onClose={onClose} />
    </Dialog>
  )
}

function StatsBody({ onClose }: { onClose: () => void }) {
  const game = useGameStore((store) => store.game)
  const newGame = useGameStore((store) => store.newGame)
  const player = game.countries[game.playerId]
  const { stats } = player
  const others = Object.values(game.countries).filter((country) => country.id !== player.id)

  function startOver() {
    const inProgress = game.status === 'playing' && game.turn > 1
    if (inProgress && !window.confirm('Abandon this game and start a new one?')) return
    newGame()
    onClose()
  }

  return (
    <div className="stats-sheet">
      <header className="file-head">
        <div>
          <p className="file-kind">Your country</p>
          <h2 id="stats-title" tabIndex={-1} data-autofocus>
            {player.name}: full stats
          </h2>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Close full stats">
          ×
        </button>
      </header>

      <dl className="facts">
        <div>
          <dt>{STAT_NAMES.treasury}</dt>
          <dd className={stats.treasury < 0 ? 'bad' : undefined}>{money(stats.treasury)}</dd>
        </div>
        <div>
          <dt>{STAT_NAMES.debt}</dt>
          <dd>{money(stats.debt)}</dd>
        </div>
        <div>
          <dt>{STAT_NAMES.growth}</dt>
          <dd>{percent(stats.growth)}</dd>
        </div>
      </dl>

      <ul className="plain meters">
        {GAUGES.map((stat) => (
          <li key={stat}>
            <div className="meter">
              <div className="meter-head">
                <span>{STAT_NAMES[stat]}</span>
                <strong>{stats[stat]}</strong>
              </div>
              <div
                className="bar"
                role="meter"
                aria-label={STAT_NAMES[stat]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={stats[stat]}
              >
                <span className="bar-fill" style={{ width: `${stats[stat]}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AlignmentScale alignment={stats.alignment} label="Alignment" />

      <h3>Relations</h3>
      <table className="figures">
        <thead>
          <tr>
            <th scope="col">Country</th>
            <th scope="col">Relations</th>
            <th scope="col">Alignment</th>
          </tr>
        </thead>
        <tbody>
          {others.map((country) => {
            const relations = player.relations[country.id] ?? 0
            return (
              <tr key={country.id} title={country.description}>
                <th scope="row">{country.name}</th>
                <td className={relations < 0 ? 'bad' : undefined}>{signed(relations)}</td>
                <td>{signed(country.stats.alignment)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3>This game</h3>
      <p className="muted">Seed {game.seed}. The same seed always plays out the same way.</p>
      <button type="button" className="ghost-dark" onClick={startOver}>
        Start a new game
      </button>
    </div>
  )
}
