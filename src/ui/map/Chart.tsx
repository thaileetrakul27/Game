import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { accessOf, builtProjects, countryConditions, GAME_DATA } from '../../engine/index.ts'
import type { Country, CountryCondition, CountryId, GameState } from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'
import { capitalised, signed } from '../format.ts'
import { prefersReducedMotion, useReducedMotion } from '../motion.ts'
import { COUNTRY_SHAPES, MAP_HEIGHT, MAP_WIDTH, SEA_LABEL, SETTLEMENTS, STRAIT_SHAPES } from './geometry.ts'
import {
  Anchor,
  Capital,
  CrisisRing,
  Crane,
  Glint,
  Pylon,
  Smoke,
  Swords,
  TerrainGlyph,
  Town,
} from './Glyphs.tsx'
import { OUTLINES, RIVER_PATHS, TERRAIN } from './terrain.ts'

/** Where the compass rose sits, in open water south of Kessara. */
const COMPASS = { x: 350, y: 300, r: 30 }

/** Sixteen bearings from the compass rose, drawn under the land like the rhumb lines on an old chart. */
const RHUMBS = Array.from({ length: 16 }, (_, index) => {
  const angle = (index * Math.PI) / 8
  return { x: COMPASS.x + Math.cos(angle) * 900, y: COMPASS.y + Math.sin(angle) * 900 }
})

/** Lines drawn around every coast, further and further out, as engraved charts show shallow water. */
const WATER_LINES = [24, 16, 9]

const tintOf = (alignment: number) => (alignment >= 0 ? 'var(--halvard)' : 'var(--tsengai)')

/** The land's wash: the chart's buff, washed toward the power a country leans to, the more the further it leans. */
function washOf(alignment: number): string {
  const wash = alignment >= 0 ? 'var(--halvard-wash)' : 'var(--tsengai-wash)'
  return `color-mix(in oklab, ${wash} ${Math.round(Math.abs(alignment) * 0.8)}%, var(--land))`
}

/** The watercolour band along a country's borders: three strokes inside its outline, strongest at the edge. */
const BANDS = [
  { width: 22, strength: 0.2 },
  { width: 13, strength: 0.3 },
  { width: 6, strength: 0.5 },
]

