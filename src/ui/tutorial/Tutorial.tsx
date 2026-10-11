import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore.ts'
import { prefersReducedMotion } from '../motion.ts'
import { finishTutorial } from '../session.ts'
import { useUiStore } from '../uiState.ts'
import { useWideScreen } from '../useWideScreen.ts'
import { stepCount, STEPS, tourPosition } from './steps.ts'
import type { TourContext, TourStep } from './steps.ts'

/**
 * The guided tutorial over a game's first three turns: a highlight on one
 * part of the screen at a time, and a note on what it is and what to try.
 * It moves on by itself as the player does what a step asks.
 */
export function Tutorial({ where, hidden }: { where: 'briefing' | 'map'; hidden: boolean }) {
  const progress = useUiStore((store) => store.tutorial)
  const setTutorialStep = useUiStore((store) => store.setTutorialStep)
  const tab = useUiStore((store) => store.tab)
  const game = useGameStore((store) => store.game)
  const planned = useGameStore((store) => store.planned)
  const crisisResponse = useGameStore((store) => store.crisisResponse)
  const offerResponse = useGameStore((store) => store.offerResponse)
  const selectedCountryId = useGameStore((store) => store.selectedCountryId)
  const wide = useWideScreen()

  const context: TourContext = { game, planned, crisisResponse, offerResponse, selectedCountryId, tab, wide, where }
  const position =
    progress && !hidden && game.status === 'playing'
      ? tourPosition(progress.step, game.turn - progress.startTurn, context)
      : null

  // Keep the place, so a step done stays done, and finish once every step is behind the player.
  useEffect(() => {
    if (!progress) return
    if (game.status !== 'playing' || position?.kind === 'finished') finishTutorial()
    else if (position && position.index !== progress.step) setTutorialStep(position.index)
  })

  if (!progress || position?.kind !== 'show') return null
  const next = () => {
    if (position.index + 1 >= STEPS.length) finishTutorial()
    else setTutorialStep(position.index + 1)
  }
  return (
    <Coach
      key={position.step.id}
      step={position.step}
      text={position.step.text(context)}
      count={stepCount(position.index, context)}
      turn={position.step.turn + 1}
      last={position.index === STEPS.length - 1}
      inBriefing={where === 'briefing'}
      onNext={next}
    />
  )
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** Room around the highlighted element, and between it and the note. */
const PAD = 6
const GAP = 12
const EDGE = 12

function Coach({
  step,
  text,
  count,
  turn,
  last,
  inBriefing,
  onNext,
}: {
  step: TourStep
  text: string
  count: { number: number; of: number }
  turn: number
  last: boolean
  inBriefing: boolean
  onNext: () => void
}) {
  const card = useRef<HTMLElement>(null)
  const [host, setHost] = useState<Element | null>(null)
  const [layout, setLayout] = useState<{ ring: Box | null; card: { top: number; left: number } } | null>(null)

  // Follow what the step points at as it moves, scrolls or appears, every frame. In the
  // briefing, the note has to sit inside the briefing's dialog to show above it.
  useLayoutEffect(() => {
    let frame = 0
    let shown: Element | null = null
    const place = () => {
      setHost(inBriefing ? document.querySelector('dialog.turn-briefing') : document.body)
      const target = step.targets?.map((selector) => document.querySelector(selector)).find(Boolean) ?? null
      if (target && target !== shown) {
        shown = target
        target.scrollIntoView({
          block: inBriefing ? 'center' : 'nearest',
          inline: 'nearest',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        })
      }
      const next = arrange(target ? visibleBox(target) : null, card.current, step.overlap ?? 'bottom')
      setLayout((current) => (sameLayout(current, next) ? current : next))
      frame = requestAnimationFrame(place)
    }
    frame = requestAnimationFrame(place)
    return () => cancelAnimationFrame(frame)
  }, [step, inBriefing])

  if (!host) return null
  return createPortal(
    <div className="coach-layer">
      {layout?.ring ? (
        <div
          className="coach-ring"
          style={{ top: layout.ring.top, left: layout.ring.left, width: layout.ring.width, height: layout.ring.height }}
        />
      ) : (
        <div className="coach-dim" />
      )}
      <aside
        ref={card}
        className="coach"
        aria-labelledby="coach-title"
        aria-describedby="coach-text"
        style={layout ? { top: layout.card.top, left: layout.card.left } : { visibility: 'hidden' }}
      >
        <p className="coach-count">
          Tutorial, turn {turn} of 3: step {count.number} of {count.of}
        </p>
        <h2 id="coach-title" className="coach-title">
          {step.title}
        </h2>
        <p id="coach-text" className="coach-text" aria-live="polite">
          {text}
        </p>
        <div className="coach-foot">
          {step.task ? (
            <p className="coach-task">{step.task}</p>
          ) : (
            <button type="button" className="primary coach-next" onClick={onNext}>
              {last ? 'Finish' : 'Next'}
            </button>
          )}
          {!last && (
            <button type="button" className="coach-skip" onClick={finishTutorial}>
              Skip tutorial
            </button>
          )}
        </div>
      </aside>
    </div>,
    host,
  )
}

/** The part of an element that can be seen: inside the window and every scrolling box around it. */
function visibleBox(element: Element): Box | null {
  const rect = element.getBoundingClientRect()
  let top = rect.top
  let left = rect.left
  let bottom = rect.bottom
  let right = rect.right
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent)
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
    const clip = parent.getBoundingClientRect()
    top = Math.max(top, clip.top)
    left = Math.max(left, clip.left)
    bottom = Math.min(bottom, clip.bottom)
    right = Math.min(right, clip.right)
  }
  top = Math.max(top, 0)
  left = Math.max(left, 0)
  bottom = Math.min(bottom, window.innerHeight)
  right = Math.min(right, window.innerWidth)
  if (bottom - top < 4 || right - left < 4) return null
  return { top, left, width: right - left, height: bottom - top }
}

