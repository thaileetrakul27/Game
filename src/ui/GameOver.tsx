import { MAX_TURNS, quarterLabel } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'
import { Dialog } from './Dialog.tsx'
import { money, percent, signed } from './format.ts'

/** The final report when the game ends. */
export function GameOver({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="final-title" className="briefing-dialog">
      <FinalReport onClose={onClose} />
    </Dialog>
  )
}

function FinalReport({ onClose }: { onClose: () => void }) {
  const game = useGameStore((store) => store.game)
  const newGame = useGameStore((store) => store.newGame)
  const player = game.countries[game.playerId]
  const { stats } = player
  const verdict =
    game.endReason === 'default'
      ? `${player.name} defaulted on its debts in ${quarterLabel(game.turn)}.`
      : game.endReason === 'vassal'
        ? `${player.name} became a vassal in ${quarterLabel(game.turn)}.`
        : `${player.name} made it through all ${MAX_TURNS} turns.`
  const stamp = game.endReason === 'turnLimit' ? 'Survived' : 'Fallen'

  return (
    <article className="paper briefing final">
      <p className="classification">Cabinet eyes only</p>
      <span className={game.endReason === 'turnLimit' ? 'stamp approved' : 'stamp'} aria-hidden="true">
        {stamp}
      </span>
      <header className="briefing-head">
        <h1 id="final-title" tabIndex={-1} data-autofocus>
          Final report
        </h1>
        <p className="briefing-date">{quarterLabel(game.turn)}</p>
      </header>
      <section className="briefing-section">
        <p className="verdict">{verdict}</p>
        <dl className="facts">
          <div>
            <dt>Treasury</dt>
            <dd>{money(stats.treasury)}</dd>
          </div>
          <div>
            <dt>Debt</dt>
            <dd>{money(stats.debt)}</dd>
          </div>
          <div>
            <dt>Growth</dt>
            <dd>{percent(stats.growth)}</dd>
          </div>
          <div>
            <dt>Legitimacy</dt>
            <dd>{stats.legitimacy}</dd>
          </div>
          <div>
            <dt>Alignment</dt>
            <dd>{signed(stats.alignment)}</dd>
          </div>
        </dl>
      </section>
      <footer className="briefing-foot">
        <button type="button" className="ghost-dark" onClick={onClose}>
          Look at the map
        </button>
        <button type="button" className="primary" onClick={() => newGame()}>
          Start a new game
        </button>
      </footer>
    </article>
  )
}
