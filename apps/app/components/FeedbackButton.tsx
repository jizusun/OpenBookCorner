import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/Toast'

const CATEGORIES = [
  { value: 'feature_request' },
  { value: 'book_suggestion' },
  { value: 'bug' },
  { value: 'other' },
] as const

type Category = (typeof CATEGORIES)[number]['value']

/** Floating "Feedback" button + accessible modal to collect what users want. */
export function FeedbackButton() {
  const toast = useToast()
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>('feature_request')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // `<option>` children must be plain text, so category labels are produced as
  // strings via the `t` macro rather than <Trans> elements.
  function categoryLabel(value: Category): string {
    switch (value) {
      case 'feature_request':
        return t`Feature request`
      case 'book_suggestion':
        return t`Book suggestion`
      case 'bug':
        return t`Bug report`
      case 'other':
        return t`Other`
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setPending(true)
    setError(null)
    try {
      await api.feedback.submit.mutate({ category, message: message.trim() })
      setMessage('')
      setOpen(false)
      toast.success(t`Thanks for your feedback! 🎉`)
    } catch {
      setError(t`Could not send feedback. Please try again.`)
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
        aria-label={t`Send feedback`}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        <span aria-hidden>💬</span> <Trans>Feedback</Trans>
      </button>

      <Modal open={open} onClose={close} ariaLabel={t`Send feedback`}>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="feedback-form">
          <div>
            <h2 className="text-lg font-semibold"><Trans>Send feedback</Trans></h2>
            <p className="text-sm text-muted-foreground">
              <Trans>Tell us what you’d like — features, books to add, or problems.</Trans>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-category"><Trans>Type</Trans></Label>
            <select
              id="fb-category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {categoryLabel(c.value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-message"><Trans>Your feedback</Trans></Label>
            <textarea
              id="fb-message"
              className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t`e.g. Please add the ability to reserve a borrowed book…`}
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
              {pending ? <Trans>Sending…</Trans> : <Trans>Send</Trans>}
            </Button>
            <Button type="button" variant="ghost" onClick={close}>
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
