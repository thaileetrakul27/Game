// Plays seeded games with a passive player and prints the rival balance
// measures from DESIGN.md, "Testing and balancing": how the four neighbours
// end up split between the two powers, and how far the passive player's
// legitimacy falls. Run it with `npm run simulate`, optionally giving the
// number of games: `npm run simulate -- 20`.

import { advanceTurn, createGameState, createRng, GAME_DATA, getAction, MAX_TURNS } from '../src/engine/index.ts'
import type { GameState, PlayerTurn, Rng } from '../src/engine/index.ts'

const NEIGHBOURS = ['valmora', 'ostrel', 'sabu', 'daranth']
/** Legitimacy must not fall below this before LEGITIMACY_TURN. */
const LEGITIMACY_FLOOR = 20
const LEGITIMACY_TURN = 30

/**
 * A passive player: no actions, a random response to each crisis card, and
 * a refusal of every demand and offer. Its randomness comes from its own
 * seeded generator, so the game's own stays exactly as the engine leaves it.
 */
function passiveTurn(state: GameState, rng: Rng): PlayerTurn {
  return {
    crisisResponse: state.crisis ? rng.pick(state.crisis.responseIds) : null,
    demandResponse: state.demand ? 'refuse' : null,
    offerResponse: state.offer ? 'decline' : null,
    actions: [],
  }
}

interface GameResult {
  seed: number
  alignments: Record<string, number>
  /** Neighbours whose personality the seed changed for this game. */
  swapped: string[]
  /** Lowest legitimacy at the start of any turn up to LEGITIMACY_TURN. */
  lowestEarlyLegitimacy: number
  legitimacyAtTurn: number
  /** The first turn that starts with legitimacy below the floor, if any. */
  firstBelowFloor: number | null
  finalLegitimacy: number
  covertOpsOnPlayer: number
  packages: { offered: number; accepted: number }
}

function playGame(seed: number): GameResult {
  let state = createGameState({ seed })
  const usual = (id: string) => GAME_DATA.countries.find((country) => country.id === id)?.personality
  const swapped = NEIGHBOURS.filter((id) => state.countries[id].personality !== usual(id))
  const player = createRng(seed + 1_000_003)
  let lowestEarlyLegitimacy = state.countries[state.playerId].stats.legitimacy
  let legitimacyAtTurn = lowestEarlyLegitimacy
  let firstBelowFloor: number | null = null
  while (state.status === 'playing') {
    state = advanceTurn(state, passiveTurn(state, player))
    const legitimacy = state.countries[state.playerId].stats.legitimacy
    if (state.turn <= LEGITIMACY_TURN && state.status === 'playing') {
      lowestEarlyLegitimacy = Math.min(lowestEarlyLegitimacy, legitimacy)
      if (state.turn === LEGITIMACY_TURN) legitimacyAtTurn = legitimacy
    }
    if (firstBelowFloor === null && legitimacy < LEGITIMACY_FLOOR && state.status === 'playing') firstBelowFloor = state.turn
  }
  const rivalLines = state.log.filter((entry) => entry.phase === 'rivals').map((entry) => entry.text)
  return {
    seed,
    alignments: Object.fromEntries(NEIGHBOURS.map((id) => [id, state.countries[id].stats.alignment])),
    swapped,
    lowestEarlyLegitimacy,
    legitimacyAtTurn,
    firstBelowFloor,
    finalLegitimacy: state.countries[state.playerId].stats.legitimacy,
    covertOpsOnPlayer: rivalLines.filter((text) => text.endsWith('Covert operation (Kessara).')).length,
    packages: {
      offered: rivalLines.filter((text) => text.startsWith('Halvard Compact: Offer investment package')).length,
      accepted: rivalLines.filter((text) => text.endsWith(' accepts.')).length,
    },
  }
}

/**
 * Replay a game with no covert operations at all, to tell what the rivals
 * did from what unlucky crisis answers did. The action is closed to every
 * country for the replay only.
 */
function lowestWithoutCovertOperations(seed: number): number {
  const covert = getAction('covertOperation')
  const actor = covert.actor
  covert.actor = { kind: 'nobody' as never }
  try {
    return playGame(seed).lowestEarlyLegitimacy
  } finally {
    covert.actor = actor
  }
}

const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

const games = Number(process.argv[2] ?? 100)
const started = performance.now()
const results = Array.from({ length: games }, (_, index) => playGame(index + 1))
const seconds = ((performance.now() - started) / 1000).toFixed(1)

