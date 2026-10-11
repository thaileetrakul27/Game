import { useEffect } from 'react'
import { MAX_TURNS, quarterLabel } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'
import { useUiStore } from './uiState.ts'

/** How long the interlude between quarters lasts, unless the player skips it. */
const INTERLUDE_MS = 1700

/**
 * The short interlude as one quarter closes and the next opens, before its
 * briefing. Any click or key skips it. It never shows under reduced motion.
 */
export function Interlude() {
  const game = useGameStore((store) => store.game)
  const closed = useUiStore((store) => store.interlude)
  const endInterlude = useUiStore((store) => store.endInterlude)

  useEffect(() => {
    if (closed === null) return
    const timer = window.setTimeout(endInterlude, INTERLUDE_MS)
    window.addEventListener('pointerdown', endInterlude)
    window.addEventListener('keydown', endInterlude)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', endInterlude)
      window.removeEventListener('keydown', endInterlude)
    }
  }, [closed, endInterlude])

  if (closed === null) return null
  const ended = game.status === 'ended'

  return (
    <div className="interlude" role="status">
      <div className="interlude-sweep" aria-hidden="true" />
      <div className="interlude-text">
        <p className="interlude-closed">{quarterLabel(closed)} closes</p>
        <p className="interlude-date">{ended ? 'Final report' : quarterLabel(game.turn)}</p>
        <p className="interlude-turn">{ended ? 'The game is over' : `Turn ${game.turn} of ${MAX_TURNS}`}</p>
      </div>
    </div>
  )
}
