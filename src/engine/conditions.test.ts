import { describe, expect, it } from 'vitest'
import { builtProjects, countryConditions, GAME_DATA } from './index.ts'
import type { Country, CountryId, GameState } from './index.ts'
import { quietGame } from './testHelpers.ts'

const start = quietGame()
const levels = GAME_DATA.conditions
const ids = (state: GameState, id: CountryId) => countryConditions(state, id).map((condition) => condition.id)

/** Change one country, to set up a test. */
function patch(state: GameState, id: CountryId, change: (country: Country) => Partial<Country>): GameState {
  const country = state.countries[id]
  return { ...state, countries: { ...state.countries, [id]: { ...country, ...change(country) } } }
}
const withStats = (state: GameState, id: CountryId, stats: Partial<Country['stats']>) =>
  patch(state, id, (country) => ({ stats: { ...country.stats, ...stats } }))

describe('country conditions', () => {
  it('mark nothing on a calm country', () => {
    expect(ids(start, 'valmora')).toEqual([])
  })

  it('mark unrest below the legitimacy level, and for the player a faction in unrest too', () => {
    const level = levels.unrestLegitimacyBelow
    expect(ids(withStats(start, 'valmora', { legitimacy: level - 1 }), 'valmora')).toContain('unrest')
    expect(ids(withStats(start, 'valmora', { legitimacy: level }), 'valmora')).not.toContain('unrest')
    const restless = { ...start, factions: { ...start.factions, reformers: GAME_DATA.factions.unrestBelow - 1 } }
    const unrest = countryConditions(restless, 'kessara').find((condition) => condition.id === 'unrest')
    expect(unrest?.text).toMatch(/^Reformers in unrest/)
  })

  it('mark a country fortified or booming at their levels', () => {
    expect(ids(withStats(start, 'valmora', { defence: levels.fortifiedDefenceAtLeast }), 'valmora')).toEqual(['fortified'])
    expect(ids(withStats(start, 'valmora', { defence: levels.fortifiedDefenceAtLeast - 1 }), 'valmora')).toEqual([])
    expect(ids(withStats(start, 'valmora', { growth: levels.boomingGrowthAtLeast }), 'valmora')).toEqual(['booming'])
  })

  it('mark a neighbour past the demand line as its patron’s client, but never a great power', () => {
    const past = GAME_DATA.hedging.demandPast + 1
    const client = countryConditions(withStats(start, 'valmora', { alignment: -past }), 'valmora')
    expect(client).toContainEqual(expect.objectContaining({ id: 'client', name: "Tsengai Republic's client", otherId: 'tsengai' }))
    expect(ids(withStats(start, 'valmora', { alignment: past - 1 }), 'valmora')).not.toContain('client')
    expect(ids(start, 'halvard')).not.toContain('client')
    expect(ids(withStats(start, 'kessara', { alignment: past }), 'kessara')).toContain('client')
  })

  it('mark a country hostile by the player’s relations with it', () => {
    const hostile = patch(start, 'kessara', (kessara) => ({
      relations: { ...kessara.relations, sabu: levels.hostileRelationsAtMost },
    }))
    expect(countryConditions(hostile, 'sabu')).toContainEqual(expect.objectContaining({ id: 'hostile', name: 'Hostile to Kessara' }))
    expect(ids(hostile, 'kessara')).not.toContain('hostile')
  })

  it('mark a trade partner of the player', () => {
    const deal = { signerId: 'kessara', partnerId: 'valmora', endsOnTurn: 8, growth: 0.5, partnerGrowth: 0.25 }
    const trading = { ...start, tradeDeals: [deal] }
    expect(countryConditions(trading, 'valmora')).toContainEqual(expect.objectContaining({ id: 'trading', otherId: 'kessara' }))
    expect(ids(trading, 'kessara')).not.toContain('trading')
  })

  it('mark the country this quarter’s crisis concerns, or the player when it concerns no one else', () => {
    const card = GAME_DATA.events[0]
    const about = (targetId: CountryId | null) => ({ ...start, crisis: { cardId: card.id, responseIds: [], targetId } })
    expect(ids(about('daranth'), 'daranth')).toEqual(['crisis'])
    expect(ids(about('daranth'), 'kessara')).toEqual([])
    expect(ids(about(null), 'kessara')).toEqual(['crisis'])
  })

  it('mark building while a project is under way, and keep finished ones on the map', () => {
    const building = patch(start, 'ostrel', () => ({
      projects: [
        { projectId: 'rail', completesOnTurn: start.turn + 2 },
        { projectId: 'port', completesOnTurn: start.turn - 1 },
      ],
    }))
    const marks = countryConditions(building, 'ostrel')
    expect(marks.find((condition) => condition.id === 'building')?.text).toMatch(/^Rail network under way/)
    expect(builtProjects(building, 'ostrel')).toEqual(['port'])
  })

  it('list the most pressing first', () => {
    const many = withStats(
      { ...start, crisis: { cardId: GAME_DATA.events[0].id, responseIds: [], targetId: 'valmora' } },
      'valmora',
      { legitimacy: 0, defence: 100, growth: 9 },
    )
    expect(ids(many, 'valmora')).toEqual(['crisis', 'unrest', 'fortified', 'booming'])
  })
})
