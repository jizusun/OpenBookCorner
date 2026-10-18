import { useState } from 'react'
import { trpcClient } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/lib/i18n'

const CATEGORIES = [
  { value: 'feature_request', labelKey: 'feedback.category.feature_request' },
  { value: 'book_suggestion', labelKey: 'feedback.category.book_suggestion' },
  { value: 'bug', labelKey: 'feedback.category.bug' },
  { value: 'other', labelKey: 'feedback.category.other' },
] as const

type Category = (typeof CATEGORIES)[number]['value']

/** Floating "Feedback" button + accessible modal to collect what users want. */
export function FeedbackButton() {
  const toast = useToast()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>('feature_request')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setPending(true)
    setError(null)
    try {
      await trpcClient.feedback.submit.mutate({ category, message: message.trim() })
      setMessage('')
      setOpen(false)
      toast.success(t('feedback.thanksToast'))
    } catch {
      setError(t('feedback.error'))
    } finally {
      setPending(false)
    }
  }

  function close() {
    setOpen(false)
    setError(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="feedback-button"
        aria-label={t('feedback.send')}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        <span aria-hidden>💬</span> {t('feedback.button')}
      </button>

      <Modal open={open} onClose={close} ariaLabel={t('feedback.send')}>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="feedback-form">
          <div>
            <h2 className="text-lg font-semibold">{t('feedback.send')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('feedback.intro')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-category">{t('feedback.type')}</Label>
            <select
              id="fb-category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-message">{t('feedback.message')}</Label>
            <textarea
              id="fb-message"
              className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('feedback.messagePlaceholder')}
              aria-describedby={error ? 'fb-error' : undefined}
              aria-invalid={error ? true : undefined}
              required
            />
          </div>
          {error && (
            <p id="fb-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !message.trim()}>
              {pending ? t('feedback.sending') : t('feedback.submit')}
            </Button>
            <Button type="button" variant="ghost" onClick={close}>
              {t('feedback.cancel')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