console.log(`${games} games with a passive player, ${MAX_TURNS} turns each (${seconds}s)\n`)

/** "Halvard 83%  Tsengai 14%  even 3%" for a list of end alignments. */
function sides(values: number[]): string {
  const halvard = values.filter((value) => value > 0).length
  const tsengai = values.filter((value) => value < 0).length
  const even = values.length - halvard - tsengai
  return `Halvard ${percent(halvard, values.length).padStart(4)}  Tsengai ${percent(tsengai, values.length).padStart(4)}  even ${percent(even, values.length).padStart(3)}`
}

console.log('Which side each neighbour ends on')
for (const id of NEIGHBOURS) {
  const values = results.map((result) => result.alignments[id])
  const mean = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  const swaps = results.filter((result) => result.swapped.includes(id)).length
  console.log(`  ${id.padEnd(9)}${sides(values)}  mean ${String(mean).padStart(4)}  (other personality in ${swaps} games)`)
}
console.log(`  ${'All four'.padEnd(9)}${sides(results.flatMap((result) => Object.values(result.alignments)))}`)

console.log('\nGames by how many neighbours end leaning toward Halvard and toward Tsengai')
const splits = new Map<string, number>()
const majority = { halvard: 0, tsengai: 0, even: 0 }
for (const result of results) {
  const values = Object.values(result.alignments)
  const halvard = values.filter((value) => value > 0).length
  const tsengai = values.filter((value) => value < 0).length
  const key = `${halvard}–${tsengai}`
  splits.set(key, (splits.get(key) ?? 0) + 1)
  majority[halvard > tsengai ? 'halvard' : halvard < tsengai ? 'tsengai' : 'even'] += 1
}
const ordered = [...splits.entries()].sort((a, b) => b[0].localeCompare(a[0]))
console.log(`  ${ordered.map(([split, count]) => `${split}: ${count}`).join('   ')}`)
console.log(`  Halvard ahead in ${majority.halvard} games, Tsengai ahead in ${majority.tsengai}, level in ${majority.even}`)

console.log(`\nPassive player's legitimacy (starts at 50)`)
const early = results.map((result) => result.lowestEarlyLegitimacy)
console.log(`  Lowest up to turn ${LEGITIMACY_TURN}: worst ${Math.min(...early)}, median ${median(early)}`)
console.log(`  At turn ${LEGITIMACY_TURN}: median ${median(results.map((result) => result.legitimacyAtTurn))}`)
const fellEarly = results.filter((result) => result.lowestEarlyLegitimacy < LEGITIMACY_FLOOR)
const byLuckAlone = fellEarly.filter((result) => lowestWithoutCovertOperations(result.seed) < LEGITIMACY_FLOOR)
const byRivals = fellEarly.filter((result) => !byLuckAlone.includes(result))
const seedList = (list: GameResult[]) =>
  list.length === 0 ? '' : ` (${list.length === 1 ? 'seed' : 'seeds'} ${list.map((result) => result.seed).join(', ')})`
console.log(`  Below ${LEGITIMACY_FLOOR} before turn ${LEGITIMACY_TURN} because of the rivals: ${byRivals.length}${seedList(byRivals)}`)
console.log(`  Below ${LEGITIMACY_FLOOR} before turn ${LEGITIMACY_TURN} from crisis answers alone, even with no covert operations: ${byLuckAlone.length}${seedList(byLuckAlone)}`)
const final = results.map((result) => result.finalLegitimacy)
console.log(`  At the end: median ${median(final)}, below ${LEGITIMACY_FLOOR} in ${percent(final.filter((value) => value < LEGITIMACY_FLOOR).length, games)} of games`)
const fell = results.flatMap((result) => (result.firstBelowFloor === null ? [] : [result.firstBelowFloor]))
if (fell.length > 0) console.log(`  Turn it first falls below ${LEGITIMACY_FLOOR}, in games where it does: median ${median(fell)}`)
console.log(`  Covert operations against the player per game: median ${median(results.map((result) => result.covertOpsOnPlayer))}`)

const offered = results.reduce((sum, result) => sum + result.packages.offered, 0)
const accepted = results.reduce((sum, result) => sum + result.packages.accepted, 0)
console.log(`\nHalvard's investment packages per game: ${(offered / games).toFixed(1)} offered, ${(accepted / games).toFixed(1)} accepted by neighbours`)
