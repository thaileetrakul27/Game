import { useState } from 'react'
import { currentPlan, useGameStore } from '../store/gameStore.ts'
import { listSaves, writeSave } from '../store/saves.ts'
import type { SaveSlot, SlotId } from '../store/saves.ts'
import { Dialog } from './Dialog.tsx'
import { SaveDetails } from './SaveDetails.tsx'
import { leaveToTitle, replayTutorial, resumeGame, startNewGame } from './session.ts'
import { slotName } from './saveText.ts'

/** The in-game menu: save to a slot, load one, replay the tutorial, start again or go back to the title. */
export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="menu-title" className="sheet-dialog">
      <MenuBody onClose={onClose} />
    </Dialog>
  )
}

/** A choice waiting to be confirmed: overwriting or loading a slot, or abandoning the game. */
type Pending = { kind: 'save' | 'load'; slot: SlotId } | { kind: 'new' } | null

function MenuBody({ onClose }: { onClose: () => void }) {
  const game = useGameStore((store) => store.game)
  const [slots, setSlots] = useState(() => listSaves())
  const [pending, setPending] = useState<Pending>(null)
  const [message, setMessage] = useState('')
  const playing = game.status === 'playing'

  function save(slot: SlotId) {
    const ok = writeSave(slot, game, currentPlan(useGameStore.getState()))
    setSlots(listSaves())
    setPending(null)
    setMessage(
      ok
        ? `Saved to ${slotName(slot)}, with the orders planned so far this turn.`
        : 'This browser is not letting the game save, as in a private window. Nothing was saved.',
    )
  }

  function askToSave(slot: SaveSlot) {
    setMessage('')
    if (slot.state === 'empty') save(slot.slot)
    else setPending({ kind: 'save', slot: slot.slot })
  }

  function load(slot: SaveSlot) {
    if (slot.state === 'ready') resumeGame(slot.record)
  }

  return (
    <div className="stats-sheet menu-sheet">
      <header className="file-head">
        <div>
          <p className="file-kind">Faultlines</p>
          <h2 id="menu-title" tabIndex={-1} data-autofocus>
            Menu
          </h2>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Close the menu">
          ×
        </button>
      </header>

      <h3>Saved games</h3>
      <p className="muted small">
        The game also saves itself at the start of every turn, for Continue on the title screen. Saves stay in this
        browser, on this device.
      </p>
      <ul className="plain slot-list">
        {slots.map((slot) => {
          const confirming = pending && pending.kind !== 'new' && pending.slot === slot.slot ? pending.kind : null
          return (
            <li key={slot.slot} className="slot">
              <div className="slot-text">
                <strong className="slot-name">{slotName(slot.slot)}</strong>
                <SaveDetails slot={slot} />
              </div>
              {confirming ? (
                <div className="slot-confirm" role="group" aria-label={`Confirm ${slotName(slot.slot)}`}>
                  <span>{confirming === 'save' ? 'Replace this save?' : 'Load it? This game is lost unless saved.'}</span>
                  <button
                    type="button"
                    className="slot-button strong"
                    onClick={() => (confirming === 'save' ? save(slot.slot) : load(slot))}
                  >
                    {confirming === 'save' ? 'Replace' : 'Load'}
                  </button>
                  <button type="button" className="slot-button" onClick={() => setPending(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="slot-buttons">
                  {playing && (
                    <button
                      type="button"
                      className="slot-button"
                      onClick={() => askToSave(slot)}
                      aria-label={`Save to ${slotName(slot.slot)}`}
                    >
                      Save here
                    </button>
                  )}
                  {slot.state === 'ready' && (
                    <button
                      type="button"
                      className="slot-button"
                      onClick={() => {
                        setMessage('')
                        setPending({ kind: 'load', slot: slot.slot })
                      }}
                      aria-label={`Load ${slotName(slot.slot)}`}
                    >
                      Load
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="save-message" role="status">
        {message}
      </p>

      <h3>This game</h3>
      <div className="menu-actions">
        {playing && (
          <button type="button" className="ghost-dark" onClick={replayTutorial}>
            How to play: replay the tutorial
          </button>
        )}
        {pending?.kind === 'new' ? (
          <div className="slot-confirm" role="group" aria-label="Confirm a new game">
            <span>Abandon this game and start a new one?</span>
            <button type="button" className="slot-button strong" onClick={() => startNewGame()}>
              Start a new game
            </button>
            <button type="button" className="slot-button" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ghost-dark"
            onClick={() => (playing && game.turn > 1 ? setPending({ kind: 'new' }) : startNewGame())}
          >
            New game
          </button>
        )}
        <button type="button" className="ghost-dark" onClick={leaveToTitle}>
          Title screen
        </button>
      </div>
      <p className="muted small">Seed {game.seed}. The same seed always plays out the same way.</p>
    </div>
  )
}
