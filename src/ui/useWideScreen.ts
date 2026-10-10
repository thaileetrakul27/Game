import { useSyncExternalStore } from 'react'

/** Wide screens show Economy, Factions, News and Log as side panels; narrower ones use a tab bar. */
const QUERY = '(min-width: 1100px)'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
}
