import { MAX_TURNS, quarterLabel } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'
import { money, percent, signed } from './format.ts'

export function GameOver() {
  const game = useGameStore((store) => store.game)
  const newGame = useGameStore((store) => store.newGame)
  const player = game.countries[game.playerId]

  const summary =
    game.endReason === 'default'
      ? `${player.name} defaulted on its debts in ${quarterLabel(game.turn)}.`
      : `${player.name} made it through all ${MAX_TURNS} turns.`

  return (
    <section className="game-over" role="status" aria-labelledby="game-over-heading">
      <h2 id="game-over-heading">Game over</h2>
      <p>{summary}</p>
      <p className="muted">
        Treasury {money(player.stats.treasury)} · Debt {money(player.stats.debt)} · Growth{' '}
        {percent(player.stats.growth)} · Alignment {signed(player.stats.alignment)}
      </p>
      <button type="button" className="primary" onClick={() => newGame()}>
        New game
      </button>
    </section>
  )
}
