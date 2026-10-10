import type { ReactNode } from 'react'
import { useGameStore } from '../store/gameStore.ts'
import type { Tab } from './uiState.ts'
import { useUiStore } from './uiState.ts'
import { LEVELS, tabMarker } from './alertTabs.ts'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'map',
    label: 'Map',
    icon: <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15" />,
  },
  {
    id: 'economy',
    label: 'Economy',
    icon: <path d="M4 20h16 M6 16v-5 M11 16V7 M16 16v-8 M20 16V4" />,
  },
  {
    id: 'factions',
    label: 'Factions',
    icon: (
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20c0-3 2.5-5 5-5s5 2 5 5 M11 20c0-3 2.5-5 5-5s5 2 5 5" />
    ),
  },
  {
    id: 'news',
    label: 'News',
    icon: <path d="M4 5h13v14H6a2 2 0 0 1-2-2z M17 9h3v8a2 2 0 0 1-2 2 M7 9h7 M7 13h7 M7 16h4" />,
  },
  {
    id: 'log',
    label: 'Log',
    icon: <path d="M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7" />,
  },
]

/** On phones and tablets: switch between the map and the other screens. */
export function TabBar() {
  const game = useGameStore((store) => store.game)
  const tab = useUiStore((store) => store.tab)
  const setTab = useUiStore((store) => store.setTab)

  return (
    <nav className="tabbar" aria-label="Screens">
      {TABS.map((entry) => {
        const marker = tabMarker(game, entry.id)
        return (
          <button
            key={entry.id}
            type="button"
            className={entry.id === tab ? 'tab active' : 'tab'}
            aria-current={entry.id === tab ? 'page' : undefined}
            onClick={() => setTab(entry.id)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {entry.icon}
            </svg>
            <span>{entry.label}</span>
            {marker && (
              <span className={`tab-marker marker-${marker}`}>
                <span className="visually-hidden">({LEVELS[marker].label.toLowerCase()} warning)</span>
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
