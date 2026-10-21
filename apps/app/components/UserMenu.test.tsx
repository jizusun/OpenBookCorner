// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { I18nProvider } from '@/lib/i18n'
import { UserMenu, type UserMenuProps } from './UserMenu'

function renderMenu(props: Partial<UserMenuProps> = {}) {
  const full: UserMenuProps = {
    userName: 'Ada Lovelace',
    onLogout: vi.fn(),
    canInstall: false,
    onInstall: vi.fn(),
    ...props,
  }
  const rootRoute = createRootRoute({
    component: () => (
      <I18nProvider>
        <UserMenu {...full} />
      </I18nProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  return full
}

describe('UserMenu', () => {
  it('shows an avatar trigger with the user initials', async () => {
    renderMenu({ userName: 'Ada Lovelace' })
    const trigger = await screen.findByTestId('user-menu')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('AL')
  })

  it('opens to reveal a profile link and fires logout', async () => {
    const props = renderMenu()
    await userEvent.click(await screen.findByTestId('user-menu'))
    expect(await screen.findByTestId('profile-link')).toBeInTheDocument()
    await userEvent.click(await screen.findByTestId('logout'))
    expect(props.onLogout).toHaveBeenCalledTimes(1)
  })

  it('hides the install item unless install is available', async () => {
    renderMenu({ canInstall: false })
    await userEvent.click(await screen.findByTestId('user-menu'))
    expect(await screen.findByTestId('logout')).toBeInTheDocument()
    expect(screen.queryByTestId('install-button')).toBeNull()
  })

  it('shows the install item when install is available', async () => {
    const props = renderMenu({ canInstall: true })
    await userEvent.click(await screen.findByTestId('user-menu'))
    await userEvent.click(await screen.findByTestId('install-button'))
    expect(props.onInstall).toHaveBeenCalledTimes(1)
  })
})
