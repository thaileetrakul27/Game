import { latestNews, quarterLabel } from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'

/** What the other countries did in the turn just played, one story per country. */
export function NewsPanel() {
  const game = useGameStore((store) => store.game)
  const news = latestNews(game)
  const lastTurn = game.status === 'ended' ? game.turn : game.turn - 1

  return (
    <section className="panel" aria-labelledby="news-heading">
      <h2 id="news-heading">News</h2>
      {news.length === 0 ? (
        <p className="muted">The other countries make their first moves when you end this turn.</p>
      ) : (
        <>
          <p className="muted small">What the other countries did in {quarterLabel(lastTurn)}.</p>
          <NewsStories />
        </>
      )}
    </section>
  )
}

/** The stories alone, shared with the briefing. */
export function NewsStories() {
  const game = useGameStore((store) => store.game)
  return (
    <div className="stories">
      {latestNews(game).map((story) => (
        <section key={story.countryId} className="story" aria-label={story.name}>
          <h3>{story.name}</h3>
          <ul className="plain">
            {story.lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
