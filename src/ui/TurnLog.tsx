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
          <ul className="plain">
            {entries.map((entry, index) => (
              <li key={index} className={`log-${entry.phase}`}>
                {entry.text}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
