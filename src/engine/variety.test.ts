import { describe, expect, it } from 'vitest'
import { createGameState, createRng, GAME_DATA, varyNeighbours } from './index.ts'
import type { Country, CountryId } from './index.ts'

const seeds = Array.from({ length: 100 }, (_, index) => index + 1)
const neighbours = ['valmora', 'ostrel', 'sabu', 'daranth']
const { variety } = GAME_DATA
const fromData = (): Record<CountryId, Country> =>
  Object.fromEntries(GAME_DATA.countries.map((country) => [country.id, structuredClone(country)]))
const base = fromData()
const varied = seeds.map((seed) => varyNeighbours(fromData(), 'kessara', createRng(seed)))

describe('variety between games', () => {
  it("moves each neighbour's stats within the ranges in the data, and never its debt", () => {
    for (const { countries } of varied) {
      for (const id of neighbours) {
        const was = base[id].stats
        const now = countries[id].stats
        expect(Math.abs(now.alignment - was.alignment)).toBeLessThanOrEqual(variety.alignment)
        for (const stat of ['legitimacy', 'militaryLoyalty', 'defence'] as const) {
          expect(Math.abs(now[stat] - was[stat])).toBeLessThanOrEqual(variety.stats)
        }
        expect(Math.abs(now.treasury - was.treasury)).toBeLessThanOrEqual(was.treasury * variety.treasuryShare + 0.5)
        expect(Math.abs(now.growth - was.growth)).toBeLessThanOrEqual(variety.growth)
        expect(Number.isInteger((now.growth - was.growth) / 0.25)).toBe(true)
        expect(now.debt).toBe(was.debt)
        expect(countries[id].creditors).toEqual(base[id].creditors)
      }
    }
  })

  it('moves relations by the same amount on both sides, only for pairs with a neighbour in them', () => {
    for (const { countries } of varied) {
      for (const a of Object.keys(base)) {
        for (const b of Object.keys(base)) {
          if (a === b) continue
          const change = countries[a].relations[b] - base[a].relations[b]
          expect(change).toBe(countries[b].relations[a] - base[b].relations[a])
          if (neighbours.includes(a) || neighbours.includes(b)) {
            expect(Math.abs(change)).toBeLessThanOrEqual(variety.relations)
          } else {
            expect(change).toBe(0)
          }
        }
      }
    }
  })

  it('never varies the great powers or the player', () => {
    for (const { countries } of varied) {
      for (const id of ['kessara', 'halvard', 'tsengai']) {
        expect(countries[id].stats).toEqual(base[id].stats)
        expect(countries[id].personality).toBe(base[id].personality)
      }
    }
  })

  it('really does vary: each neighbour starts at many different alignments', () => {
    for (const id of neighbours) {
      const starts = new Set(varied.map(({ countries }) => countries[id].stats.alignment))
      expect(starts.size, id).toBeGreaterThan(20)
    }
  })

  it('gives a neighbour one of the other personalities about one game in five, and says so', () => {
    // Every swap really changes the personality, with one log line for each.
    for (const { countries, texts } of varied) {
      const changed = neighbours.filter((id) => countries[id].personality !== base[id].personality)
      expect(texts).toHaveLength(changed.length)
    }
    for (const id of neighbours) {
      const swapped = varied.filter(({ countries }) => countries[id].personality !== base[id].personality)
      expect(swapped.length, id).toBeGreaterThan(8)
      expect(swapped.length, id).toBeLessThan(35)
      for (const { countries, texts } of swapped) {
        expect(['opportunist', 'hardliner', 'merchant']).toContain(countries[id].personality)
        expect(texts.some((text) => text.startsWith(`This game, ${base[id].name} is a`))).toBe(true)
      }
    }
  })
})

describe('a new game', () => {
  it('starts the neighbours the same way for the same seed, and differently for another', () => {
    expect(createGameState({ seed: 5 }).countries).toEqual(createGameState({ seed: 5 }).countries)
    expect(createGameState({ seed: 5 }).countries.valmora).not.toEqual(createGameState({ seed: 6 }).countries.valmora)
  })

  it('logs any changed personality at the start', () => {
    const game = seeds
      .map((seed) => createGameState({ seed, settings: { rivals: false, events: false } }))
      .find((state) => state.countries.ostrel.personality !== 'hardliner')!
    const now = { merchant: 'a Merchant', opportunist: 'an Opportunist' }[game.countries.ostrel.personality as string]
    expect(game.log[0]).toEqual({
      turn: 1,
      phase: 'briefing',
      text: `This game, Ostrel is ${now} rather than a Hardliner.`,
    })
    // And the other way round, for a neighbour that is usually an Opportunist.
    const valmora = seeds
      .map((seed) => createGameState({ seed, settings: { rivals: false, events: false } }))
      .find((state) => state.countries.valmora.personality !== 'opportunist')!
    expect(valmora.log.map((entry) => entry.text)).toContainEqual(expect.stringMatching(/^This game, Valmora is a (Hardliner|Merchant) rather than an Opportunist\.$/))
  })

  it('starts the neighbours as the data has them with variety switched off', () => {
    for (const seed of seeds.slice(0, 10)) {
      const game = createGameState({ seed, settings: { variety: false } })
      for (const id of neighbours) {
        expect(game.countries[id].personality).toBe(base[id].personality)
        expect(game.countries[id].stats.alignment).toBe(base[id].stats.alignment)
        expect(game.countries[id].relations).toEqual(base[id].relations)
      }
    }
  })
})
