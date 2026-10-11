import { incomeBreakdown, latestNews, MAX_TURNS, quarterLabel } from '../engine/index.ts'
import { unanswered, useGameStore } from '../store/gameStore.ts'
import { Dialog } from './Dialog.tsx'
import { CrisisDossier, DemandDossier, OfferDossier } from './Dossiers.tsx'
import { money, signed } from './format.ts'
import { useTypedLength } from './motion.ts'
import { NewsStories } from './panels/NewsPanel.tsx'

/**
 * The full-screen briefing that opens each turn: the quarter's money, what
 * happened last quarter, what the other countries did, and anything to answer.
 */
export function Briefing({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="briefing-title" className="briefing-dialog turn-briefing">
      <BriefingPaper onClose={onClose} />
    </Dialog>
  )
}

function BriefingPaper({ onClose }: { onClose: () => void }) {
  const game = useGameStore((store) => store.game)
  const crisisResponse = useGameStore((store) => store.crisisResponse)
  const demandResponse = useGameStore((store) => store.demandResponse)
  const offerResponse = useGameStore((store) => store.offerResponse)
  const player = game.countries[game.playerId]
  const income = incomeBreakdown(game, player.id)
  const missing = unanswered({ game, crisisResponse, demandResponse, offerResponse })
  // The intelligence that concerns the player first; the rest of the other countries' moves fold away.
  const news = latestNews(game)
  const mentionsUs = (line: string) => line.includes(player.name)
  const aboutUs = news.flatMap((story) => story.lines.filter(mentionsUs).map((line) => ({ name: story.name, line })))
  const elsewhere = news
    .map((story) => ({ ...story, lines: story.lines.filter((line) => !mentionsUs(line)) }))
    .filter((story) => story.lines.length > 0)
  const lastQuarter = game.log.filter(
    (entry) =>
      (entry.turn === game.turn - 1 && (entry.phase === 'crisis' || entry.phase === 'resolution')) ||
      (entry.turn === game.turn && entry.phase === 'briefing' && entry.text.startsWith('This game,')),
  )
  const decisions = [game.demand, game.offer, game.crisis].filter(Boolean).length

  return (
    <article className="paper briefing">
      <p className="classification">Cabinet eyes only</p>
      <header className="briefing-head" data-tour="briefing-head">
        <h1 id="briefing-title" tabIndex={-1} data-autofocus>
          <Typed text="Quarterly briefing" />
        </h1>
        <p className="briefing-date">
          {quarterLabel(game.turn)}, turn {game.turn} of {MAX_TURNS}
        </p>
      </header>

      {game.turn === 1 && (
        <section className="briefing-section">
          <h2>Your situation</h2>
          <p>
            You lead {player.name}, a small state on the strait that two great powers both want. Stay in power for{' '}
            {MAX_TURNS} turns and get richer without ever fully picking a side. On the chart, blue countries lean toward
            the Halvard Compact and orange ones toward the Tsengai Republic. Each turn, tap a country to give orders
            about it, or tap {player.name} for orders at home.
          </p>
        </section>
      )}

      <section className="briefing-section" data-tour="treasury">
        <h2>Treasury</h2>
        <p>
          Income this quarter <strong>{signed(income.net)}</strong>, leaving{' '}
          <strong className={player.stats.treasury < 0 ? 'bad' : undefined}>{money(player.stats.treasury)}</strong> in
          the treasury.
        </p>
        <details className="fold">
          <summary>Where the money came from</summary>
          <p>
            Output {money(income.output)}
            {income.tradeLoss > 0 ? `, minus ${money(income.tradeLoss)} lost to a trade cut` : ''}, strait tolls{' '}
            {money(income.tolls)}, debt interest −{money(income.interest)}, upkeep −{money(income.upkeep)}. Debts
            stand at {money(player.stats.debt)} in all.
          </p>
        </details>
      </section>

      {lastQuarter.length > 0 && (
        <section className="briefing-section">
          <h2>{game.turn === 1 ? 'Before you begin' : 'Last quarter'}</h2>
          <ul className="plain report">
            {lastQuarter.map((entry, index) => (
              <li key={index}>{entry.text}</li>
            ))}
          </ul>
        </section>
      )}

      {news.length > 0 && (
        <section className="briefing-section" data-tour="intelligence">
          <h2>Intelligence</h2>
          {aboutUs.length > 0 ? (
            <ul className="plain report">
              {aboutUs.map(({ name, line }, index) =>
                // A line that already starts with the country's name needs no label in front.
                line.startsWith(name) ? (
                  <li key={index}>{line}</li>
                ) : (
                  <li key={index}>
                    <strong>{name}:</strong> {line}
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p>Nothing the other countries did last quarter was aimed at {player.name}.</p>
          )}
          {elsewhere.length > 0 && (
            <details className="fold">
              <summary>Everything else they did</summary>
              <NewsStories stories={elsewhere} />
            </details>
          )}
        </section>
      )}

      {decisions > 0 && (
        <section className="briefing-section decisions">
          <h2>For your decision</h2>
          <DemandDossier />
          <OfferDossier />
          <CrisisDossier />
        </section>
      )}

      <footer className="briefing-foot">
        {missing.length > 0 && <p className="muted">Answer {missing.join(' and ')} before you end the turn.</p>}
        <button type="button" className="primary" onClick={onClose} data-tour="to-map">
          To the map
        </button>
      </footer>
    </article>
  )
}

/**
 * A heading typed out letter by letter as the paper arrives. The whole text
 * is there from the start for screen readers, and holds its space on the page.
 */
function Typed({ text }: { text: string }) {
  const typed = useTypedLength(text, 40, 120)
  if (typed >= text.length) return <>{text}</>
  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span className="typed" aria-hidden="true">
        {text.slice(0, typed)}
        <span className="typed-caret" />
        <span className="typed-rest">{text.slice(typed)}</span>
      </span>
    </>
  )
}
