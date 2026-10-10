import { describeCrisis, describeEffects, describeOffer, GAME_DATA, getDemand } from '../engine/index.ts'
import type { DemandResponse, OfferResponse } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'

interface Choice<T extends string> {
  id: T
  name: string
  effects: string[]
}

/** A paper dossier with a decision to tick. Urgent ones carry a red stamp. */
function DossierChoice<T extends string>({
  kind,
  title,
  description,
  choices,
  chosen,
  onChoose,
  stamp,
  name,
}: {
  kind: string
  title: string
  description: string
  choices: Choice<T>[]
  chosen: T | null
  onChoose: (id: T) => void
  stamp?: string
  name: string
}) {
  return (
    <fieldset className={`dossier dossier-${kind}`}>
      {stamp && (
        <span className="stamp" aria-hidden="true">
          {stamp}
        </span>
      )}
      <legend>
        <span className="dossier-kind">{kind === 'crisis' ? 'Crisis' : kind === 'demand' ? 'Demand' : 'Offer'}</span>
        <span className="dossier-title">{title}</span>
      </legend>
      {stamp && <p className="visually-hidden">{stamp}.</p>}
      <p className="dossier-text">{description}</p>
      <div className="choices">
        {choices.map((choice) => (
          <label key={choice.id} className={choice.id === chosen ? 'choice chosen' : 'choice'}>
            <input
              type="radio"
              name={name}
              value={choice.id}
              checked={choice.id === chosen}
              onChange={() => onChoose(choice.id)}
            />
            <span className="choice-body">
              <span className="choice-name">{choice.name}</span>
              {choice.effects.length > 0 && (
                <span className="choice-effects">
                  {choice.effects.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function DemandDossier() {
  const game = useGameStore((store) => store.game)
  const demandResponse = useGameStore((store) => store.demandResponse)
  const chooseDemandResponse = useGameStore((store) => store.chooseDemandResponse)
  if (!game.demand) return null
  const demand = getDemand(game.demand.demandId)
  const patron = game.countries[game.demand.fromId]
  const choices: Choice<DemandResponse>[] = [
    { id: 'accept', name: 'Accept', effects: describeEffects(game, game.playerId, patron.id, demand.accept) },
    {
      id: 'refuse',
      name: 'Refuse',
      effects: describeEffects(game, game.playerId, patron.id, GAME_DATA.hedging.demandRefusal),
    },
  ]
  return (
    <DossierChoice
      kind="demand"
      name="demand-response"
      stamp="Urgent"
      title={`${patron.name} demands: ${demand.name}`}
      description={demand.description}
      choices={choices}
      chosen={demandResponse}
      onChoose={chooseDemandResponse}
    />
  )
}

export function OfferDossier() {
  const game = useGameStore((store) => store.game)
  const offerResponse = useGameStore((store) => store.offerResponse)
  const chooseOfferResponse = useGameStore((store) => store.chooseOfferResponse)
  const offer = describeOffer(game)
  if (!offer) return null
  const choices: Choice<OfferResponse>[] = [
    { id: 'accept', name: 'Accept', effects: offer.accept },
    { id: 'decline', name: 'Decline', effects: offer.decline },
  ]
  return (
    <DossierChoice
      kind="offer"
      name="offer-response"
      title={`${offer.fromName} offers: ${offer.name}`}
      description={offer.description}
      choices={choices}
      chosen={offerResponse}
      onChoose={chooseOfferResponse}
    />
  )
}

export function CrisisDossier() {
  const game = useGameStore((store) => store.game)
  const crisisResponse = useGameStore((store) => store.crisisResponse)
  const chooseCrisisResponse = useGameStore((store) => store.chooseCrisisResponse)
  const card = describeCrisis(game)
  if (!card) return null
  return (
    <DossierChoice
      kind="crisis"
      name="crisis-response"
      title={card.name}
      description={card.description}
      choices={card.responses}
      chosen={crisisResponse}
      onChoose={chooseCrisisResponse}
    />
  )
}
