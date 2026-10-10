import {
  accessPhrase,
  getProject,
  incomeBreakdown,
  projectTurnsLeft,
  straitOwnedBy,
  straitTolls,
} from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'
import { capitalised, money, signed } from '../format.ts'
import { Warnings } from '../Warnings.tsx'
import { TradeDeals } from './TradeDeals.tsx'

/** Money: income, debt, trade deals, the strait and infrastructure, with economic warnings first. */
export function EconomyPanel() {
  const game = useGameStore((store) => store.game)
  const player = game.countries[game.playerId]
  const { stats } = player
  const income = incomeBreakdown(game, player.id)
  const owedToPowers = Object.values(player.creditors).reduce((total, owed) => total + owed, 0)
  const strait = straitOwnedBy(game.playerId)
  const tolls = strait ? straitTolls(game, strait) : {}

  return (
    <section className="panel" aria-labelledby="economy-heading">
      <h2 id="economy-heading">Economy</h2>
      <Warnings game={game} tab="economy" />

      <h3>Income each quarter</h3>
      <table className="figures">
        <tbody>
          <tr>
            <th scope="row">Output</th>
            <td>{money(income.output)}</td>
          </tr>
          {income.tradeLoss > 0 && (
            <tr>
              <th scope="row">Lost to a trade cut</th>
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
            <td className={income.net < 0 ? 'bad' : undefined}>{signed(income.net)}</td>
          </tr>
        </tbody>
      </table>

      <h3>Treasury and debt</h3>
      <table className="figures">
        <tbody>
          <tr>
            <th scope="row">Treasury</th>
            <td className={stats.treasury < 0 ? 'bad' : undefined}>{money(stats.treasury)}</td>
          </tr>
          {Object.entries(player.creditors).map(([id, owed]) => (
            <tr key={id}>
              <th scope="row">Owed to {game.countries[id].name}</th>
              <td>{money(owed)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Owed to other lenders</th>
            <td>{money(stats.debt - owedToPowers)}</td>
          </tr>
          <tr className="total">
            <th scope="row">Total debt</th>
            <td>{money(stats.debt)}</td>
          </tr>
        </tbody>
      </table>

      <h3>Trade deals</h3>
      <TradeDeals countryId={player.id} />

      {strait && (
        <>
          <h3>{strait.name}</h3>
          <p className="muted small">
            Carries {strait.tradeShare}% of regional trade. Change access from a great power's file.
          </p>
          <table className="figures">
            <thead>
              <tr>
                <th scope="col">Power</th>
                <th scope="col">Access</th>
                <th scope="col">Tolls</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(strait.traffic).map((powerId) => {
                const access = game.straitAccess[strait.id][powerId]
                return (
                  <tr key={powerId} title={`${strait.name} ${accessPhrase(access)} ${game.countries[powerId].name}`}>
                    <th scope="row">{game.countries[powerId].name}</th>
                    <td className={access === 'closed' ? 'bad' : undefined}>{capitalised(access)}</td>
                    <td>{money(tolls[powerId] ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      <h3>Infrastructure</h3>
      {player.projects.length === 0 ? (
        <p className="muted">Nothing built or under way. Start a project from the home file.</p>
      ) : (
        <ul className="plain projects">
          {player.projects.map((progress) => {
            const left = projectTurnsLeft(game, progress)
            return (
              <li key={progress.projectId}>
                <span>{getProject(progress.projectId).name}</span>
                <span className="muted">{left === 0 ? 'Built' : `${left} ${left === 1 ? 'turn' : 'turns'} to go`}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
