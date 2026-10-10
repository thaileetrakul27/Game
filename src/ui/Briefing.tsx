import { incomeBreakdown, latestNews, MAX_TURNS, quarterLabel } from '../engine/index.ts'
import { unanswered, useGameStore } from '../store/gameStore.ts'
import { Dialog } from './Dialog.tsx'
import { CrisisDossier, DemandDossier, OfferDossier } from './Dossiers.tsx'
import { money, signed } from './format.ts'
import { NewsStories } from './panels/NewsPanel.tsx'

/**
 * The full-screen briefing that opens each turn: the quarter's money, what
 * happened last quarter, what the other countries did, and anything to answer.
 */
export function Briefing({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="briefing-title" className="briefing-dialog">
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
  const hasNews = latestNews(game).length > 0
  const lastQuarter = game.log.filter(
    (entry) =>
      (entry.turn === game.turn - 1 && (entry.phase === 'crisis' || entry.phase === 'resolution')) ||
      (entry.turn === game.turn && entry.phase === 'briefing' && entry.text.startsWith('This game,')),
  )
  const decisions = [game.demand, game.offer, game.crisis].filter(Boolean).length

  return (
    <article className="paper briefing">
      <p className="classification">Cabinet eyes only</p>
      <header className="briefing-head">
        <h1 id="briefing-title" tabIndex={-1} data-autofocus>
          Quarterly briefing
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

      <section className="briefing-section">
        <h2>Treasury</h2>
        <p>
          Income this quarter <strong>{signed(income.net)}</strong>: output {money(income.output)}
          {income.tradeLoss > 0 ? `, minus ${money(income.tradeLoss)} lost to a trade cut` : ''}, strait tolls{' '}
          {money(income.tolls)}, debt interest −{money(income.interest)}, upkeep −{money(income.upkeep)}.
        </p>
        <p>
          The treasury stands at{' '}
          <strong className={player.stats.treasury < 0 ? 'bad' : undefined}>{money(player.stats.treasury)}</strong>,
          with debts of {money(player.stats.debt)}.
        </p>
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

      {hasNews && (
        <section className="briefing-section">
          <h2>Intelligence</h2>
          <NewsStories />
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
        <button type="button" className="primary" onClick={onClose}>
          To the map
        </button>
      </footer>
    </article>
  )
}
