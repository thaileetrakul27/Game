import { describeEffects, GAME_DATA, getDemand, getEvent } from '../engine/index.ts'
import type { DemandResponse } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'

/** A pending demand and crisis card, each answered before the turn can end. */
export function Decisions() {
  const game = useGameStore((store) => store.game)
  if (!game.demand && !game.crisis) return null
  return (
    <div className="decisions">
      {game.demand && <DemandChoice />}
      {game.crisis && <CrisisChoice />}
    </div>
  )
}

function DemandChoice() {
  const game = useGameStore((store) => store.game)
  const demandResponse = useGameStore((store) => store.demandResponse)
  const chooseDemandResponse = useGameStore((store) => store.chooseDemandResponse)
  if (!game.demand) return null

  const demand = getDemand(game.demand.demandId)
  const patron = game.countries[game.demand.fromId]
  const options: { id: DemandResponse; name: string; effects: string[] }[] = [
    { id: 'accept', name: 'Accept', effects: describeEffects(game, game.playerId, patron.id, demand.accept) },
    {
      id: 'refuse',
      name: 'Refuse',
      effects: describeEffects(game, game.playerId, patron.id, GAME_DATA.hedging.demandRefusal),
    },
  ]

  return (
    <fieldset className="decision demand">
      <legend>
        {patron.name} demands: {demand.name}
      </legend>
      <p>{demand.description}</p>
      {options.map((option) => (
        <label key={option.id} className="choice">
          <input
            type="radio"
            name="demand-response"
            value={option.id}
            checked={demandResponse === option.id}
            onChange={() => chooseDemandResponse(option.id)}
          />
          <span>
            <strong>{option.name}</strong>
            <span className="muted"> · {option.effects.join(' · ')}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function CrisisChoice() {
  const game = useGameStore((store) => store.game)
  const crisisResponse = useGameStore((store) => store.crisisResponse)
  const chooseCrisisResponse = useGameStore((store) => store.chooseCrisisResponse)
  if (!game.crisis) return null

  const card = getEvent(game.crisis.cardId)
  const responses = card.responses.filter((response) => game.crisis?.responseIds.includes(response.id))

  return (
    <fieldset className="decision crisis">
      <legend>Crisis: {card.name}</legend>
      <p>{card.description}</p>
      {responses.map((response) => (
        <label key={response.id} className="choice">
          <input
            type="radio"
            name="crisis-response"
            value={response.id}
            checked={crisisResponse === response.id}
            onChange={() => chooseCrisisResponse(response.id)}
          />
          <span>
            <strong>{response.name}</strong>
            <span className="muted">
              {' · '}
              {describeEffects(game, game.playerId, null, response.effects).join(' · ')}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