/**
 * Put the note beside the highlighted box: below it if there is room, else
 * above, else over the top or bottom of the screen. Without a box, in the
 * middle of the screen.
 */
function arrange(target: Box | null, card: HTMLElement | null, overlap: 'top' | 'bottom') {
  const width = window.innerWidth
  const height = window.innerHeight
  const cardWidth = card?.offsetWidth ?? 320
  const cardHeight = card?.offsetHeight ?? 180
  if (!target) {
    return { ring: null, card: { top: Math.max(EDGE, (height - cardHeight) / 2), left: (width - cardWidth) / 2 } }
  }
  const ring = {
    top: target.top - PAD,
    left: target.left - PAD,
    width: target.width + PAD * 2,
    height: target.height + PAD * 2,
  }
  const below = ring.top + ring.height + GAP
  const above = ring.top - GAP - cardHeight
  const top =
    below + cardHeight <= height - EDGE
      ? below
      : above >= EDGE
        ? above
        : overlap === 'top'
          ? EDGE
          : height - EDGE - cardHeight
  const centre = target.left + target.width / 2
  const left = Math.min(Math.max(EDGE, centre - cardWidth / 2), width - EDGE - cardWidth)
  return { ring, card: { top: Math.round(top), left: Math.round(Math.max(EDGE, left)) } }
}

type Layout = ReturnType<typeof arrange>

function sameLayout(a: Layout | null, b: Layout): boolean {
  if (!a) return false
  const close = (x: number, y: number) => Math.abs(x - y) < 0.5
  const sameRing =
    a.ring === null || b.ring === null
      ? a.ring === b.ring
      : close(a.ring.top, b.ring.top) &&
        close(a.ring.left, b.ring.left) &&
        close(a.ring.width, b.ring.width) &&
        close(a.ring.height, b.ring.height)
  return sameRing && close(a.card.top, b.card.top) && close(a.card.left, b.card.left)
}
