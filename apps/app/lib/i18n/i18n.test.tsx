// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider, useI18n } from './index'

function Probe() {
  const { t, locale, setLocale } = useI18n()
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="title">{t('login.title')}</span>
      <span data-testid="greeting">{t('common.signedInAs', { name: 'Ada' })}</span>
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

  it('lazy-loads the English dictionary when switching to en', async () => {
    renderProbe()
    await userEvent.click(screen.getByText('en'))
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('Welcome back'))
    expect(screen.getByTestId('locale')).toHaveTextContent('en')
    // Interpolation still works in the loaded locale.
    expect(screen.getByTestId('greeting')).toHaveTextContent('Signed in as Ada')
    // The <html lang> attribute tracks the active locale.
    expect(document.documentElement.lang).toBe('en')
  })

  it('persists the chosen locale and restores it on next mount', async () => {
    const { unmount } = renderProbe()
    await userEvent.click(screen.getByText('en'))
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('en'))
    expect(localStorage.getItem('obc-locale')).toBe('en')
    unmount()

    // Fresh mount should restore en from storage and lazy-load it again.
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
