import { i18n } from '@lingui/core'
import { I18nProvider as LinguiProvider, useLingui } from '@lingui/react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

/**
 * i18n via LinguiJS — macro + extract/compile workflow.
 *
 * - SOURCE locale is `en`: UI text is authored inline with Lingui macros
 *   (`<Trans>…</Trans>`, `` t`…` ``). `lingui extract` collects messages into
 *   PO catalogs (lib/i18n/locales/{en,zh}.po); `lingui compile` emits the
 *   runtime catalogs imported below.
 * - English is bundled (it's the source/base). Chinese is LAZY-LOADED via a
 *   dynamic `import()` of its compiled catalog the first time it's selected.
 * - The chosen locale is persisted in localStorage and restored on load.
 *
 * For UI text use the macros directly (`<Trans>` / `useLingui().t`). This module
 * only owns provider setup + locale switching/persistence.
 */

import { messages as enMessages } from './locales/en'

export type Locale = 'en' | 'zh'

const STORAGE_KEY = 'obc-locale'

// Bundle the source (English) catalog synchronously so first paint is correct.
i18n.load('en', enMessages)

/** Lazy catalog loaders. `en` is the bundled source. */
const LOADERS: Record<Locale, (() => Promise<void>) | null> = {
  en: null,
  zh: async () => {
    const { messages } = await import('./locales/zh')
    i18n.load('zh', messages)
  },
}

// Tracks the most recently REQUESTED locale so a slow startup/default load can't
// clobber a newer user selection (race guard).
let requestedLocale: Locale = 'en'

/**
 * Ensure a locale's catalog is loaded, then activate it — but only if it's still
 * the latest requested locale when the (async) load resolves. Returns the locale
 * that ended up active so callers can sync their state. Throws if the catalog
 * chunk fails to load (caller decides how to recover).
 */
async function activateLocale(locale: Locale): Promise<Locale> {
  requestedLocale = locale
  const load = LOADERS[locale]
  if (load) await load()
  // A newer selection arrived while this catalog was loading — abandon this one.
  if (requestedLocale !== locale) return i18n.locale as Locale
  i18n.activate(locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
  return locale
}

/** Read the persisted locale, defaulting to Chinese (the product default). */
function readStoredLocale(): Locale {
  // `localStorage` access can THROW (not just be undefined) when storage is
  // blocked by browser policy — must be guarded or it breaks first render.
  try {
    if (typeof localStorage === 'undefined') return 'zh'
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

// Activate the stored (or default) locale at module load so i18n is ready before
// first render. `en` is synchronous; the default `zh` loads async and flips over
// when ready (the provider re-renders on activation). A failed catalog load
// leaves the bundled English active rather than crashing.
const initialLocale = readStoredLocale()
i18n.activate('en')
requestedLocale = initialLocale
if (initialLocale !== 'en') {
  void activateLocale(initialLocale).catch((err) => {
    console.error('i18n: failed to load initial catalog', initialLocale, err)
  })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  return <LinguiProvider i18n={i18n}>{children}</LinguiProvider>
}

/**
 * Locale controller for the language toggle + anything that needs the active
 * locale. For translating UI TEXT, prefer the Lingui macros directly
 * (`<Trans>`, `useLingui().t`), not this hook.
 */
export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void } {
  const { i18n: active } = useLingui()
  const [locale, setLocaleState] = useState<Locale>(() => (active.locale as Locale) || 'zh')

  useEffect(() => {
    if (active.locale && active.locale !== locale) setLocaleState(active.locale as Locale)
  }, [active.locale, locale])

  const setLocale = useCallback((next: Locale) => {
    // Activate first; only persist once the catalog actually loaded, so a failed
    // chunk load doesn't leave a stored locale we can't render.
    activateLocale(next)
      .then((applied) => {
        setLocaleState(applied)
        if (applied === next) {
          try {
            localStorage.setItem(STORAGE_KEY, next)
          } catch {
            // ignore storage failures (private mode / blocked storage)
          }
        }
      })
      .catch((err) => {
        console.error('i18n: failed to switch locale', next, err)
        // Keep the current locale active; nothing persisted.
      })
  }, [])

  return { locale, setLocale }
}
