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

/** Ensure a locale's catalog is loaded, then activate it. */
async function activateLocale(locale: Locale): Promise<void> {
  const load = LOADERS[locale]
  if (load) await load()
  i18n.activate(locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

/** Read the persisted locale, defaulting to Chinese (the product default). */
function readStoredLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'zh'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'en' ? 'en' : 'zh'
}

// Activate the stored (or default) locale at module load so i18n is ready before
// first render. `en` is synchronous; the default `zh` loads async and flips over
// when ready (the provider re-renders on activation).
const initialLocale = readStoredLocale()
i18n.activate('en')
if (initialLocale !== 'en') void activateLocale(initialLocale)

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
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage failures (private mode etc.)
    }
    void activateLocale(next).then(() => setLocaleState(next))
  }, [])

  return { locale, setLocale }
}
