// State that only the interface needs: which tab is open, whether the
// briefing has been put away for this turn, and whether the full stats are
// open. Nothing here affects the game; the game lives in src/store.

import { create } from 'zustand'

export type Tab = 'map' | 'economy' | 'factions' | 'news' | 'log'

interface UiState {
  tab: Tab
  /** The game and turn whose briefing the player has put away, as "seed:turn". */
  briefingDoneFor: string | null
  statsOpen: boolean
  setTab: (tab: Tab) => void
  closeBriefing: (key: string) => void
  openBriefing: () => void
  setStatsOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  tab: 'map',
  briefingDoneFor: null,
  statsOpen: false,
  setTab: (tab) => set({ tab }),
  closeBriefing: (key) => set({ briefingDoneFor: key }),
  openBriefing: () => set({ briefingDoneFor: null }),
  setStatsOpen: (statsOpen) => set({ statsOpen }),
}))

/** Identifies one turn of one game, so each turn's briefing opens once by itself. */
export const briefingKey = (game: { seed: number; turn: number }) => `${game.seed}:${game.turn}`
