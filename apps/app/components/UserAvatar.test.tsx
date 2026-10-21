// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { UserAvatar } from './UserAvatar'

describe('UserAvatar', () => {
  it('shows two-letter initials for a full name', () => {
    render(<UserAvatar name="Ada Lovelace" />)
    expect(screen.getByText('AL')).toBeInTheDocument()
    cleanup()
  })

  it('shows up to two letters for a single name', () => {
    render(<UserAvatar name="root" />)
    expect(screen.getByText('RO')).toBeInTheDocument()
    cleanup()
  })

  it('falls back to ? for an empty name', () => {
    render(<UserAvatar name="   " />)
    expect(screen.getByText('?')).toBeInTheDocument()
    cleanup()
  })

  it('is deterministic: same name → same classes', () => {
    const { container: a } = render(<UserAvatar name="Grace Hopper" />)
    const first = a.firstElementChild?.className
    cleanup()
    const { container: b } = render(<UserAvatar name="Grace Hopper" />)
    expect(b.firstElementChild?.className).toBe(first)
    cleanup()
  })
})
