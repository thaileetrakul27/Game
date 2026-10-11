import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

// Motion in the interface. Everything that moves checks here first, so a
// player whose device asks for reduced motion sees every change at once.
// The stylesheet switches off its own animations the same way.

const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion)
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * A number that rolls to each new value instead of jumping, and which way it
 * last moved, for a moment, so the readout can flash.
 */
export function useRollingNumber(value: number, duration = 650): { shown: number; moved: 'up' | 'down' | null } {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const [moved, setMoved] = useState<'up' | 'down' | null>(null)
  const current = useRef(value)
  const target = useRef(value)

  useEffect(() => {
    const show = (number: number) => {
      current.current = number
      setShown(number)
    }
    if (target.current === value) {
      if (current.current !== value) show(value)
      return
    }
    setMoved(value > target.current ? 'up' : 'down')
    target.current = value
    const clear = window.setTimeout(() => setMoved(null), 1100)
    if (reduced) {
      show(value)
      return () => window.clearTimeout(clear)
    }
    // Roll on from wherever the number is now, even if it was still rolling.
    const start = current.current
    const began = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - began) / duration)
      show(start + (value - start) * easeOut(t))
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(clear)
    }
  }, [value, duration, reduced])

  return { shown, moved }
}

/** How much of a text has been typed out so far, letter by letter, after a delay. */
export function useTypedLength(text: string, perLetter = 45, delay = 0): number {
  const reduced = useReducedMotion()
  const [typed, setTyped] = useState({ text, count: 0 })

  useEffect(() => {
    if (reduced) return
    let count = 0
    let interval = 0
    const wait = window.setTimeout(() => {
      interval = window.setInterval(() => {
        count += 1
        setTyped({ text, count })
        if (count >= text.length) window.clearInterval(interval)
      }, perLetter)
    }, delay)
    return () => {
      window.clearTimeout(wait)
      window.clearInterval(interval)
    }
  }, [text, perLetter, delay, reduced])

  if (reduced) return text.length
  return typed.text === text ? typed.count : 0
}
