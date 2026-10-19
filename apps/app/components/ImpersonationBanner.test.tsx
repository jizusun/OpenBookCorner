// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImpersonationBanner } from './ImpersonationBanner'
import { I18nProvider } from '@/lib/i18n'

function renderBanner(props: Parameters<typeof ImpersonationBanner>[0]) {
  return render(
    <I18nProvider>
      <ImpersonationBanner {...props} />
    </I18nProvider>,
  )
}

describe('ImpersonationBanner', () => {
  it('renders nothing when not impersonating', () => {
    const { container } = renderBanner({ active: false, onExit: () => {} })
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a persistent banner naming the impersonated user when active', async () => {
    renderBanner({ active: true, viewingAs: '李四', onExit: () => {} })
    // role=status so screen readers announce the impersonation context. zh
    // catalog loads async, so await the exit control then assert the banner.
    expect(await screen.findByRole('button', { name: '返回我的账户' })).toBeInTheDocument()
    const banner = screen.getByRole('status')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('李四')
  })

  it('labels the exit control "Back to my account" (not "Sign out") and calls onExit', async () => {
    const onExit = vi.fn()
    renderBanner({ active: true, viewingAs: '李四', onExit })
    // zh copy for "Back to my account"
    const exit = await screen.findByRole('button', { name: '返回我的账户' })
    expect(exit).toBeInTheDocument()
    await userEvent.click(exit)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('still renders when viewingAs is unknown (falls back gracefully)', async () => {
    renderBanner({ active: true, onExit: () => {} })
    expect(await screen.findByRole('button', { name: '返回我的账户' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
