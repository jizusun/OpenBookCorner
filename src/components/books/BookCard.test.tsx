// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookCard } from './BookCard'

const availableBook = {
  id: '1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  isbn: '9780132350884',
  isAvailable: true,
}

describe('BookCard', () => {
  it('renders title, author, isbn, and availability', () => {
    render(<BookCard book={availableBook} onBorrow={() => {}} />)
    expect(screen.getByText('Clean Code')).toBeInTheDocument()
    expect(screen.getByText('by Robert C. Martin')).toBeInTheDocument()
    expect(screen.getByText(/9780132350884/)).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('calls onBorrow with the book id when Borrow is clicked', async () => {
    const onBorrow = vi.fn()
    render(<BookCard book={availableBook} onBorrow={onBorrow} />)
    await userEvent.click(screen.getByRole('button', { name: 'Borrow' }))
    expect(onBorrow).toHaveBeenCalledWith('1')
  })

  // --- Negation ---
  it('disables Borrow and shows Borrowed when unavailable', () => {
    render(<BookCard book={{ ...availableBook, isAvailable: false }} onBorrow={() => {}} />)
    expect(screen.getByRole('button', { name: 'Borrow' })).toBeDisabled()
    expect(screen.getByText('Borrowed')).toBeInTheDocument()
  })

  it('disables Borrow while a borrow is pending', () => {
    render(<BookCard book={availableBook} onBorrow={() => {}} pending />)
    expect(screen.getByRole('button', { name: 'Borrow' })).toBeDisabled()
  })
})
