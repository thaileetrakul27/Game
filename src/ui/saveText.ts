import { MAX_TURNS, quarterLabel } from '../engine/index.ts'
import type { SaveRecord, SlotId } from '../store/saves.ts'

const SLOT_NAMES: Record<SlotId, string> = {
  auto: 'Autosave',
  'slot-1': 'Slot 1',
  'slot-2': 'Slot 2',
  'slot-3': 'Slot 3',
}

export const slotName = (slot: SlotId) => SLOT_NAMES[slot]

/** When a game was saved, as the player's device writes dates. */
export function savedWhen(savedAt: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(savedAt)
}

/** Where a saved game had got to: the quarter, or how it ended. */
export function saveHeadline(record: SaveRecord): string {
  const { game } = record
  if (game.status === 'ended') return `Game over, ${quarterLabel(game.turn)}`
  return `${quarterLabel(game.turn)}, turn ${game.turn} of ${MAX_TURNS}`
}
