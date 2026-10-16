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

// Render the card inside a minimal router so <Link> resolves (TanStack testing pattern).
function renderCard(book: BookCardBook, onBorrow = () => {}, pending = false) {
  const rootRoute = createRootRoute({ component: () => <BookCard book={book} onBorrow={onBorrow} pending={pending} /> })
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
    expect(screen.getByText('by Robert C. Martin')).toBeInTheDocument()
    expect(screen.getByText(/Prentice Hall/)).toBeInTheDocument()
    expect(screen.getByText(/2008/)).toBeInTheDocument()
    expect(screen.getByText(/9780132350884/)).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('renders the cover image when provided', async () => {
    renderCard(availableBook)
    const img = await screen.findByAltText('Cover of Clean Code')
    expect(img).toHaveAttribute('src', 'https://covers.example/1.jpg')
  })

  it('calls onBorrow with the book id when Borrow is clicked', async () => {
    const onBorrow = vi.fn()
    renderCard(availableBook, onBorrow)
    await userEvent.click(await screen.findByRole('button', { name: 'Borrow' }))
    expect(onBorrow).toHaveBeenCalledWith('1')
  })

  // --- Negation ---
  it('disables Borrow and shows Borrowed when unavailable', async () => {
    renderCard({ ...availableBook, isAvailable: false })
    expect(await screen.findByRole('button', { name: 'Borrow' })).toBeDisabled()
    expect(screen.getByText('Borrowed')).toBeInTheDocument()
  })

  it('shows a "No cover" placeholder when no cover is provided', async () => {
    renderCard({ ...availableBook, coverImageUrl: null })
    expect(await screen.findByText('No cover')).toBeInTheDocument()
  })
})
