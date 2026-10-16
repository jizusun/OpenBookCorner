import { useSyncExternalStore } from 'react'

/**
 * App "view mode" for admins, who can switch between the Admin view (manage the
 * library) and the Reader view (browse + borrow like a member). Readers always
 * use the reader view. Persisted in localStorage so it survives reloads.
 */
export type ViewMode = 'system' | 'admin' | 'reader'

const STORAGE_KEY = 'obc-view'
const listeners = new Set<() => void>()

function read(): ViewMode {
  if (typeof localStorage === 'undefined') return 'admin'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'reader' || v === 'system' ? v : 'admin'
}

export function setViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore storage failures
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Current admin view mode. Only meaningful for admins. */
export function useViewMode(): ViewMode {
  return useSyncExternalStore(subscribe, read, () => 'admin')
}
