import { useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { accessOf, GAME_DATA } from '../../engine/index.ts'
import type { Country, CountryId } from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'
import { capitalised, signed } from '../format.ts'
import { COUNTRY_SHAPES, MAP_HEIGHT, MAP_WIDTH, SEA_LABEL, STRAIT_SHAPES } from './geometry.ts'

/**
 * Land colour for an alignment: the chart's neutral land colour at 0, mixed
 * toward Halvard blue or Tsengai orange in proportion to how far it leans.
 */
function alignmentFill(alignment: number): string {
  const pole = alignment >= 0 ? 'var(--halvard)' : 'var(--tsengai)'
  return `color-mix(in oklab, ${pole} ${Math.round(Math.abs(alignment) * 0.85)}%, var(--land))`
}

/** Where the compass rose sits, in open water south of Kessara. */
const COMPASS = { x: 350, y: 300, r: 30 }

/** Depth soundings scattered over open water, as a chart prints them. */
const SOUNDINGS: [number, number, string][] = [
  [318, 262, '9'],
  [430, 252, '14'],
  [530, 226, '6'],
  [556, 292, '21'],
  [600, 360, '27'],
  [520, 352, '18'],
  [410, 352, '23'],
  [300, 330, '11'],
  [372, 386, '19'],
  [560, 474, '32'],
  [650, 486, '40'],
  [470, 492, '35'],
  [360, 478, '28'],
  [270, 452, '16'],
]

/** Sixteen bearings from the compass rose, drawn under the land like the rhumb lines on an old chart. */
const RHUMBS = Array.from({ length: 16 }, (_, index) => {
  const angle = (index * Math.PI) / 8
  return { x: COMPASS.x + Math.cos(angle) * 900, y: COMPASS.y + Math.sin(angle) * 900 }
})

export function Chart() {
  const game = useGameStore((store) => store.game)
  const planned = useGameStore((store) => store.planned)
  const selectedId = useGameStore((store) => store.selectedCountryId)
  const selectCountry = useGameStore((store) => store.selectCountry)
  const countries = Object.values(game.countries).filter((country) => COUNTRY_SHAPES[country.id])
  const player = game.countries[game.playerId]
  const frame = useRef<HTMLDivElement>(null)

  // On a narrow screen the chart is wider than the frame: start with Kessara in the middle.
  useLayoutEffect(() => {
    const element = frame.current
    if (element) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2
  }, [])

  // Orders planned against each country. Orders with no target are for home.
  const ordersAt: Record<CountryId, number> = {}
  for (const action of planned) {
    const id = action.targetId ?? game.playerId
    ordersAt[id] = (ordersAt[id] ?? 0) + 1
  }

  function describe(country: Country): string {
    if (country.id === player.id) return `${country.name}, your country. Open the home file.`
    const relations = signed(player.relations[country.id] ?? 0)
    return `${country.name}, alignment ${signed(country.stats.alignment)}, relations with ${player.name} ${relations}. Open its file.`
  }

  function selectWithKeys(event: KeyboardEvent, id: CountryId) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    selectCountry(id)
  }

  return (
    <div className="chart-frame" ref={frame}>
      <svg
        className="chart"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="group"
        aria-label="Chart of the Meridian Sea. Select a country to open its file."
      >
        <defs>
          <pattern id="graticule" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M100,0 H0 V100" className="graticule" />
          </pattern>
        </defs>

        <rect className="sea" width={MAP_WIDTH} height={MAP_HEIGHT} />
        <g aria-hidden="true">
          {RHUMBS.map((end, index) => (
            <line key={index} className="rhumb" x1={COMPASS.x} y1={COMPASS.y} x2={end.x} y2={end.y} />
          ))}
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#graticule)" />
          {SOUNDINGS.map(([x, y, depth]) => (
            <text key={`${x},${y}`} className="sounding" x={x} y={y}>
              {depth}
            </text>
          ))}
          <text className="sea-label" x={SEA_LABEL.x + 40} y={SEA_LABEL.y + 6}>
            Meridian Sea
          </text>
          {/* Shallow water along every coast, drawn as wide strokes under the land. */}
          {countries.map((country) => (
            <path key={`deep-${country.id}`} className="shallows outer" d={COUNTRY_SHAPES[country.id].path} />
          ))}
          {countries.map((country) => (
            <path key={`shallow-${country.id}`} className="shallows inner" d={COUNTRY_SHAPES[country.id].path} />
          ))}
        </g>

        {countries.map((country) => (
          <path
            key={country.id}
            d={COUNTRY_SHAPES[country.id].path}
            className={country.id === player.id ? 'land home' : 'land'}
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
          <path className="selection" d={COUNTRY_SHAPES[selectedId].path} aria-hidden="true" />
        )}

        {GAME_DATA.straits.map((strait) => {
          const shape = STRAIT_SHAPES[strait.id]
          if (!shape) return null
          const settings = Object.keys(strait.traffic).map((powerId) => accessOf(game, strait.id, powerId))
          const state = settings.includes('closed') ? 'closed' : settings.includes('taxed') ? 'taxed' : 'open'
          const access = Object.keys(strait.traffic)
            .map((powerId) => `${capitalised(accessOf(game, strait.id, powerId))} to ${game.countries[powerId].name}`)
            .join(', ')
          return (
            <g key={strait.id} className={`strait ${state}`}>
              <title>{`${strait.name}: ${strait.tradeShare}% of regional trade. ${access}.`}</title>
              <line x1={shape.from.x} y1={shape.from.y} x2={shape.to.x} y2={shape.to.y} />
              <text className="strait-name" x={shape.label.x} y={shape.label.y}>
                {strait.name}
              </text>
              <text className="strait-share" x={shape.label.x} y={shape.label.y + 13}>
                {strait.tradeShare}% of trade{state === 'open' ? '' : `, ${state}`}
              </text>
            </g>
          )
        })}

        <g className="compass" aria-hidden="true" transform={`translate(${COMPASS.x} ${COMPASS.y})`}>
          <circle r={COMPASS.r} />
          <circle r={COMPASS.r - 6} />
          <path d={`M0,${-COMPASS.r - 8} L5,0 L0,${COMPASS.r - 4} L-5,0 Z`} className="needle" />
          <path d={`M${-COMPASS.r + 4},0 L0,4 L${COMPASS.r - 4},0 L0,-4 Z`} className="needle minor" />
          <text y={-COMPASS.r - 11}>N</text>
        </g>

        {countries.map((country) => {
          const { label } = COUNTRY_SHAPES[country.id]
          const orders = ordersAt[country.id] ?? 0
          return (
            <g key={country.id} aria-hidden="true">
              {/* A wider target than the coastline alone, so the small islands are easy to tap. */}
              <circle className="hit" cx={label.x} cy={label.y - 4} r={26} onClick={() => selectCountry(country.id)} />
              <text className={country.id === player.id ? 'land-label home' : 'land-label'} x={label.x} y={label.y}>
                {country.name}
              </text>
              {orders > 0 && (
                <g className="order-pin" transform={`translate(${label.x} ${label.y - 24})`}>
                  <circle r={10} />
                  <text y={4}>{orders}</text>
                </g>
              )}
            </g>
          )
        })}

        <ChartTitle />
      </svg>
    </div>
  )
}

/**
 * The chart's title block, set on land in the top corner as charts do, with
 * the key to its colours.
 */
function ChartTitle() {
  return (
    <g className="cartouche" aria-hidden="true" transform="translate(10 10)">
      <rect width="196" height="72" rx="3" />
      <text className="cartouche-title" x="10" y="20">
        The Meridian Sea
      </text>
      <defs>
        <linearGradient id="lean" x1="0" x2="1">
          <stop offset="0" stopColor="var(--tsengai)" />
          <stop offset="0.5" stopColor="var(--land)" />
          <stop offset="1" stopColor="var(--halvard)" />
        </linearGradient>
      </defs>
      <rect className="cartouche-scale" x="10" y="29" width="176" height="7" fill="url(#lean)" />
      <text className="cartouche-text" x="10" y="48">
        Leans Tsengai
      </text>
      <text className="cartouche-text end" x="186" y="48">
        Leans Halvard
      </text>
      <circle className="cartouche-course" cx="15" cy="60" r="4.5" />
      <text className="cartouche-text" x="25" y="63.5">
        Your orders, and the country selected
      </text>
    </g>
  )
}
