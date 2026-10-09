import { useState } from 'react'
import { checkPlannedAction, describeAction, GAME_DATA, getAction, targetsFor } from '../engine/index.ts'
import type { ActionDef, PlayerAction } from '../engine/index.ts'
import { pointsLeft, useGameStore } from '../store/gameStore.ts'

export function ActionMenu() {
  const game = useGameStore((store) => store.game)
  const planned = useGameStore((store) => store.planned)
  const crisisResponse = useGameStore((store) => store.crisisResponse)
  const unplanAction = useGameStore((store) => store.unplanAction)
  const endTurn = useGameStore((store) => store.endTurn)
  const left = pointsLeft({ game, planned })

  return (
    <section className="panel actions-panel" aria-labelledby="actions-heading">
      <h2 id="actions-heading">Actions</h2>

      {game.crisis && <CrisisChoice />}

      <p className="points" aria-live="polite">
        <strong>{left}</strong> of {game.actionPoints} action points left
      </p>

      <ul className="actions">
        {GAME_DATA.actions.map((def) => (
          <ActionRow key={def.id} def={def} showProblem={left > 0} />
        ))}
      </ul>

      <div className="plan">
        <h3>This turn's plan</h3>
        {planned.length === 0 ? (
          <p className="muted">No actions planned yet.</p>
        ) : (
          <ol>
            {planned.map((action, index) => (
              <li key={index}>
                <span>{describe(action)}</span>
                <button type="button" className="link" onClick={() => unplanAction(index)}>
                  Remove
                </button>
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          className="primary"
          onClick={endTurn}
          disabled={game.crisis !== null && crisisResponse === null}
        >
          End turn
        </button>
      </div>
    </section>
  )

  function describe(action: PlayerAction): string {
    const def = getAction(action.actionId)
    const option = def.options?.find((candidate) => candidate.id === action.option)
    const target = action.targetId ? game.countries[action.targetId].name : null
    const details = [option?.name, target].filter(Boolean).join(', ')
    return `${def.name}${details ? ` (${details})` : ''} · ${def.cost} AP`
  }
}

function ActionRow({ def, showProblem }: { def: ActionDef; showProblem: boolean }) {
  const game = useGameStore((store) => store.game)
  const planned = useGameStore((store) => store.planned)
  const planAction = useGameStore((store) => store.planAction)
  const targets = targetsFor(game, game.playerId, def.id)
  const [targetId, setTargetId] = useState(targets[0])
  const [optionId, setOptionId] = useState(def.options?.[0]?.id)

  const action: PlayerAction = { actionId: def.id }
  if (targets.length > 0) action.targetId = targetId
  if (def.options) action.option = optionId
  const problem = checkPlannedAction(game, planned, action)
  const effects = describeAction(game, game.playerId, action)

  return (
    <li className="action">
      <div className="action-head">
        <strong>{def.name}</strong>
        <span className="cost">{def.cost} AP</span>
      </div>
      <p className="muted">{def.description}</p>
      <ul className="effects" aria-label={`Effects of ${def.name}`}>
        {effects.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="action-controls">
        {targets.length > 0 && (
          <label>
            <span className="visually-hidden">Target for {def.name}</span>
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
              {targets.map((id) => (
                <option key={id} value={id}>
                  {game.countries[id].name}
                </option>
              ))}
            </select>
          </label>
        )}
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
          onClick={() => planAction(action)}
          disabled={problem !== null}
          aria-label={`Add ${def.name}`}
        >
          Add
        </button>
      </div>
      {problem && showProblem && <p className="problem">{problem}</p>}
    </li>
  )
}

function CrisisChoice() {
  const crisis = useGameStore((store) => store.game.crisis)
  const crisisResponse = useGameStore((store) => store.crisisResponse)
  const chooseCrisisResponse = useGameStore((store) => store.chooseCrisisResponse)
  if (!crisis) return null

  return (
    <fieldset className="crisis">
      <legend>Crisis: {crisis.cardId}</legend>
      {crisis.responseIds.map((id) => (
        <label key={id}>
          <input
            type="radio"
            name="crisis-response"
            value={id}
            checked={crisisResponse === id}
            onChange={() => chooseCrisisResponse(id)}
          />
          {id}
        </label>
      ))}
    </fieldset>
  )
}
