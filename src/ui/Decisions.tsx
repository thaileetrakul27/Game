import { describeCrisis, describeEffects, describeOffer, GAME_DATA, getDemand } from '../engine/index.ts'
import type { DemandResponse, OfferResponse } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'

/** A pending demand, offer and crisis card, each answered before the turn can end. */
export function Decisions() {
  const game = useGameStore((store) => store.game)
  if (!game.demand && !game.offer && !game.crisis) return null
  return (
    <div className="decisions">
      {game.demand && <DemandChoice />}
      {game.offer && <OfferChoice />}
      {game.crisis && <CrisisChoice />}
    </div>
  )
}

function OfferChoice() {
  const game = useGameStore((store) => store.game)
  const offerResponse = useGameStore((store) => store.offerResponse)
  const chooseOfferResponse = useGameStore((store) => store.chooseOfferResponse)
  const offer = describeOffer(game)
  if (!offer) return null
  const options: { id: OfferResponse; name: string; effects: string[] }[] = [
    { id: 'accept', name: 'Accept', effects: offer.accept },
    { id: 'decline', name: 'Decline', effects: offer.decline },
  ]

  return (
    <fieldset className="decision offer">
      <legend>
        {offer.fromName} offers: {offer.name}
      </legend>
      <p>{offer.description}</p>
      {options.map((option) => (
        <label key={option.id} className="choice">
          <input
            type="radio"
            name="offer-response"
            value={option.id}
            checked={offerResponse === option.id}
            onChange={() => chooseOfferResponse(option.id)}
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
  const card = describeCrisis(game)
  if (!card) return null

  return (
    <fieldset className="decision crisis">
      <legend>Crisis: {card.name}</legend>
      <p>{card.description}</p>
      {card.responses.map((response) => (
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
            {response.effects.length > 0 && <span className="muted"> · {response.effects.join(' · ')}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
