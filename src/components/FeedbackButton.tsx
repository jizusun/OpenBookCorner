import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { submitFeedback } from '@/server/functions/feedback'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const CATEGORIES = [
  { value: 'feature_request', label: 'Feature request' },
  { value: 'book_suggestion', label: 'Book suggestion' },
  { value: 'bug', label: 'Bug report' },
  { value: 'other', label: 'Other' },
] as const

type Category = (typeof CATEGORIES)[number]['value']

/** Floating "Feedback" button + modal to collect what users want. Shown on all app pages. */
export function FeedbackButton() {
  const submitFn = useServerFn(submitFeedback)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>('feature_request')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setPending(true)
    setError(null)
    try {
      await submitFn({ data: { category, message: message.trim() } })
      setDone(true)
      setMessage('')
    } catch {
      setError('Could not send feedback. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function close() {
    setOpen(false)
    setDone(false)
    setError(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="feedback-button"
        aria-label="Send feedback"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        <span aria-hidden>💬</span> Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Send feedback"
          >
            {done ? (
              <div className="space-y-4 text-center">
                <p className="font-medium">Thanks for your feedback! 🎉</p>
                <p className="text-sm text-muted-foreground">
                  We use it to decide what to build next.
                </p>
                <Button onClick={close} className="w-full">
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="feedback-form">
                <div>
                  <h2 className="text-lg font-semibold">Send feedback</h2>
                  <p className="text-sm text-muted-foreground">
                    Tell us what you'd like — features, books to add, or problems.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fb-category">Type</Label>
                  <select
                    id="fb-category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fb-message">Your feedback</Label>
                  <textarea
                    id="fb-message"
                    className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. Please add the ability to reserve a borrowed book…"
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={pending || !message.trim()}>
                    {pending ? 'Sending…' : 'Send'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
