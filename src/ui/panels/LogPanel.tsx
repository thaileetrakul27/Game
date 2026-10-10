import { quarterLabel, rivalNews } from '../../engine/index.ts'
import type { LogEntry } from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'

/** Every turn's events, newest turn first, with the rivals' moves folded into one line a turn. */
export function LogPanel() {
  const log = useGameStore((store) => store.game.log)
  const turns = new Map<number, LogEntry[]>()
  for (const entry of log) turns.set(entry.turn, [...(turns.get(entry.turn) ?? []), entry])
  const newestFirst = [...turns.entries()].reverse()

  return (
    <section className="panel log" aria-labelledby="log-heading">
      <h2 id="log-heading">Log</h2>
      {newestFirst.map(([turn, entries]) => (
        <section key={turn} className="log-turn" aria-label={`Turn ${turn}`}>
          <h3>
            {quarterLabel(turn)} <span className="muted">turn {turn}</span>
          </h3>
          <TurnEntries turn={turn} entries={entries} />
        </section>
      ))}
    </section>
  )
}

function TurnEntries({ turn, entries }: { turn: number; entries: LogEntry[] }) {
  const game = useGameStore((store) => store.game)
  const firstRival = entries.findIndex((entry) => entry.phase === 'rivals')
  const moves = entries.filter((entry) => entry.phase === 'rivals').length

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
                Rival moves: {moves} {moves === 1 ? 'report' : 'reports'}
              </summary>
              <ul className="plain">
                {rivalNews(game, turn).map((story) => (
                  <li key={story.countryId}>
                    <strong>{story.name}:</strong> {story.lines.join(' ')}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
