// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18n } from '@lingui/core'
import { Trans } from '@lingui/react/macro'

import { I18nProvider, useLocale } from './index'
import { messages as zhMessages } from './locales/zh'

function Probe() {
  const { locale, setLocale } = useLocale()
  const userName = 'Ada'
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="title">
        <Trans>Welcome back</Trans>
      </span>
      <span data-testid="greeting">
        <Trans>Signed in as {userName}</Trans>
      </span>
      <button onClick={() => setLocale('en')}>en</button>
      <button onClick={() => setLocale('zh')}>zh</button>
    </div>
  )
}

function renderProbe() {
  return render(
    <I18nProvider>
      <Probe />
    </I18nProvider>,
  )
}

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = ''
    // Load the zh catalog + reset the shared Lingui singleton to the default
    // locale between tests so activation state doesn't leak across cases.
    // (The provider lazy-loads zh on switch; tests preload it for determinism.)
    i18n.load('zh', zhMessages)
    i18n.activate('zh')
  })
  afterEach(() => {
    cleanup()
  })

  it('defaults to Chinese', () => {
    renderProbe()
    expect(screen.getByTestId('locale')).toHaveTextContent('zh')
    expect(screen.getByTestId('title')).toHaveTextContent('欢迎回来')
  })

  it('interpolates placeholders', () => {
    renderProbe()
    expect(screen.getByTestId('greeting')).toHaveTextContent('已登录：Ada')
  })

  it('lazy-loads the English catalog when switching to en', async () => {
    renderProbe()
    await userEvent.click(screen.getByText('en'))
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('Welcome back'))
    expect(screen.getByTestId('locale')).toHaveTextContent('en')
    expect(screen.getByTestId('greeting')).toHaveTextContent('Signed in as Ada')
    expect(document.documentElement.lang).toBe('en')
  })

  it('persists the chosen locale and restores it on next mount', async () => {
    const { unmount } = renderProbe()
    await userEvent.click(screen.getByText('en'))
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('en'))
    expect(localStorage.getItem('obc-locale')).toBe('en')
    unmount()

    renderProbe()
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('Welcome back'))
  })

  it('switches back to the default (Chinese)', async () => {
    renderProbe()
    await userEvent.click(screen.getByText('en'))
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('Welcome back'))
    await userEvent.click(screen.getByText('zh'))
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('欢迎回来'))
  })
})
