// Seeded random number generator (mulberry32). Every random roll in the game
// must come from here, never Math.random, so any game replays from its seed.

/** One step of mulberry32. Pure: returns the roll and the next state. */
export function mulberry32(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) | 0
  let t = Math.imul(next ^ (next >>> 15), 1 | next)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next >>> 0 }
}

/** Turn any number into a valid 32-bit generator state. */
export function normaliseSeed(seed: number): number {
  return seed >>> 0
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number
  /** A random item from a non-empty list. */
  pick<T>(items: readonly T[]): T
  /** Current generator state, to store back into GameState. */
  readonly state: number
}

/**
 * A random stream starting from a stored generator state. advanceTurn creates
 * one per turn and writes its final state back into the new GameState.
 */
export function createRng(state: number): Rng {
  let current = normaliseSeed(state)

  const next = (): number => {
    const step = mulberry32(current)
    current = step.state
    return step.value
  }

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error('Cannot pick from an empty list')
      return items[Math.floor(next() * items.length)]
    },
    get state() {
      return current
    },
  }
}
