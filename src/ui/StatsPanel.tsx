import { useState } from 'react'
import { getProject, incomeBreakdown, projectTurnsLeft } from '../engine/index.ts'
import type { Country } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'
import { money, percent, signed } from './format.ts'
import { FactionsSection, HedgingSection, StraitSection } from './PositionSections.tsx'
import { TradeDeals } from './TradeDeals.tsx'

export function StatsPanel() {
  const game = useGameStore((store) => store.game)
  const player = game.countries[game.playerId]
  const { stats } = player
  const income = incomeBreakdown(game, player.id)
  const owedToPowers = Object.values(player.creditors).reduce((total, owed) => total + owed, 0)
  const others = Object.values(game.countries).filter((country) => country.id !== player.id)
  // Only phones can collapse the panel. Wider screens always show it in full.
  const [open, setOpen] = useState(false)

  return (
    <section
      className={open ? 'panel stats-panel collapsible open' : 'panel stats-panel collapsible'}
      aria-labelledby="stats-heading"
    >
      <div className="panel-head">
        <h2 id="stats-heading">{player.name}</h2>
        <button
          type="button"
          className="collapse-toggle"
          aria-expanded={open}
          aria-controls="stats-body"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide stats' : 'Show stats'}
        </button>
      </div>
      <p className="collapsed-summary muted">
        Treasury {money(stats.treasury)} · Debt {money(stats.debt)} · Growth {percent(stats.growth)}
      </p>

      <div id="stats-body" className="collapsible-body">
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

        <FactionsSection />
        <HedgingSection />

        <h3>Income per turn</h3>
        <table className="figures">
          <tbody>
            <tr>
              <th scope="row">Output</th>
              <td>{money(income.output)}</td>
            </tr>
            {income.tradeLoss > 0 && (
              <tr>
                <th scope="row">Trade cut</th>
                <td className="bad">−{money(income.tradeLoss)}</td>
              </tr>
            )}
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

        <TradeDeals countryId={player.id} heading="Trade deals" />

        <StraitSection />

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
      </div>
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
