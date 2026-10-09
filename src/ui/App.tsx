import { MAX_TURNS, quarterLabel } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'
import { ActionMenu } from './ActionMenu.tsx'
import { GameOver } from './GameOver.tsx'
import { StatsPanel } from './StatsPanel.tsx'
import { TurnLog } from './TurnLog.tsx'

export default function App() {
  const game = useGameStore((store) => store.game)
  const newGame = useGameStore((store) => store.newGame)

  function startOver() {
    const inProgress = game.status === 'playing' && game.turn > 1
    if (inProgress && !window.confirm('Abandon this game and start a new one?')) return
    newGame()
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Faultlines</h1>
        <p className="turn">
          {quarterLabel(game.turn)} · Turn {game.turn} of {MAX_TURNS}
        </p>
        <p className="muted seed">Seed {game.seed}</p>
        <button type="button" onClick={startOver}>
          New game
        </button>
      </header>

      {game.status === 'ended' && <GameOver />}

      <main className={game.status === 'ended' ? 'layout ended' : 'layout'}>
        <StatsPanel />
        {game.status === 'playing' && <ActionMenu />}
        <TurnLog />
      </main>
    </div>
  )
}
