// Sections of the stats panel for the player's position: factions, hedging
// and strait access. Every figure and rule comes from the engine.

import {
  accessPhrase,
  factionStatus,
  GAME_DATA,
  hedgingStatus,
  straitOwnedBy,
  straitTolls,
} from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'
import { money, signed } from './format.ts'

export function FactionsSection() {
  const game = useGameStore((store) => store.game)
  const factions = factionStatus(game)
  const { unrestBelow } = GAME_DATA.factions

  return (
    <section aria-labelledby="factions-heading">
      <h3 id="factions-heading">Factions</h3>
      <ul className="plain factions">
        {factions.map((faction) => (
          <li key={faction.id} className={faction.unrest ? 'faction unrest' : 'faction'} title={faction.description}>
            <div className="faction-head">
              <span>{faction.name}</span>
              <span>
                {faction.unrest && <span className="unrest-tag">▲ Unrest</span>} {faction.satisfaction}
              </span>
            </div>
            <div
              className="bar"
              role="meter"
              aria-label={`${faction.name} satisfaction`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={faction.satisfaction}
            >
              <div className="bar-fill" style={{ width: `${faction.satisfaction}%` }} />
              <div className="bar-line" style={{ left: `${unrestBelow}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">The line marks {unrestBelow}. Below it, a faction can trigger a crisis.</p>
    </section>
  )
}

export function HedgingSection() {
  const game = useGameStore((store) => store.game)
  const status = hedgingStatus(game)
  const name = (id: string) => game.countries[id].name
  const lines = [status.brokerWithin, status.tradeCutPast, status.demandPast]

  return (
    <section className="alignment" aria-labelledby="alignment-heading">
      <div className="alignment-label">
        <h3 id="alignment-heading">Alignment</h3>
        <span>{signed(status.alignment)}</span>
      </div>
      <div
        className="alignment-track"
        role="meter"
        aria-label="Alignment, from Tsengai at -100 to Halvard at +100"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={status.alignment}
      >
        {lines.flatMap((line) => [-line, line]).map((value) => (
          <div key={value} className="alignment-tick" style={{ left: `${(value + 100) / 2}%` }} />
        ))}
        <div className="alignment-marker" style={{ left: `${(status.alignment + 100) / 2}%` }} />
      </div>
      <div className="alignment-ends">
        <span>Tsengai</span>
        <span>Halvard</span>
      </div>
      <p className="muted small">
        Lines at ±{status.brokerWithin} (broker bonus), ±{status.tradeCutPast} (trade cut) and ±{status.demandPast}{' '}
        (demands).
      </p>

      <ul className="plain hedging-status">
        <li>
          {status.inBrokerRange
            ? `Broker bonus: ${status.brokerTurns} of ${status.brokerEveryTurns} turns in a row within ±${status.brokerWithin}.`
            : `Outside ±${status.brokerWithin}, so no broker bonus.`}
        </li>
        {status.tradeCutBy && (
          <li className="bad">
            {name(status.tradeCutBy)} has cut trade (past ±{status.tradeCutPast}).
          </li>
        )}
        {status.pastDemandLine && status.patronId && (
          <li className="bad">
            Past ±{status.demandPast}: {status.demandTurns} of {status.demandAfterTurns} turns before{' '}
            {name(status.patronId)} issues a demand.
          </li>
        )}
        {status.demandsAccepted
          .filter((entry) => entry.count > 0)
          .map((entry) => (
            <li key={entry.powerId} className="bad">
              Demands accepted from {name(entry.powerId)}: {entry.count} of {status.vassalAfterDemands}.
            </li>
          ))}
      </ul>
    </section>
  )
}

export function StraitSection() {
  const game = useGameStore((store) => store.game)
  const strait = straitOwnedBy(game.playerId)
  if (!strait) return null
  const tolls = straitTolls(game, strait)

  return (
    <section aria-labelledby="strait-heading">
      <h3 id="strait-heading">
        {strait.name} <span className="muted">· {strait.tradeShare}% of trade</span>
      </h3>
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
                <td className={access === 'closed' ? 'bad' : undefined}>
                  {access.charAt(0).toUpperCase() + access.slice(1)}
                </td>
                <td>{money(tolls[powerId])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted small">Change access with the Grant or deny strait access action.</p>
    </section>
  )
}
