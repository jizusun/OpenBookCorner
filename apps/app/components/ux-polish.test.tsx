// @vitest-environment jsdom
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog, Modal } from '@/components/ui/modal'
import { ToastProvider, useToast } from '@/components/Toast'

describe('Modal (focus is not stolen while typing)', () => {
  // Regression: the feedback dialog became untypeable because the focus-trap
  // effect depended on `onClose`, which a parent recreated on every keystroke,
  // re-running autofocus and yanking focus to the first field after each char.
  function Harness() {
    const [msg, setMsg] = useState('')
    // onClose is intentionally recreated every render (no useCallback), like the
    // original FeedbackButton. The Modal must tolerate this.
    const onClose = () => setMsg('')
    return (
      <Modal open onClose={onClose} ariaLabel="Test dialog">
        <select aria-label="type">
          <option value="a">a</option>
          <option value="b">b</option>
        </select>
        <textarea aria-label="message" value={msg} onChange={(e) => setMsg(e.target.value)} />
      </Modal>
    )
  }

  it('keeps every character typed into a textarea', async () => {
    render(<Harness />)
    const textarea = screen.getByLabelText('message') as HTMLTextAreaElement
    textarea.focus()
    await userEvent.type(textarea, 'hello world')
    expect(textarea.value).toBe('hello world')
    expect(document.activeElement).toBe(textarea)
  })
})

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Add something"
        action={<button>Do it</button>}
      />,
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Add something')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Do it' })).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('is hidden when closed and shown when open', () => {
    const { rerender } = render(
      <ConfirmDialog open={false} title="Delete?" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<ConfirmDialog open title="Delete?" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Delete?' })).toBeInTheDocument()
  })

  it('calls onConfirm and onCancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Delete this?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    await userEvent.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('closes on Escape', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open title="X" onConfirm={() => {}} onCancel={onCancel} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })
})

describe('Toast', () => {
  function Trigger() {
    const toast = useToast()
    return <button onClick={() => toast.success('Saved!')}>fire</button>
  }

  it('shows a toast and auto-dismisses it', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <Trigger />
        </ToastProvider>,
      )
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'fire' }))
      })
      expect(screen.getByText('Saved!')).toBeInTheDocument()
      // success auto-dismiss after 3500ms
      act(() => {
        vi.advanceTimersByTime(4000)
      })
      expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('useToast outside provider is a safe no-op', () => {
    // Should not throw.
    function Bare() {
      const toast = useToast()
      return <button onClick={() => toast.error('x')}>bare</button>
    }
    render(<Bare />)
    expect(() => fireEvent.click(screen.getByText('bare'))).not.toThrow()
  })
})
