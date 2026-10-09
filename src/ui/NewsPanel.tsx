import { useState } from 'react'
import { latestNews, quarterLabel } from '../engine/index.ts'
import { useGameStore } from '../store/gameStore.ts'

/** What the other countries did in the turn just played, one story per country. */
export function NewsPanel() {
  const game = useGameStore((store) => store.game)
  const news = latestNews(game)
  const moves = news.reduce((total, story) => total + story.lines.length, 0)
  const lastTurn = game.status === 'ended' ? game.turn : game.turn - 1
  // Only phones can collapse the panel. Wider screens always show it in full.
  const [open, setOpen] = useState(false)

  return (
    <section className={open ? 'panel news collapsible open' : 'panel news collapsible'} aria-labelledby="news-heading">
      <div className="panel-head">
        <h2 id="news-heading">News</h2>
        {news.length > 0 && (
          <button
            type="button"
            className="collapse-toggle"
            aria-expanded={open}
            aria-controls="news-body"
            onClick={() => setOpen(!open)}
          >
            {open ? 'Hide news' : 'Show news'}
          </button>
        )}
      </div>

      {news.length === 0 ? (
        <p className="muted">The other countries make their first moves when you end this turn.</p>
      ) : (
        <>
          <p className="collapsed-summary muted">
            {moves} {moves === 1 ? 'report' : 'reports'} from {news.length}{' '}
            {news.length === 1 ? 'country' : 'countries'} in {quarterLabel(lastTurn)}
          </p>
          <div id="news-body" className="collapsible-body">
            <p className="muted small">What the other countries did in {quarterLabel(lastTurn)}.</p>
            {news.map((story) => (
              <section key={story.countryId} className="story">
                <h3>{story.name}</h3>
                <ul className="plain">
                  {story.lines.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
