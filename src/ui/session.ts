// Moving between the title screen and a game: starting one, picking one up
// from a save, and going back to the title. These only switch screens and
// reset what the interface shows; the game itself lives in src/store.

import { currentPlan, useGameStore } from '../store/gameStore.ts'
import { markTutorialSeen, tutorialSeen, writeSave } from '../store/saves.ts'
import type { SaveRecord } from '../store/saves.ts'
import { useUiStore } from './uiState.ts'

/**
 * Start a new game. A player's first game comes with the tutorial, and How
 * to play asks for it whatever.
 */
export function startNewGame({ tutorial = !tutorialSeen() }: { tutorial?: boolean } = {}): void {
  useGameStore.getState().newGame()
  enterGame(tutorial)
}

/** Pick up a saved game, with whatever was planned that turn. */
export function resumeGame(record: SaveRecord): void {
  useGameStore.getState().loadGame(record.game, record.plan)
  enterGame(false)
}

function enterGame(tutorial: boolean): void {
  const { game } = useGameStore.getState()
  useUiStore.setState({
    screen: 'game',
    tab: 'map',
    briefingDoneFor: null,
    statsOpen: false,
    menuOpen: false,
    interlude: null,
    tutorial: tutorial && game.status === 'playing' ? { startTurn: game.turn, step: 0 } : null,
  })
}

/** Back to the title screen. Continue will pick up this turn as it stands, orders and all. */
export function leaveToTitle(): void {
  const store = useGameStore.getState()
  writeSave('auto', store.game, currentPlan(store))
  store.selectCountry(null)
  useUiStore.setState({ screen: 'title', statsOpen: false, menuOpen: false, interlude: null, tutorial: null })
}

/** Run the tutorial again in the game being played, from the start of this turn's briefing. */
export function replayTutorial(): void {
  const { game, selectCountry } = useGameStore.getState()
  if (game.status !== 'playing') return
  selectCountry(null)
  useUiStore.setState({
    tab: 'map',
    menuOpen: false,
    statsOpen: false,
    briefingDoneFor: null,
    tutorial: { startTurn: game.turn, step: 0 },
  })
}

/** The tutorial is over, finished or skipped: don't offer it by itself again. */
export function finishTutorial(): void {
  markTutorialSeen()
  useUiStore.getState().endTutorial()
}
