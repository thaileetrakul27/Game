import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import {
  accessOf,
  actionsFor,
  GAME_DATA,
  getProject,
  projectTurnsLeft,
  straitOwnedBy,
  targetsFor,
  tradeDealsOf,
  turnsLeftPhrase,
} from '../../engine/index.ts'
import type { Country, GameState } from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'
import { ActionCard } from '../ActionCard.tsx'
import { AlignmentScale } from '../AlignmentScale.tsx'
import { capitalised, money, percent, signed } from '../format.ts'

/**
 * The file on the country selected on the map: where it stands, and the
 * orders that can be given about it. Kessara's own file is the home file,
 * with the orders that need no target.
 */
export function CountryFile() {
  const game = useGameStore((store) => store.game)
  const selectedId = useGameStore((store) => store.selectedCountryId)
  const selectCountry = useGameStore((store) => store.selectCountry)
  const heading = useRef<HTMLHeadingElement>(null)

  // Move focus to the file so keyboard and screen reader users land in it, without scrolling the page.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [selectedId])

  if (selectedId === null || game.status !== 'playing') return null
  const country = game.countries[selectedId]
  const home = selectedId === game.playerId
  const orders = actionsFor(game, game.playerId).filter((def) =>
    home
      ? def.target === 'none'
      : def.target !== 'none' && targetsFor(game, game.playerId, def.id).includes(selectedId),
  )

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') selectCountry(null)
  }

  return (
    <section className="sheet country-file" role="dialog" aria-labelledby="file-title" onKeyDown={closeOnEscape}>
      <header className="file-head">
        <div>
          <p className="file-kind">{kindOf(game, country)}</p>
          <h2 id="file-title" ref={heading} tabIndex={-1}>
            {home ? `Home: ${country.name}` : country.name}
          </h2>
        </div>
        <button type="button" className="close" onClick={() => selectCountry(null)} aria-label="Close the file">
          ×
        </button>
      </header>

      <div className="file-body">
        {home ? <HomeFacts game={game} /> : <ForeignFacts game={game} country={country} />}

        <h3 className="orders-heading">Orders</h3>
        {orders.length === 0 ? (
          <p className="muted">No orders can be given about {country.name}.</p>
        ) : (
          <ul className="plain orders">
            {orders.map((def) => (
              <ActionCard key={`${selectedId}-${def.id}`} def={def} targetId={home ? null : selectedId} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function kindOf(game: GameState, country: Country): string {
  if (country.id === game.playerId) return 'Your country'
  const kind = country.kind === 'greatPower' ? 'Great power' : 'Neighbour'
  if (!country.personality) return kind
  const usual = GAME_DATA.countries.find((data) => data.id === country.id)?.personality
  const note = usual && usual !== country.personality ? `, this game (usually ${capitalised(usual)})` : ''
  return `${kind}, ${capitalised(country.personality)}${note}`
}

function ForeignFacts({ game, country }: { game: GameState; country: Country }) {
  const player = game.countries[game.playerId]
  const relations = player.relations[country.id] ?? 0
  const deal = tradeDealsOf(game, game.playerId).find((candidate) => candidate.partnerId === country.id)
  const strait = straitOwnedBy(game.playerId)
  const usesStrait = strait && Object.hasOwn(strait.traffic, country.id)
  const owed = player.creditors[country.id] ?? 0

  return (
    <>
      <p className="file-description">{country.description}</p>
      <AlignmentScale alignment={country.stats.alignment} label={`${country.name}'s alignment`} />
      <dl className="facts">
        <div>
          <dt>Relations with {player.name}</dt>
          <dd className={relations < 0 ? 'bad' : undefined}>{signed(relations)}</dd>
        </div>
        <div>
          <dt>Trade deal with {player.name}</dt>
          <dd>{deal ? `In force, ${turnsLeftPhrase(deal.turnsLeft)}` : 'None'}</dd>
        </div>
        {usesStrait && strait && (
          <div>
            <dt>{strait.name}</dt>
            <dd>{capitalised(accessOf(game, strait.id, country.id))} to them</dd>
          </div>
        )}
        {owed > 0 && (
          <div>
            <dt>You owe them</dt>
            <dd>{money(owed)}</dd>
          </div>
        )}
        <div>
          <dt>Treasury</dt>
          <dd>{money(country.stats.treasury)}</dd>
        </div>
        <div>
          <dt>Growth</dt>
          <dd>{percent(country.stats.growth)}</dd>
        </div>
        <div>
          <dt>Legitimacy</dt>
          <dd>{country.stats.legitimacy}</dd>
        </div>
        <div>
          <dt>Defence</dt>
          <dd>{country.stats.defence}</dd>
        </div>
      </dl>
      <details className="relations-detail">
        <summary>{country.name}'s relations with everyone</summary>
        <dl className="facts">
          {Object.values(game.countries)
            .filter((other) => other.id !== country.id)
            .map((other) => {
              const score = country.relations[other.id] ?? 0
              return (
                <div key={other.id}>
                  <dt>{other.name}</dt>
                  <dd className={score < 0 ? 'bad' : undefined}>{signed(score)}</dd>
                </div>
              )
            })}
        </dl>
      </details>
    </>
  )
}

function HomeFacts({ game }: { game: GameState }) {
  const player = game.countries[game.playerId]
  const { stats } = player
  return (
    <>
      <p className="file-description">{player.description}</p>
      <dl className="facts">
        <div>
          <dt>Legitimacy</dt>
          <dd>{stats.legitimacy}</dd>
        </div>
        <div>
          <dt>Military loyalty</dt>
          <dd>{stats.militaryLoyalty}</dd>
        </div>
        <div>
          <dt>Defence</dt>
          <dd>{stats.defence}</dd>
        </div>
        <div>
          <dt>Growth</dt>
          <dd>{percent(stats.growth)}</dd>
        </div>
      </dl>
      {player.projects.length > 0 && (
        <ul className="plain projects">
          {player.projects.map((progress) => {
            const left = projectTurnsLeft(game, progress)
            return (
              <li key={progress.projectId}>
                {getProject(progress.projectId).name}:{' '}
                {left === 0 ? 'built' : `${left} ${left === 1 ? 'turn' : 'turns'} to go`}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