export function Chart() {
  const game = useGameStore((store) => store.game)
  const planned = useGameStore((store) => store.planned)
  const selectedId = useGameStore((store) => store.selectedCountryId)
  const selectCountry = useGameStore((store) => store.selectCountry)
  const reduced = useReducedMotion()
  const countries = mapped(game)
  const player = game.countries[game.playerId]
  const frame = useRef<HTMLDivElement>(null)

  // On a narrow screen the chart is wider than the frame: start with Kessara in the middle.
  useLayoutEffect(() => {
    const element = frame.current
    if (element) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2
  }, [])

  // And when a country is picked there, pan the chart to bring it to the middle.
  useEffect(() => {
    const element = frame.current
    const shape = selectedId ? COUNTRY_SHAPES[selectedId] : undefined
    if (!element || !shape || element.scrollWidth <= element.clientWidth) return
    const scale = element.scrollWidth / MAP_WIDTH
    element.scrollTo({
      left: shape.label.x * scale - element.clientWidth / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [selectedId])

  // Orders planned against each country. Orders with no target are for home.
  const ordersAt: Record<CountryId, number> = {}
  for (const action of planned) {
    const id = action.targetId ?? game.playerId
    ordersAt[id] = (ordersAt[id] ?? 0) + 1
  }

  function describe(country: Country): string {
    const marks = countryConditions(game, country.id).map((condition) => condition.name.toLowerCase())
    const marked = marks.length > 0 ? ` ${capitalised(marks.join(', '))}.` : ''
    if (country.id === player.id) return `${country.name}, your country.${marked} Open the home file.`
    const relations = signed(player.relations[country.id] ?? 0)
    return `${country.name}, alignment ${signed(country.stats.alignment)}, relations with ${player.name} ${relations}.${marked} Open its file.`
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
          {['halvard', 'tsengai'].map((power) => (
            <pattern key={power} id={`hatch-${power}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0,0 V7" className={`hatch hatch-${power}`} />
            </pattern>
          ))}
          {countries.map((country) => (
            <clipPath key={country.id} id={`within-${country.id}`}>
              <path d={OUTLINES[country.id].path} />
            </clipPath>
          ))}
        </defs>

        <Sea />

        {countries.map((country) => (
          <path
            key={country.id}
            d={OUTLINES[country.id].path}
            className={country.id === player.id ? 'land home' : 'land'}
            style={{ fill: washOf(country.stats.alignment) }}
            role="button"
            tabIndex={0}
            aria-label={describe(country)}
            aria-pressed={country.id === selectedId}
            onClick={() => selectCountry(country.id)}
            onKeyDown={(event) => selectWithKeys(event, country.id)}
            data-tour={country.id === player.id ? 'home' : undefined}
          >
            <title>{describe(country)}</title>
          </path>
        ))}

        <LandArt game={game} />

        {/* The coastlines and borders, inked over the paint. */}
        <g className="coasts" aria-hidden="true">
          {countries.map((country) => (
            <path key={country.id} d={OUTLINES[country.id].path} />
          ))}
        </g>

        {selectedId && OUTLINES[selectedId] && (
          <path key={selectedId} className="selection" d={OUTLINES[selectedId].path} aria-hidden="true" />
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
              {/* The chart names a strait, and says so only when it is not open. Its share of trade is in the Economy panel. */}
              {state !== 'open' && (
                <text className={`strait-state ${state}`} x={shape.label.x} y={shape.label.y + 13}>
                  {state}
                </text>
              )}
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

        <Happenings game={game} moving={!reduced} />

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
                  {/* Keyed by the count, so the pin drops in again each time an order is added. A second order adds a count. */}
                  <g key={orders} className="pin-drop">
                    <circle r={orders > 1 ? 9 : 6} />
                    {orders > 1 && <text y={3.6}>{orders}</text>}
                  </g>
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

/** The countries the chart draws. */
const mapped = (game: GameState) => Object.values(game.countries).filter((country) => COUNTRY_SHAPES[country.id])

/** Whether a condition holds for a country now. */
const holds = (game: GameState, id: CountryId) => (condition: CountryCondition['id']) =>
  countryConditions(game, id).some((entry) => entry.id === condition)

/**
 * The sea, its rhumb lines and grid, and the water-lines around every coast,
 * with a shallow tint along the shore. None of it ever changes, so it is drawn once.
 */
const Sea = memo(function Sea() {
  const ids = Object.keys(OUTLINES)
  return (
    <>
      <rect className="sea" width={MAP_WIDTH} height={MAP_HEIGHT} />
      <g aria-hidden="true">
        {RHUMBS.map((end, index) => (
          <line key={index} className="rhumb" x1={COMPASS.x} y1={COMPASS.y} x2={end.x} y2={end.y} />
        ))}
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#graticule)" />
        <text className="sea-label" x={SEA_LABEL.x + 40} y={SEA_LABEL.y + 6}>
          Meridian Sea
        </text>
        {WATER_LINES.map((width) => (
          <g key={width}>
            {ids.map((id) => (
              <path key={id} className="water-line" d={OUTLINES[id].path} strokeWidth={width} />
            ))}
            {ids.map((id) => (
              <path key={id} className="water-gap" d={OUTLINES[id].path} strokeWidth={width - 1.2} />
            ))}
          </g>
        ))}
        {ids.map((id) => (
          <path key={id} className="shallows" d={OUTLINES[id].path} />
        ))}
      </g>
    </>
  )
})

/** The fixed terrain: rivers, mountains, hills, forests, marsh, steppe, and every capital and town. Drawn once. */
const Terrain = memo(function Terrain() {
  return (
    <>
      {RIVER_PATHS.map((path) => (
        <path key={path} className="river" d={path} />
      ))}
      {Object.entries(TERRAIN).flatMap(([id, symbols]) =>
        symbols.map((symbol) => (
          <g key={`${id}-${symbol.x},${symbol.y}`} transform={`translate(${symbol.x} ${symbol.y}) scale(${symbol.scale})`} className="terrain">
            <TerrainGlyph kind={symbol.kind} />
          </g>
        )),
      )}
    </>
  )
})

const Places = memo(function Places() {
  return (
    <>
      {Object.entries(SETTLEMENTS).map(([id, places]) => (
        <g key={id}>
          {places.towns.map((town) => (
            <g key={`${town.x},${town.y}`} transform={`translate(${town.x} ${town.y})`}>
              <Town />
            </g>
          ))}
          <g transform={`translate(${places.capital.x} ${places.capital.y})`}>
            <Capital />
          </g>
        </g>
      ))}
    </>
  )
})

/** What is painted and built on the land. It changes only as the game does, not as the player picks a country. */
const LandArt = memo(function LandArt({ game }: { game: GameState }) {
  const countries = mapped(game)
  return (
    <g className="land-art" aria-hidden="true">
      {countries.map((country) => (
        <CountryArt key={country.id} game={game} country={country} has={holds(game, country.id)} />
      ))}
      <Terrain />
      {countries.map((country) => (
        <Works key={country.id} game={game} country={country} />
      ))}
      <Places />
    </g>
  )
})

/** The marks for what is happening now: trade routes, and the marks over each country. */
const Happenings = memo(function Happenings({ game, moving }: { game: GameState; moving: boolean }) {
  const countries = mapped(game)
  return (
    <g aria-hidden="true">
      {countries
        .filter((country) => holds(game, country.id)('trading'))
        .map((country) => (
          <TradeRoute key={country.id} from={game.playerId} to={country.id} moving={moving} />
        ))}
      {countries.map((country) => (
        <Marks key={country.id} country={country} has={holds(game, country.id)} />
      ))}
    </g>
  )
})

/**
 * What is painted on a country's land: the watercolour band of its alignment,
 * hatching when it is a client, and battlements when it is fortified.
 */
function CountryArt({ game, country, has }: { game: GameState; country: Country; has: (id: CountryCondition['id']) => boolean }) {
  const { alignment } = country.stats
  const outline = OUTLINES[country.id].path
  const strength = Math.abs(alignment) / 100
  const patron = alignment >= 0 ? 'halvard' : 'tsengai'
  return (
    <g clipPath={`url(#within-${country.id})`}>
      {BANDS.map((band) => (
        <path
          key={band.width}
          className="band"
          d={outline}
          strokeWidth={band.width}
          style={{ stroke: tintOf(alignment), strokeOpacity: band.strength * strength }}
        />
      ))}
      {has('client') && <path className="client" d={outline} fill={`url(#hatch-${patron})`} />}
      {has('fortified') && <path className="battlements" d={outline} />}
      {country.id === game.playerId && <path className="home-edge" d={outline} />}
    </g>
  )
}

/** Finished projects, which stay on the map: a port's anchor, a railway, a canal and a line of pylons. */
function Works({ game, country }: { game: GameState; country: Country }) {
  const built = builtProjects(game, country.id)
  if (built.length === 0) return null
  const { capital, port, towns } = SETTLEMENTS[country.id]
  const railTo = towns[0]
  const canalTo = towns[1] ?? towns[0]
  const gridTo = towns[towns.length - 1]
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x},${a.y} L${b.x},${b.y}`
  const pylons = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const steps = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 14))
    return Array.from({ length: steps - 1 }, (_, index) => {
      const t = (index + 1) / steps
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    })
  }
  return (
    <g>
      {built.includes('canal') && (
        <g className="built-canal">
          <path d={line(port, canalTo)} />
          <path className="water" d={line(port, canalTo)} />
        </g>
      )}
      {built.includes('rail') && (
        <g className="built-rail">
          <path d={line(capital, railTo)} />
          <path className="ties" d={line(capital, railTo)} />
        </g>
      )}
      {built.includes('powerGrid') && (
        <g className="built-grid">
          <path d={line(capital, gridTo)} />
          {pylons(capital, gridTo).map((point) => (
            <Pylon key={`${point.x},${point.y}`} x={point.x} y={point.y} />
          ))}
        </g>
      )}
      {built.includes('port') && (
        <g transform={`translate(${port.x} ${port.y})`}>
          <Anchor />
        </g>
      )}
    </g>
  )
}

/** The marks over a country's capital and towns for what is happening there now. */
function Marks({ country, has }: { country: Country; has: (id: CountryCondition['id']) => boolean }) {
  const { capital, towns } = SETTLEMENTS[country.id]
  const at = (x: number, y: number) => `translate(${capital.x + x} ${capital.y + y})`
  return (
    <g className={`marks marks-${country.id}`}>
      {has('booming') &&
        [capital, ...towns].map((place, index) => (
          <g key={`${place.x},${place.y}`} transform={`translate(${place.x + 5} ${place.y - 6}) scale(1.5)`}>
            <g className="glint" style={{ animationDelay: `${index * 0.45}s` }}>
              <Glint />
            </g>
          </g>
        ))}
      {has('building') && (
        <g transform={at(-12, -3)}>
          <Crane />
        </g>
      )}
      {has('hostile') && (
        <g transform={at(13, -6)}>
          <Swords />
        </g>
      )}
      {has('unrest') && (
        <g transform={`${at(0, -4)} scale(1.3)`}>
          <Smoke />
        </g>
      )}
      {has('crisis') && (
        <g transform={at(0, 0)}>
          <CrisisRing />
        </g>
      )}
    </g>
  )
}

/** A trade route between two capitals, bowed over the water, with a trader working along it. */
function TradeRoute({ from, to, moving }: { from: CountryId; to: CountryId; moving: boolean }) {
  const a = SETTLEMENTS[from].capital
  const b = SETTLEMENTS[to].capital
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const bow = { x: (a.x + b.x) / 2 - ((b.y - a.y) / length) * length * 0.18, y: (a.y + b.y) / 2 + ((b.x - a.x) / length) * length * 0.18 }
  const path = `M${a.x},${a.y} Q${bow.x.toFixed(1)},${bow.y.toFixed(1)} ${b.x},${b.y}`
  const middle = { x: (a.x + 2 * bow.x + b.x) / 4, y: (a.y + 2 * bow.y + b.y) / 4 }
  return (
    <g className="trade-route">
      <path d={path} />
      {moving ? (
        <circle className="trader" r={2.6}>
          <animateMotion dur={`${Math.max(5, length / 28).toFixed(1)}s`} repeatCount="indefinite" path={path} keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
        </circle>
      ) : (
        <circle className="trader" r={2.6} cx={middle.x} cy={middle.y} />
      )}
    </g>
  )
}

/**
 * The chart's title block, set on land in the top corner as charts do, with
 * the key to its colours.
 */
function ChartTitle() {
  return (
    <g className="cartouche" aria-hidden="true" transform="translate(10 10)">
      <rect className="cartouche-paper" width="196" height="70" />
      <rect className="cartouche-rule" x="3" y="3" width="190" height="64" />
      <text className="cartouche-title" x="98" y="22">
        The Meridian Sea
      </text>
      <rect className="cartouche-swatch tsengai" x="12" y="31" width="20" height="8" />
      <text className="cartouche-text" x="37" y="38.5">
        Leans Tsengai
      </text>
      <rect className="cartouche-swatch halvard" x="104" y="31" width="20" height="8" />
      <text className="cartouche-text" x="129" y="38.5">
        Leans Halvard
      </text>
      <circle className="cartouche-pencil" cx="17" cy="54" r="4" />
      <text className="cartouche-text" x="27" y="57.5">
        Pencil: your orders and choice
      </text>
    </g>
  )
}
