import { factionStatus, GAME_DATA, hedgingStatus } from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'
import { AlignmentScale } from '../AlignmentScale.tsx'
import { Warnings } from '../Warnings.tsx'

/** Domestic politics and the hedging position, with political warnings first. */
export function FactionsPanel() {
  const game = useGameStore((store) => store.game)
  const { stats } = game.countries[game.playerId]
  const factions = factionStatus(game)
  const status = hedgingStatus(game)
  const { unrestBelow } = GAME_DATA.factions
  const name = (id: string) => game.countries[id].name

  return (
    <section className="panel" aria-labelledby="factions-heading">
      <h2 id="factions-heading">Factions</h2>
      <Warnings game={game} tab="factions" />

      <ul className="plain meters">
        {factions.map((faction) => (
          <li key={faction.id} title={faction.description}>
            <Meter
              label={faction.name}
              value={faction.satisfaction}
              line={unrestBelow}
              note={faction.unrest ? 'In unrest' : undefined}
            />
          </li>
        ))}
      </ul>
      <p className="muted small">Below the line at {unrestBelow}, a faction can set off a crisis.</p>

      <h3>Government</h3>
      <ul className="plain meters">
        <li>
          <Meter label="Legitimacy" value={stats.legitimacy} />
        </li>
        <li>
          <Meter label="Military loyalty" value={stats.militaryLoyalty} />
        </li>
      </ul>

      <h3>Alignment</h3>
      <AlignmentScale alignment={status.alignment} label="Kessara" />
      <p className="muted small">
        Lines at ±{status.brokerWithin} (broker bonus), ±{status.tradeCutPast} (trade cut) and ±{status.demandPast}{' '}
        (demands).
      </p>
      <ul className="plain status-list">
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
      </ul>
    </section>
  )
}

function Meter({ label, value, line, note }: { label: string; value: number; line?: number; note?: string }) {
  return (
    <div className={note ? 'meter alarm' : 'meter'}>
      <div className="meter-head">
        <span>{label}</span>
        <span>
          {note && <span className="meter-note">{note}</span>} <strong>{value}</strong>
        </span>
      </div>
      <div className="bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span className="bar-fill" style={{ width: `${value}%` }} />
        {line !== undefined && <span className="bar-line" style={{ left: `${line}%` }} />}
      </div>
    </div>
  )
}
