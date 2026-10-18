import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { zh, type MessageKey, type Messages } from './zh'

// Re-export the key/type surface so consumers import from the i18n barrel
// rather than reaching into the (swappable) default-locale module.
export type { MessageKey, Messages } from './zh'

/**
 * Minimal, dependency-free i18n.
 *
 * - Chinese is the DEFAULT and is bundled (it's the fallback dictionary).
 * - English (and any future locale) is LAZY-LOADED via dynamic `import()` the
 *   first time it's selected, so default (Chinese) users never pay for it.
 * - The chosen locale is persisted in localStorage and restored on load.
 *
 * Usage:
 *   const { t, locale, setLocale } = useI18n()
 *   t('login.title')
 *   t('common.signedInAs', { name: user.name })
 */

export type Locale = 'en' | 'zh'

const STORAGE_KEY = 'obc-locale'

/** Lazy loaders per locale. `zh` is already bundled, so it's synchronous. */
const LOADERS: Record<Locale, () => Promise<Partial<Messages>>> = {
  zh: () => Promise.resolve(zh),
  en: () => import('./en').then((m) => m.default),
}

/** Read the persisted locale, defaulting to Chinese. */
function readStoredLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'zh'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'en' ? 'en' : 'zh'
}

/** Interpolate `{name}`-style placeholders. */
function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}

interface I18nContextValue {
  locale: Locale
  /** Translate a key, falling back to the default (Chinese) string if the locale lacks it. */
  t: TranslateFn
  /** Switch locale; lazy-loads the dictionary if needed. */
  setLocale: (locale: Locale) => void
}

/** The translate function signature, exported for components that pass `t` around. */
export type TranslateFn = (key: MessageKey, vars?: Record<string, string | number>) => string

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)
  // Messages for the active locale. Starts as Chinese (always available); when a
  // non-default locale is active we merge its lazily-loaded dictionary on top.
  const [messages, setMessages] = useState<Partial<Messages>>(zh)

  // Load the active locale's dictionary (restores a persisted en choice on boot).
  useEffect(() => {
    let cancelled = false
    if (locale === 'zh') {
      setMessages(zh)
      document.documentElement.lang = 'zh'
      return
    }
    LOADERS[locale]().then((dict) => {
      if (cancelled) return
      setMessages(dict)
      document.documentElement.lang = locale
    })
    return () => {
      cancelled = true
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage failures (private mode etc.)
    }
    setLocaleState(next)
  }, [])

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      // Fall back to the bundled default (Chinese) when the active (lazy)
      // dictionary lacks the key.
      const template = messages[key] ?? zh[key]
      return format(template, vars)
    },
    [messages],
  )

  return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}
