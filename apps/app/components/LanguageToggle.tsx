import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

/**
 * Toggle between English (default) and 中文. Selecting 中文 lazy-loads the
 * Chinese dictionary on demand. The choice is persisted (see I18nProvider).
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()
  const next = locale === 'en' ? 'zh' : 'en'
  // Show the language you'd switch TO, so the control reads as an action.
  const label = next === 'zh' ? t('lang.zh') : t('lang.en')

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setLocale(next)}
      aria-label={t('lang.toggle')}
      title={t('lang.toggle')}
      data-testid="language-toggle"
    >
      <span aria-hidden>{label}</span>
    </Button>
  )
}
