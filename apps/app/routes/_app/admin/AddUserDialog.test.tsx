// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/lib/i18n'
import { AddUserDialog } from './AddUserDialog'

function renderDialog(props: Partial<Parameters<typeof AddUserDialog>[0]> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn(async () => {})
  const onClose = props.onClose ?? vi.fn()
  render(
    <I18nProvider>
      <AddUserDialog
        open
        title="添加管理员"
        pending={false}
        onSubmit={onSubmit}
        onClose={onClose}
        {...props}
      />
    </I18nProvider>,
  )
  return { onSubmit, onClose }
}

describe('AddUserDialog', () => {
  it('renders the dialog with email/name/password fields', () => {
    renderDialog()
    expect(screen.getByTestId('add-user-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('add-user-email')).toBeInTheDocument()
    expect(screen.getByTestId('add-user-name')).toBeInTheDocument()
    expect(screen.getByTestId('add-user-password')).toBeInTheDocument()
  })

  it('submits the entered values', async () => {
    const { onSubmit } = renderDialog()
    await userEvent.type(screen.getByTestId('add-user-email'), 'a@b.com')
    await userEvent.type(screen.getByTestId('add-user-name'), 'Alice')
    await userEvent.type(screen.getByTestId('add-user-password'), 'password123')
    await userEvent.click(screen.getByTestId('add-user-submit'))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com', name: 'Alice', password: 'password123' })
  })

  it('does not submit when required fields are empty', async () => {
    const { onSubmit } = renderDialog()
    await userEvent.click(screen.getByTestId('add-user-submit'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    const onSubmit = vi.fn()
    render(
      <I18nProvider>
        <AddUserDialog open={false} title="x" pending={false} onSubmit={onSubmit} onClose={() => {}} />
      </I18nProvider>,
    )
    expect(screen.queryByTestId('add-user-dialog')).toBeNull()
  })
})
