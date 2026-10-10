import { useState } from 'react'
import { checkPlannedAction, describeAction } from '../engine/index.ts'
import type { ActionDef, CountryId, PlayerAction } from '../engine/index.ts'
import { pointsLeft, useGameStore } from '../store/gameStore.ts'

/** One order that can be given about a country: its exact effects, any option to pick, and Add. */
export function ActionCard({ def, targetId }: { def: ActionDef; targetId: CountryId | null }) {
  const game = useGameStore((store) => store.game)
  const planned = useGameStore((store) => store.planned)
  const planAction = useGameStore((store) => store.planAction)
  const [optionId, setOptionId] = useState(def.options?.[0]?.id)

  const action: PlayerAction = { actionId: def.id }
  if (targetId) action.targetId = targetId
  if (def.options) action.option = optionId
  const problem = checkPlannedAction(game, planned, action)
  const effects = describeAction(game, game.playerId, action)
  const titleId = `order-${def.id}`
  // While points remain, say why an order can't be added. With none left, the tray already says so.
  const showProblem = problem !== null && pointsLeft({ game, planned }) > 0

  return (
    <li className="order" aria-labelledby={titleId}>
      <div className="order-head">
        <h4 id={titleId}>{def.name}</h4>
        <span className="cost">
          {def.cost} {def.cost === 1 ? 'point' : 'points'}
        </span>
      </div>
      <p className="order-description">{def.description}</p>
      <ul className="effects" aria-label={`What ${def.name} does`}>
        {effects.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="order-controls">
        {def.options && (
          <label>
            <span className="visually-hidden">Option for {def.name}</span>
            <select value={optionId} onChange={(event) => setOptionId(event.target.value)}>
              {def.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="add"
          onClick={() => planAction(action)}
          disabled={problem !== null}
          aria-describedby={showProblem ? `${titleId}-problem` : undefined}
        >
          Add to orders
        </button>
      </div>
      {showProblem && (
        <p className="problem" id={`${titleId}-problem`}>
          {problem}
        </p>
      )}
    </li>
  )
}
