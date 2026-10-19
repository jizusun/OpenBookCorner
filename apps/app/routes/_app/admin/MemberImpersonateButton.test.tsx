// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/lib/i18n'
import { MemberImpersonateButton } from './MemberImpersonateButton'

const impersonateUser = vi.fn(async () => ({}))
const navigate = vi.fn(async () => {})
const clear = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  authClient: { admin: { impersonateUser: (a: { userId: string }) => impersonateUser(a) } },
}))

beforeEach(() => {
  impersonateUser.mockClear()
  navigate.mockClear()
  clear.mockClear()
})

function renderBtn(props: Parameters<typeof MemberImpersonateButton>[0]) {
  return render(
    <I18nProvider>
      <MemberImpersonateButton {...props} />
    </I18nProvider>,
  )
}

describe('MemberImpersonateButton (least-privilege)', () => {
  const base = {
    viewerRole: 'super_admin',
    viewerId: 'super-1',
    onImpersonated: navigate,
    clearCache: clear,
  }

  it('renders for a super admin when the member has a linked user account', async () => {
    renderBtn({ ...base, memberUserId: 'reader-9' })
    expect(await screen.findByRole('button', { name: '以其身份登录' })).toBeInTheDocument()
  })

  it('renders nothing for a library_admin (least privilege)', () => {
    const { container } = renderBtn({ ...base, viewerRole: 'library_admin', memberUserId: 'reader-9' })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the member has no linked user account', () => {
    const { container } = renderBtn({ ...base, memberUserId: null })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the target is the viewer themselves', () => {
    const { container } = renderBtn({ ...base, memberUserId: 'super-1' })
    expect(container).toBeEmptyDOMElement()
  })

  it('impersonates then navigates + clears cache on click', async () => {
    renderBtn({ ...base, memberUserId: 'reader-9' })
    await userEvent.click(await screen.findByRole('button', { name: '以其身份登录' }))
    expect(impersonateUser).toHaveBeenCalledWith({ userId: 'reader-9' })
    expect(clear).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})
