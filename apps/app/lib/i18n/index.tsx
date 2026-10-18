import { i18n } from '@lingui/core'
import { compileMessage } from '@lingui/message-utils/compileMessage'
import { I18nProvider as LinguiProvider, useLingui } from '@lingui/react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { zh, type MessageKey, type Messages } from './zh'

// Re-export the key/type surface so consumers import from the i18n barrel
// rather than reaching into the (swappable) default-locale module.
export type { MessageKey, Messages } from './zh'

/**
 * i18n powered by LinguiJS (ICU MessageFormat runtime, ~2 kB).
 *
 * - Chinese is the DEFAULT and is bundled (loaded synchronously at module init).
 * - English is LAZY-LOADED via a dynamic `import()` the first time it's
 *   selected, so default (Chinese) users never pay for its catalog.
 * - The chosen locale is persisted in localStorage and restored on load.
 * - Messages use our explicit key namespace (e.g. `login.title`) as the Lingui
 *   message id, so call sites keep calling `t('login.title')`. Interpolation
 *   (`{name}`) and plurals go through Lingui's ICU engine.
 *
 * Usage:
 *   const { t, locale, setLocale } = useI18n()
 *   t('login.title')
 *   t('common.signedInAs', { name: user.name })
 */

export type Locale = 'en' | 'zh'

const STORAGE_KEY = 'obc-locale'

/** The translate function signature, exported for components that pass `t` around. */
export type TranslateFn = (key: MessageKey, vars?: Record<string, string | number>) => string

// Bundle the default (Chinese) catalog synchronously so first paint is correct.
// Our catalogs are plain `{ key: ICU-string }` maps (not precompiled), so we
// install Lingui's message compiler. Lingui only auto-installs it outside
// production, so this is REQUIRED for interpolation/plurals to work in the
// production build.
i18n.setMessagesCompiler(compileMessage)
i18n.load('zh', zh as Record<string, string>)

/** Lazy catalog loaders. `zh` is already bundled. */
const LOADERS: Record<Locale, (() => Promise<void>) | null> = {
  zh: null,
  en: async () => {
    const { default: en } = await import('./en')
    i18n.load('en', en as Record<string, string>)
  },
}

/** Ensure a locale's catalog is loaded, then activate it. */
async function activateLocale(locale: Locale): Promise<void> {
  const load = LOADERS[locale]
  if (load) await load()
  i18n.activate(locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

/** Read the persisted locale, defaulting to Chinese. */
function readStoredLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'zh'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'en' ? 'en' : 'zh'
}

// Activate the stored (or default) locale once at module load so i18n is ready
// before the first render. zh is synchronous; a stored `en` loads async and
// flips over when ready (the provider re-renders on activation).
const initialLocale = readStoredLocale()
i18n.activate('zh')
if (initialLocale !== 'zh') void activateLocale(initialLocale)

export function I18nProvider({ children }: { children: ReactNode }) {
  return <LinguiProvider i18n={i18n}>{children}</LinguiProvider>
}

interface I18nContextValue {
  locale: Locale
  /** Translate a key, falling back to the key when a message is missing. */
  t: TranslateFn
  /** Switch locale; lazy-loads the catalog if needed, then persists the choice. */
  setLocale: (locale: Locale) => void
}

export function useI18n(): I18nContextValue {
  // `useLingui` re-renders this hook's consumers whenever the active locale
  // changes (Lingui tracks activation), so `locale`/`t` stay in sync.
  const { i18n: active } = useLingui()
  const [locale, setLocaleState] = useState<Locale>(() => (active.locale as Locale) || 'zh')

  // Keep local state aligned with Lingui's active locale (e.g. after an async
  // English catalog finishes loading at boot).
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

  const t = useCallback<TranslateFn>(
    (key, vars) => active._(key, vars),
    [active],
  )

  return { locale, t, setLocale }
}
