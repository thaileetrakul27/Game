import type { SaveSlot } from '../store/saves.ts'
import { money, signed } from './format.ts'
import { savedWhen, saveHeadline } from './saveText.ts'

/** What is in a save slot, for the lists on the title screen and in the menu. */
export function SaveDetails({ slot }: { slot: SaveSlot }) {
  if (slot.state === 'empty') return <span className="save-details muted-line">Empty</span>
  if (slot.state === 'unusable') {
    return <span className="save-details muted-line">From another version of the game, so it can't be loaded.</span>
  }
  const { game, savedAt } = slot.record
  const { stats } = game.countries[game.playerId]
  return (
    <span className="save-details">
      <span className="save-headline">{saveHeadline(slot.record)}</span>
      <span className="save-stats">
        Treasury {money(stats.treasury)}, legitimacy {stats.legitimacy}, alignment {signed(stats.alignment)}
      </span>
      <span className="save-when">Saved {savedWhen(savedAt)}</span>
    </span>
  )
}
