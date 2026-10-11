// State that only the interface needs: which screen and tab are showing,
// whether the briefing has been put away for this turn, which sheets are
// open, the quarter interlude and where the tutorial has got to. Nothing here
// affects the game; the game lives in src/store.

import { create } from 'zustand'

export type Tab = 'map' | 'economy' | 'factions' | 'news' | 'log'

/** Where the tutorial has got to: the turn it began on, and the step it is showing. */
export interface TutorialProgress {
  startTurn: number
  step: number
}

interface UiState {
  screen: 'title' | 'game'
  tab: Tab
  /** The game and turn whose briefing the player has put away, as "seed:turn". */
  briefingDoneFor: string | null
  statsOpen: boolean
  menuOpen: boolean
  /** The turn that has just closed, while the interlude between quarters shows, before the next briefing. */
  interlude: number | null
  tutorial: TutorialProgress | null
  setTab: (tab: Tab) => void
  closeBriefing: (key: string) => void
  openBriefing: () => void
  setStatsOpen: (open: boolean) => void
  setMenuOpen: (open: boolean) => void
  showInterlude: (closedTurn: number) => void
  endInterlude: () => void
  setTutorialStep: (step: number) => void
  endTutorial: () => void
}

export const useUiStore = create<UiState>()((set) => ({
  screen: 'title',
  tab: 'map',
  briefingDoneFor: null,
  statsOpen: false,
  menuOpen: false,
  interlude: null,
  tutorial: null,
  setTab: (tab) => set({ tab }),
  closeBriefing: (key) => set({ briefingDoneFor: key }),
  openBriefing: () => set({ briefingDoneFor: null }),
  setStatsOpen: (statsOpen) => set({ statsOpen }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  showInterlude: (interlude) => set({ interlude }),
  endInterlude: () => set({ interlude: null }),
  setTutorialStep: (step) => set((state) => (state.tutorial ? { tutorial: { ...state.tutorial, step } } : {})),
  endTutorial: () => set({ tutorial: null }),
}))

/** Identifies one turn of one game, so each turn's briefing opens once by itself. */
export const briefingKey = (game: { seed: number; turn: number }) => `${game.seed}:${game.turn}`
