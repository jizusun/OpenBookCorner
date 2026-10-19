import { useSyncExternalStore } from 'react'

/**
 * "Reader preview" toggle for LIBRARY ADMINS only.
 *
 * The app surface is determined by ROLE (reader → reader UI, library_admin →
 * admin UI, super_admin → system console) — there is no three-state view switch.
 * A library admin may optionally flip a secondary "Reader preview" to browse the
 * catalog as a member would (borrow buttons instead of manage controls). Readers
 * and super admins ignore this flag (super admins use impersonation to view as
 * someone else). Persisted in localStorage so it survives reloads.
 */
const STORAGE_KEY = 'obc-reader-preview'
const listeners = new Set<() => void>()

function read(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export function setReaderPreview(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // ignore storage failures
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Whether the library admin has turned on Reader preview. */
export function useReaderPreview(): boolean {
  return useSyncExternalStore(subscribe, read, () => false)
}
