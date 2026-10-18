// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { BookCard, type BookCardBook } from './BookCard'
import { I18nProvider } from '@/lib/i18n'

const availableBook: BookCardBook = {
  id: '1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  isbn: '9780132350884',
  isAvailable: true,
  publisher: 'Prentice Hall',
  publishedYear: 2008,
  coverImageUrl: 'https://covers.example/1.jpg',
}

// Render the card inside a minimal router so <Link> resolves (TanStack testing
// pattern), wrapped in the i18n provider. The app defaults to Chinese, so the
// visible copy is asserted in Chinese here.
function renderCard(book: BookCardBook, onBorrow = () => {}, pending = false) {
  const rootRoute = createRootRoute({
    component: () => (
      <I18nProvider>
        <BookCard book={book} onBorrow={onBorrow} pending={pending} />
      </I18nProvider>
    ),
  })
  const bookRoute = createRoute({ getParentRoute: () => rootRoute, path: '/books/$bookId', component: () => null })
  const router = createRouter({
    routeTree: rootRoute.addChildren([bookRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<RouterProvider router={router as any} />)
}

describe('BookCard', () => {
  it('renders title, author, publisher/year, isbn, and availability', async () => {
    renderCard(availableBook)
    expect(await screen.findByText('Clean Code')).toBeInTheDocument()
    expect(screen.getByText('作者：Robert C. Martin')).toBeInTheDocument()
    expect(screen.getByText(/Prentice Hall/)).toBeInTheDocument()
    expect(screen.getByText(/2008/)).toBeInTheDocument()
    expect(screen.getByText(/9780132350884/)).toBeInTheDocument()
    expect(screen.getByText('可借')).toBeInTheDocument()
  })

  it('renders the cover image when provided', async () => {
    renderCard(availableBook)
    const img = await screen.findByAltText('《Clean Code》封面')
    expect(img).toHaveAttribute('src', 'https://covers.example/1.jpg')
  })

  it('calls onBorrow with the book id when Borrow is clicked', async () => {
    const onBorrow = vi.fn()
    renderCard(availableBook, onBorrow)
    await userEvent.click(await screen.findByRole('button', { name: '借阅' }))
    expect(onBorrow).toHaveBeenCalledWith('1')
  })

  // --- Negation ---
  it('disables Borrow and shows all-copies-borrowed when unavailable', async () => {
    renderCard({ ...availableBook, isAvailable: false, availableCount: 0, quantity: 2 })
    expect(await screen.findByRole('button', { name: '借阅' })).toBeDisabled()
    expect(screen.getByText(/全部借出/)).toBeInTheDocument()
  })

  it('shows "M of N available" for a multi-copy book and allows borrow', async () => {
    const onBorrow = vi.fn()
    renderCard({ ...availableBook, availableCount: 1, quantity: 3 }, onBorrow)
    expect(await screen.findByText(/1\/3/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '借阅' }))
    expect(onBorrow).toHaveBeenCalledWith('1')
  })

  it('shows a "No cover" placeholder when no cover is provided', async () => {
    renderCard({ ...availableBook, coverImageUrl: null })
    expect(await screen.findByText('暂无封面')).toBeInTheDocument()
  })
})
