import {
  DEFAULT_AFTER_DEFICIT_TURNS,
  getProject,
  incomeBreakdown,
  projectTurnsLeft,
} from '../engine/index.ts'
import type { Country } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'
import { money, percent, signed } from './format.ts'

export function StatsPanel() {
  const game = useGameStore((store) => store.game)
  const player = game.countries[game.playerId]
  const { stats } = player
  const income = incomeBreakdown(player)
  const owedToPowers = Object.values(player.creditors).reduce((total, owed) => total + owed, 0)
  const others = Object.values(game.countries).filter((country) => country.id !== player.id)

  return (
    <section className="panel" aria-labelledby="stats-heading">
      <h2 id="stats-heading">{player.name}</h2>

      <dl className="stats">
        <dt>Treasury</dt>
        <dd className={stats.treasury < 0 ? 'bad' : undefined}>{money(stats.treasury)}</dd>
        <dt>Debt</dt>
        <dd>{money(stats.debt)}</dd>
        <dt>Growth</dt>
        <dd>{percent(stats.growth)}</dd>
        <Gauge label="Legitimacy" value={stats.legitimacy} />
        <Gauge label="Military loyalty" value={stats.militaryLoyalty} />
        <Gauge label="Defence" value={stats.defence} />
      </dl>

      {stats.treasury < 0 && (
        <p className="warning">
          The treasury is below zero. Ending {DEFAULT_AFTER_DEFICIT_TURNS} turns in a row below zero means
          default. Turns so far: {game.deficitTurns}.
        </p>
      )}

      <AlignmentMeter value={stats.alignment} />

      <h3>Income per turn</h3>
      <table className="figures">
        <tbody>
          <tr>
            <th scope="row">Output</th>
            <td>{money(income.output)}</td>
          </tr>
          <tr>
            <th scope="row">Strait tolls</th>
            <td>{money(income.tolls)}</td>
          </tr>
          <tr>
            <th scope="row">Debt interest</th>
            <td>−{money(income.interest)}</td>
          </tr>
          <tr>
            <th scope="row">Upkeep</th>
            <td>−{money(income.upkeep)}</td>
          </tr>
          <tr className="total">
            <th scope="row">Net</th>
            <td>{signed(income.net)}</td>
          </tr>
        </tbody>
      </table>

      <h3>Debt owed to</h3>
      <table className="figures">
        <tbody>
          {Object.entries(player.creditors).map(([id, owed]) => (
            <tr key={id}>
              <th scope="row">{game.countries[id].name}</th>
              <td>{money(owed)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Other lenders</th>
            <td>{money(stats.debt - owedToPowers)}</td>
          </tr>
        </tbody>
      </table>

      <h3>Infrastructure</h3>
      {player.projects.length === 0 ? (
        <p className="muted">Nothing built or under way.</p>
      ) : (
        <ul className="plain">
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

      <h3>Relations</h3>
      <table className="figures relations">
        <thead>
          <tr>
            <th scope="col">Country</th>
            <th scope="col">Relations</th>
            <th scope="col">Alignment</th>
          </tr>
        </thead>
        <tbody>
          {others.map((country) => (
            <RelationsRow key={country.id} country={country} relations={player.relations[country.id] ?? 0} />
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="gauge">
        <meter min={0} max={100} value={value} aria-label={label} />
        <span>{value}</span>
      </dd>
    </>
  )
}

function AlignmentMeter({ value }: { value: number }) {
  // The scale runs from -100 (Tsengai) to +100 (Halvard), so 0 sits in the middle.
  const position = (value + 100) / 2
  return (
    <div className="alignment">
      <div className="alignment-label">
        <span>Alignment</span>
        <span>{signed(value)}</span>
      </div>
      <div
        className="alignment-track"
        role="meter"
        aria-label="Alignment, from Tsengai at -100 to Halvard at +100"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div className="alignment-marker" style={{ left: `${position}%` }} />
      </div>
      <div className="alignment-ends">
        <span>Tsengai</span>
        <span>Halvard</span>
      </div>
    </div>
  )
}

function RelationsRow({ country, relations }: { country: Country; relations: number }) {
  return (
    <tr title={country.description}>
      <th scope="row">
        {country.name}
        {country.kind === 'greatPower' && <span className="tag">Great power</span>}
      </th>
      <td className={relations < 0 ? 'bad' : undefined}>{signed(relations)}</td>
      <td>{signed(country.stats.alignment)}</td>
    </tr>
  )
}
