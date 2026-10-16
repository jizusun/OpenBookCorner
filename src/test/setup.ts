import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Per TanStack Router's official testing setup.
// @ts-expect-error - test env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Reset the DOM between component tests (prevents "multiple elements" errors).
// Guarded so it is a no-op in node-environment server tests (no document).
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react')
    cleanup()
  }
})
