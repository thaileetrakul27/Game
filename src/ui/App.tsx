import { useState } from 'react'
import { useGameStore } from '../store/gameStore.ts'
import { Briefing } from './Briefing.tsx'
import { GameOver } from './GameOver.tsx'
import { Chart } from './map/Chart.tsx'
import { CountryFile } from './map/CountryFile.tsx'
import { EconomyPanel } from './panels/EconomyPanel.tsx'
import { FactionsPanel } from './panels/FactionsPanel.tsx'
import { LogPanel } from './panels/LogPanel.tsx'
import { NewsPanel } from './panels/NewsPanel.tsx'
import { StatsSheet } from './StatsSheet.tsx'
import { TabBar } from './TabBar.tsx'
import { TopBar } from './TopBar.tsx'
import { Tray } from './Tray.tsx'
import { briefingKey, useUiStore } from './uiState.ts'
import { useWideScreen } from './useWideScreen.ts'

export default function App() {
  const game = useGameStore((store) => store.game)
  const wide = useWideScreen()
  const tab = useUiStore((store) => store.tab)
  const briefingDoneFor = useUiStore((store) => store.briefingDoneFor)
  const closeBriefing = useUiStore((store) => store.closeBriefing)
  const statsOpen = useUiStore((store) => store.statsOpen)
  const setStatsOpen = useUiStore((store) => store.setStatsOpen)
  // The game whose final report the player has put away, to look back at the map.
  const [finalDoneFor, setFinalDoneFor] = useState<string | null>(null)

  const key = briefingKey(game)
  const briefingOpen = game.status === 'playing' && briefingDoneFor !== key
  const finalOpen = game.status === 'ended' && finalDoneFor !== key

  const stage = (
    <main className="stage" aria-label="The Meridian Sea">
      <div className="chart-area">
        <Chart />
        <CountryFile />
      </div>
      {game.status === 'playing' ? (
        <Tray wide={wide} />
      ) : (
        <section className="tray ended" aria-label="Game over">
          <span>The game is over.</span>
          <button type="button" className="primary" onClick={() => setFinalDoneFor(null)}>
            Read the final report
          </button>
        </section>
      )}
    </main>
  )

  const dialogs = (
    <>
      <Briefing open={briefingOpen} onClose={() => closeBriefing(key)} />
      <GameOver open={finalOpen} onClose={() => setFinalDoneFor(key)} />
      <StatsSheet open={statsOpen} onClose={() => setStatsOpen(false)} />
    </>
  )

  if (wide) {
    return (
      <div className="app wide">
        <TopBar wide />
        <aside className="side left" aria-label="Economy and factions">
          <EconomyPanel />
          <FactionsPanel />
        </aside>
        {stage}
        <aside className="side right" aria-label="News and log">
          <NewsPanel />
          <LogPanel />
        </aside>
        {dialogs}
      </div>
    )
  }

  return (
    <div className="app narrow">
      <TopBar wide={false} />
      {tab === 'map' ? (
        stage
      ) : (
        <main className="tab-view">
          {tab === 'economy' && <EconomyPanel />}
          {tab === 'factions' && <FactionsPanel />}
          {tab === 'news' && <NewsPanel />}
          {tab === 'log' && <LogPanel />}
        </main>
      )}
      <TabBar />
      {dialogs}
    </div>
  )
}
