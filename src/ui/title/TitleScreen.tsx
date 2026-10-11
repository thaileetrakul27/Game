import { useEffect, useRef, useState } from 'react'
import { listSaves, readSave, tutorialSeen } from '../../store/saves.ts'
import type { SaveRecord, SaveSlot } from '../../store/saves.ts'
import { MAP_HEIGHT, MAP_WIDTH } from '../map/geometry.ts'
import { TerrainGlyph } from '../map/Glyphs.tsx'
import { OUTLINES, TERRAIN } from '../map/terrain.ts'
import { prefersReducedMotion } from '../motion.ts'
import { SaveDetails } from '../SaveDetails.tsx'
import { resumeGame, startNewGame } from '../session.ts'
import { saveHeadline, savedWhen, slotName } from '../saveText.ts'

/** How long the intro runs before the menu appears, unless the player skips it. */
const INTRO_MS = 2300

/** Cables decrypting while the chart draws in, as the intro's loading lines. */
const CABLES = [
  'HALVARD COMPACT ...... PRIORITY',
  'TSENGAI REPUBLIC ..... FLASH',
  'OSTREL STATION ....... ROUTINE',
  'STRAIT PATROL ........ CONFIRMED',
]

type View = { kind: 'menu' } | { kind: 'load' } | { kind: 'confirm'; tutorial: boolean }

/** The intro plays when the game is first opened, not on every return to the title. */
let introPlayed = false

/**
 * The title screen: the chart draws itself in while the cables decrypt, then
 * the menu offers Continue, New game, Load game and How to play.
 */
export function TitleScreen() {
  const [intro, setIntro] = useState(() => !introPlayed && !prefersReducedMotion())
  const [view, setView] = useState<View>({ kind: 'menu' })
  // Read once when the screen opens: saves only change from inside a game.
  const [auto] = useState(() => readSave('auto'))
  const [slots] = useState(() => listSaves())
  const inProgress = auto.state === 'ready' && auto.record.game.status === 'playing' ? auto.record : null

  // The intro runs by itself, and any click or key skips it. A key skips as it comes back up,
  // so the same press can't also choose from the menu that appears in its place.
  useEffect(() => {
    if (!intro) return
    introPlayed = true
    const skip = () => setIntro(false)
    const timer = window.setTimeout(skip, INTRO_MS)
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keyup', skip)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keyup', skip)
    }
  }, [intro])

  function startNew(tutorial: boolean) {
    if (inProgress) setView({ kind: 'confirm', tutorial })
    else startNewGame(tutorial ? { tutorial: true } : {})
  }

  return (
    <div className={intro ? 'title-screen intro' : 'title-screen'}>
      <TitleChart />
      <main className="title-content">
        <p className="title-classification">Secret // Cabinet eyes only</p>
        <h1 className="title-name">
          <span className="title-letters">Faultlines</span>
        </h1>
        <p className="title-tagline">A small state on a strait that two great powers both want.</p>

        {intro ? (
          <Decrypting />
        ) : view.kind === 'load' ? (
          <LoadList slots={slots} onBack={() => setView({ kind: 'menu' })} />
        ) : view.kind === 'confirm' && inProgress ? (
          <ConfirmNew record={inProgress} tutorial={view.tutorial} onBack={() => setView({ kind: 'menu' })} />
        ) : (
          <TitleMenu continueFrom={inProgress} hasSaves={slots.some((slot) => slot.state !== 'empty')} onLoad={() => setView({ kind: 'load' })} onNew={startNew} />
        )}
      </main>
      <p className="title-foot">Saved games stay in this browser, on this device.</p>
    </div>
  )
}

function Decrypting() {
  return (
    <div className="decrypting" role="status">
      <p className="decrypting-label">Decrypting the quarter's cables…</p>
      <div className="decrypting-bar" aria-hidden="true">
        <span />
      </div>
      <ul className="cables" aria-hidden="true">
        {CABLES.map((cable, index) => (
          <li key={cable} style={{ animationDelay: `${300 + index * 380}ms`, width: `${cable.length + 2}ch` }}>
            &gt; {cable}
          </li>
        ))}
      </ul>
      <p className="decrypting-skip">Click or press any key to skip</p>
    </div>
  )
}

