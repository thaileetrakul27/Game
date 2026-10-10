import { tradeDealsOf, turnsLeftPhrase } from '../../engine/index.ts'
import type { CountryId } from '../../engine/index.ts'
import { useGameStore } from '../../store/gameStore.ts'
import { percent } from '../format.ts'

/** A country's trade deals in force, with the growth each adds and the turns it has left. */
export function TradeDeals({ countryId }: { countryId: CountryId }) {
  const game = useGameStore((store) => store.game)
  const deals = tradeDealsOf(game, countryId)

  if (deals.length === 0) return <p className="muted">No trade deals in force. Sign one from a country's file.</p>
  return (
    <table className="figures deals">
      <thead>
        <tr>
          <th scope="col">Partner</th>
          <th scope="col">Growth</th>
          <th scope="col">Left</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((deal) => (
          <tr key={deal.partnerId} title={deal.signed ? 'You signed it' : `${deal.partnerName} signed it`}>
            <th scope="row">{deal.partnerName}</th>
            <td>+{percent(deal.growth)}</td>
            <td>{turnsLeftPhrase(deal.turnsLeft)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
