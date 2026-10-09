import { quarterLabel } from '../engine/index.ts'
import type { LogEntry } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'

export function TurnLog() {
  const log = useGameStore((store) => store.game.log)

  // Newest turn first, each turn's entries in the order they happened.
  const turns = new Map<number, LogEntry[]>()
  for (const entry of log) turns.set(entry.turn, [...(turns.get(entry.turn) ?? []), entry])
  const newestFirst = [...turns.entries()].reverse()

  return (
    <section className="panel log" aria-labelledby="log-heading">
      <h2 id="log-heading">Turn log</h2>
      {newestFirst.map(([turn, entries]) => (
        <section key={turn} className="log-turn">
          <h3>
            {quarterLabel(turn)} <span className="muted">· turn {turn}</span>
          </h3>
          <TurnEntries entries={entries} />
        </section>
      ))}
    </section>
  )
}

/** A turn's entries, with the rivals' relation changes folded into one collapsible line. */
function TurnEntries({ entries }: { entries: LogEntry[] }) {
  const rivals = entries.filter((entry) => entry.phase === 'rivals')
  const firstRival = entries.findIndex((entry) => entry.phase === 'rivals')

  return (
    <ul className="plain">
      {entries.map((entry, index) => {
        if (entry.phase !== 'rivals') {
          return (
            <li key={index} className={`log-${entry.phase}`}>
              {entry.text}
            </li>
          )
        }
        if (index !== firstRival) return null
        return (
          <li key={index} className="log-rivals">
            <details>
              <summary>
                Rival relations: {rivals.length} {rivals.length === 1 ? 'change' : 'changes'}
              </summary>
              <ul className="plain">
                {rivals.map((rival, rivalIndex) => (
                  <li key={rivalIndex}>{rival.text}</li>
                ))}
              </ul>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
