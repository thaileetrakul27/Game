import { STAT_NAMES } from '../../engine/index.ts'
import type { StatKey } from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'
import { money, percent, signed } from '../format.ts'

const STAT_ORDER: StatKey[] = ['treasury', 'debt', 'growth', 'legitimacy', 'militaryLoyalty', 'defence', 'alignment']

function formatStat(stat: StatKey, value: number): string {
  if (stat === 'growth') return percent(value)
  if (stat === 'alignment') return signed(value)
  if (stat === 'treasury' || stat === 'debt') return money(value)
  return String(value)
}

/** Stats and relations of the country selected on the map. Hidden until one is selected. */
export function CountryDetails() {
  const game = useGameStore((store) => store.game)
  const countryId = useGameStore((store) => store.selectedCountryId)
  const selectCountry = useGameStore((store) => store.selectCountry)
  if (countryId === null) return null
  const country = game.countries[countryId]
  const others = Object.values(game.countries).filter((other) => other.id !== countryId)
  const kind =
    countryId === game.playerId ? 'Your country' : country.kind === 'greatPower' ? 'Great power' : 'Neighbour'
  const personality = country.personality
    ? ` Personality: ${country.personality.charAt(0).toUpperCase()}${country.personality.slice(1)}.`
    : ''

  return (
    <section className="panel country-details" aria-labelledby="details-heading" aria-live="polite">
      <div className="panel-head">
        <h2 id="details-heading">
          {country.name} <span className="tag">{kind}</span>
        </h2>
        <button type="button" className="link" onClick={() => selectCountry(null)}>
          Close
        </button>
      </div>
      <p className="muted">
        {country.description}
        {personality}
      </p>

      <div className="details-grid">
        <dl className="stats">
          {STAT_ORDER.map((stat) => (
            <div key={stat} className="stat-row">
              <dt>{STAT_NAMES[stat]}</dt>
              <dd>{formatStat(stat, country.stats[stat])}</dd>
            </div>
          ))}
        </dl>

        <table className="figures">
          <thead>
            <tr>
              <th scope="col">Relations with</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {others.map((other) => {
              const relations = country.relations[other.id] ?? 0
              return (
                <tr key={other.id}>
                  <th scope="row">{other.name}</th>
                  <td className={relations < 0 ? 'bad' : undefined}>{signed(relations)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