function TitleMenu({
  continueFrom,
  hasSaves,
  onLoad,
  onNew,
}: {
  continueFrom: SaveRecord | null
  hasSaves: boolean
  onLoad: () => void
  onNew: (tutorial: boolean) => void
}) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus({ preventScroll: true }), [])
  const firstGame = !tutorialSeen()

  return (
    <nav className="title-menu" aria-label="Main menu">
      {continueFrom && (
        <button type="button" ref={first} className="title-option lead" onClick={() => resumeGame(continueFrom)}>
          <span className="option-name">Continue</span>
          <span className="option-note">
            {saveHeadline(continueFrom)}. Saved {savedWhen(continueFrom.savedAt)}.
          </span>
        </button>
      )}
      <button
        type="button"
        ref={continueFrom ? undefined : first}
        className={continueFrom ? 'title-option' : 'title-option lead'}
        onClick={() => onNew(false)}
      >
        <span className="option-name">New game</span>
        <span className="option-note">
          {firstGame
            ? 'Your first game comes with a guided tutorial.'
            : 'A fresh quarter. The neighbours start a little differently every game.'}
        </span>
      </button>
      <button type="button" className="title-option" onClick={onLoad}>
        <span className="option-name">Load game</span>
        <span className="option-note">{hasSaves ? 'Pick up a game saved to a slot.' : 'No games saved to a slot yet.'}</span>
      </button>
      <button type="button" className="title-option" onClick={() => onNew(true)}>
        <span className="option-name">How to play</span>
        <span className="option-note">A new game with a guided tutorial over the first three turns.</span>
      </button>
    </nav>
  )
}

function LoadList({ slots, onBack }: { slots: SaveSlot[]; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus({ preventScroll: true }), [])
  return (
    <section className="title-panel" aria-labelledby="load-title">
      <h2 id="load-title" ref={heading} tabIndex={-1}>
        Load game
      </h2>
      <ul className="plain slot-list">
        {slots.map((slot) => (
          <li key={slot.slot} className="slot">
            <div className="slot-text">
              <strong className="slot-name">{slotName(slot.slot)}</strong>
              <SaveDetails slot={slot} />
            </div>
            {slot.state === 'ready' && (
              <button
                type="button"
                className="slot-button"
                onClick={() => resumeGame(slot.record)}
                aria-label={`Load ${slotName(slot.slot)}`}
              >
                Load
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="title-back" onClick={onBack}>
        Back
      </button>
    </section>
  )
}

function ConfirmNew({ record, tutorial, onBack }: { record: SaveRecord; tutorial: boolean; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus({ preventScroll: true }), [])
  return (
    <section className="title-panel" aria-labelledby="confirm-title">
      <h2 id="confirm-title" ref={heading} tabIndex={-1}>
        Start a new game?
      </h2>
      <p>
        Continue will no longer pick up the game in progress ({saveHeadline(record)}). Games saved to a slot are kept.
      </p>
      <div className="title-actions">
        <button type="button" className="primary" onClick={() => startNewGame(tutorial ? { tutorial: true } : {})}>
          {tutorial ? 'Start with the tutorial' : 'Start a new game'}
        </button>
        <button type="button" className="title-back" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  )
}

/** The chart behind the title, inking itself in on the table: coastlines first, then the land. */
function TitleChart() {
  const tint: Record<string, string> = { halvard: 'halvard', tsengai: 'tsengai', kessara: 'home' }
  return (
    <svg
      className="title-chart"
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="title-grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50,0 H0 V50" className="title-grid" />
        </pattern>
      </defs>
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#title-grid)" />
      {Object.entries(OUTLINES).map(([id, outline], index) => (
        <path
          key={id}
          className={`title-coast ${tint[id] ?? ''}`}
          d={outline.path}
          pathLength={1}
          style={{ animationDelay: `${index * 120}ms, ${900 + index * 120}ms` }}
        />
      ))}
      <g className="title-terrain">
        {Object.entries(TERRAIN).flatMap(([id, symbols]) =>
          symbols.map((symbol) => (
            <g key={`${id}-${symbol.x},${symbol.y}`} transform={`translate(${symbol.x} ${symbol.y}) scale(${symbol.scale})`}>
              <TerrainGlyph kind={symbol.kind} />
            </g>
          )),
        )}
      </g>
    </svg>
  )
}
