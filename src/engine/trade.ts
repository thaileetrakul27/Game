// Trade deals: each lasts a set number of turns, and two countries can have
// only one in force between them. See DESIGN.md, "Economy".

import { changeStat, withLog } from './state.ts'
import type { CountryId, GameState, TradeDeal } from './types.ts'

/** The deal in force between two countries, whoever signed it, if there is one. */
export function activeDeal(state: GameState, a: CountryId, b: CountryId): TradeDeal | undefined {
  return state.tradeDeals.find(
    (deal) => (deal.signerId === a && deal.partnerId === b) || (deal.signerId === b && deal.partnerId === a),
  )
}

/** Turns a deal is still in force, counting this one. 1 means it expires at the end of this turn. */
export function dealTurnsLeft(state: GameState, deal: TradeDeal): number {
  return deal.endsOnTurn - state.turn + 1
}

export function turnsLeftPhrase(turnsLeft: number): string {
  return turnsLeft === 1 ? '1 turn left' : `${turnsLeft} turns left`
}

/** Sign a deal: both countries' growth rises until it expires. Refused while the two already have one. */
export function signTradeDeal(
  state: GameState,
  signerId: CountryId,
  partnerId: CountryId,
  terms: { turns: number; growth: number; partnerGrowth: number },
): GameState {
  const existing = activeDeal(state, signerId, partnerId)
  if (existing) {
    const signer = state.countries[signerId].name
    const partner = state.countries[partnerId].name
    throw new Error(`${signer} already has a trade deal with ${partner} until the end of turn ${existing.endsOnTurn}`)
  }
  const raised = changeStat(changeStat(state, signerId, 'growth', terms.growth), partnerId, 'growth', terms.partnerGrowth)
  const gain = (id: CountryId) => raised.countries[id].stats.growth - state.countries[id].stats.growth
  const deal: TradeDeal = {
    signerId,
    partnerId,
    endsOnTurn: state.turn + terms.turns,
    growth: gain(signerId),
    partnerGrowth: gain(partnerId),
  }
  return { ...raised, tradeDeals: [...raised.tradeDeals, deal] }
}

/** End the deals whose last turn this is, taking away the growth they added. */
export function expireTradeDeals(state: GameState): GameState {
  const ending = state.tradeDeals.filter((deal) => deal.endsOnTurn <= state.turn)
  if (ending.length === 0) return state

  let next: GameState = { ...state, tradeDeals: state.tradeDeals.filter((deal) => deal.endsOnTurn > state.turn) }
  const texts: string[] = []
  for (const deal of ending) {
    next = changeStat(changeStat(next, deal.signerId, 'growth', -deal.growth), deal.partnerId, 'growth', -deal.partnerGrowth)
    const playerSigned = deal.signerId === state.playerId
    if (playerSigned || deal.partnerId === state.playerId) {
      const other = state.countries[playerSigned ? deal.partnerId : deal.signerId].name
      const lost = playerSigned ? deal.growth : deal.partnerGrowth
      texts.push(`The trade deal with ${other} expires: growth −${lost}%.`)
    }
  }
  return withLog(next, 'resolution', texts)
}

export interface TradeDealView {
  partnerId: CountryId
  partnerName: string
  /** Whether this country signed it, rather than its partner. */
  signed: boolean
  /** The growth this country gets from the deal. */
  growth: number
  turnsLeft: number
}

/** A country's deals in force, the soonest to expire first. */
export function tradeDealsOf(state: GameState, countryId: CountryId): TradeDealView[] {
  return state.tradeDeals
    .filter((deal) => deal.signerId === countryId || deal.partnerId === countryId)
    .map((deal) => {
      const signed = deal.signerId === countryId
      const partnerId = signed ? deal.partnerId : deal.signerId
      return {
        partnerId,
        partnerName: state.countries[partnerId].name,
        signed,
        growth: signed ? deal.growth : deal.partnerGrowth,
        turnsLeft: dealTurnsLeft(state, deal),
      }
    })
    .sort((a, b) => a.turnsLeft - b.turnsLeft)
}
