import { useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/lib/i18n'

/**
 * Toggle between English and 中文. Selecting 中文 lazy-loads the Chinese catalog
 * on demand. The choice is persisted (see useLocale / I18nProvider).
 */
export function LanguageToggle() {
  const { t } = useLingui()
  const { locale, setLocale } = useLocale()
  const next = locale === 'en' ? 'zh' : 'en'
  // Show the language you'd switch TO, so the control reads as an action.
  const label = next === 'zh' ? '中文' : 'English'

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setLocale(next)}
      aria-label={t`Switch language`}
      title={t`Switch language`}
      data-testid="language-toggle"
    >
      <span aria-hidden>{label}</span>
    </Button>
  )
}
