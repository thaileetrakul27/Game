import { getAction, MAX_TURNS } from '../engine/index.ts'
import type { PlayerAction } from '../engine/index.ts'
import { pointsLeft, unanswered, useGameStore } from '../store/gameStore.ts'
import { useUiStore } from './uiState.ts'

/** The orders planned this turn and the End turn button, at the bottom of the map. */
export function Tray({ wide }: { wide: boolean }) {
  const game = useGameStore((store) => store.game)
  const planned = useGameStore((store) => store.planned)
  const crisisResponse = useGameStore((store) => store.crisisResponse)
  const demandResponse = useGameStore((store) => store.demandResponse)
  const offerResponse = useGameStore((store) => store.offerResponse)
  const unplanAction = useGameStore((store) => store.unplanAction)
  const endTurn = useGameStore((store) => store.endTurn)
  const selectCountry = useGameStore((store) => store.selectCountry)
  const openBriefing = useUiStore((store) => store.openBriefing)
  const left = pointsLeft({ game, planned })
  const missing = unanswered({ game, crisisResponse, demandResponse, offerResponse })

  function describe(action: PlayerAction): string {
    const def = getAction(action.actionId)
    const option = def.options?.find((candidate) => candidate.id === action.option)
    const about = [option?.name, action.targetId ? game.countries[action.targetId].name : null].filter(Boolean)
    return about.length > 0 ? `${def.name}: ${about.join(', ')}` : def.name
  }

  function finishTurn() {
    selectCountry(null)
    endTurn()
  }

  return (
    <section className="tray" aria-label="Orders this turn">
      <div className="tray-status">
        <span>
          <strong>{left}</strong> {left === 1 ? 'point' : 'points'} left
        </span>
        {!wide && (
          <span className="tray-turn">
            Turn {game.turn} of {MAX_TURNS}
          </span>
        )}
      </div>

      {planned.length === 0 ? (
        <p className="tray-empty">No orders yet. Tap a country on the chart.</p>
      ) : (
        <ol className="tray-orders">
          {planned.map((action, index) => (
            <li key={index}>
              <span>{describe(action)}</span>
              <button
                type="button"
                className="remove"
                onClick={() => unplanAction(index)}
                aria-label={`Remove ${describe(action)}`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      {missing.length > 0 ? (
        <button type="button" className="primary" onClick={openBriefing}>
          Answer {missing.join(' and ')}
        </button>
      ) : (
        <button type="button" className="primary" onClick={finishTurn}>
          End turn
        </button>
      )}
    </section>
  )
}
