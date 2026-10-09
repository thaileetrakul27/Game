import type { KeyboardEvent } from 'react'
import { GAME_DATA } from '../../engine/index.ts'
import type { Country, CountryId } from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'
import { signed } from '../format.ts'
import { COUNTRY_SHAPES, MAP_HEIGHT, MAP_WIDTH, SEA_LABEL, STRAIT_SHAPES } from './geometry.ts'

/**
 * Fill colour for an alignment: the neutral grey at 0, mixed toward Halvard
 * blue or Tsengai red in proportion to how far the country leans.
 */
function alignmentFill(alignment: number): string {
  const pole = alignment >= 0 ? 'var(--align-halvard)' : 'var(--align-tsengai)'
  return `color-mix(in oklab, ${pole} ${Math.abs(alignment)}%, var(--align-neutral))`
}

export function MapPanel() {
  const game = useGameStore((store) => store.game)
  const selectedId = useGameStore((store) => store.selectedCountryId)
  const selectCountry = useGameStore((store) => store.selectCountry)
  const countries = Object.values(game.countries).filter((country) => COUNTRY_SHAPES[country.id])
  const player = game.countries[game.playerId]

  function describe(country: Country): string {
    const relations =
      country.id === player.id ? '' : `, relations with ${player.name} ${signed(player.relations[country.id] ?? 0)}`
    return `${country.name}, alignment ${signed(country.stats.alignment)}${relations}`
  }

  function selectWithKeys(event: KeyboardEvent, id: CountryId) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    selectCountry(id)
  }

  return (
    <section className="panel map-panel" aria-labelledby="map-heading">
      <h2 id="map-heading">The Meridian Sea</h2>

      <svg
        className="map"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="group"
        aria-label="Map of the Meridian Sea. Select a country to see its stats and relations."
      >
        <defs>
          <pattern id="sea-waves" width="28" height="14" patternUnits="userSpaceOnUse">
            <path className="waves" d="M2,8 q6,-5 12,0 t12,0" />
          </pattern>
        </defs>
        <rect className="sea" width={MAP_WIDTH} height={MAP_HEIGHT} />
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#sea-waves)" />
        <text className="sea-label" x={SEA_LABEL.x} y={SEA_LABEL.y}>
          Meridian Sea
        </text>

        {countries.map((country) => (
          <path
            key={country.id}
            d={COUNTRY_SHAPES[country.id].path}
            className="country"
            style={{ fill: alignmentFill(country.stats.alignment) }}
            role="button"
            tabIndex={0}
            aria-label={describe(country)}
            aria-pressed={country.id === selectedId}
            onClick={() => selectCountry(country.id)}
            onKeyDown={(event) => selectWithKeys(event, country.id)}
          >
            <title>{describe(country)}</title>
          </path>
        ))}

        {selectedId && COUNTRY_SHAPES[selectedId] && (
          <path className="selection" d={COUNTRY_SHAPES[selectedId].path} />
        )}

        {GAME_DATA.straits.map((strait) => {
          const shape = STRAIT_SHAPES[strait.id]
          if (!shape) return null
          return (
            <g key={strait.id} className="strait">
              <title>{`${strait.name}: ${strait.tradeShare}% of regional trade. ${strait.description}`}</title>
              <line x1={shape.from.x} y1={shape.from.y} x2={shape.to.x} y2={shape.to.y} />
              <text className="strait-name" x={shape.label.x} y={shape.label.y}>
                {strait.name}
              </text>
              <text className="strait-share" x={shape.label.x} y={shape.label.y + 15}>
                {strait.tradeShare}%<tspan className="strait-share-detail"> of trade</tspan>
              </text>
            </g>
          )
        })}

        {countries.map((country) => {
          const { label } = COUNTRY_SHAPES[country.id]
          return (
            <text
              key={country.id}
              className={country.id === player.id ? 'country-label player' : 'country-label'}
              x={label.x}
              y={label.y}
            >
              {country.name}
            </text>
          )
        })}
      </svg>

      <div className="map-legend">
        <div className="legend-scale" aria-hidden="true" />
        <div className="legend-ends">
          <span>Tsengai −100</span>
          <span>0</span>
          <span>+100 Halvard</span>
        </div>
        <p className="muted">
          Countries are coloured by alignment. Select one to see its stats and relations. Straits, by share of
          regional trade: {GAME_DATA.straits.map((strait) => `${strait.name} ${strait.tradeShare}%`).join(' · ')}.
        </p>
      </div>
    </section>
  )
}
