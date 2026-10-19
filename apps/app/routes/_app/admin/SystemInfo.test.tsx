// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n'
import { SystemInfo } from './SystemInfo'

function renderInfo(props: Parameters<typeof SystemInfo>[0]) {
  return render(
    <I18nProvider>
      <SystemInfo {...props} />
    </I18nProvider>,
  )
}

describe('SystemInfo (read-only)', () => {
  it('shows the current environment value', () => {
    renderInfo({ config: { environment: 'preview' } })
    expect(screen.getByTestId('sys-environment')).toHaveTextContent('preview')
  })

  it('reflects demo-account visibility: visible in non-production', () => {
    renderInfo({ config: { environment: 'preview' } })
    expect(screen.getByTestId('sys-demo-visible')).toHaveAttribute('data-visible', 'true')
  })

  it('reflects demo-account visibility: hidden in production', () => {
    renderInfo({ config: { environment: 'production' } })
    expect(screen.getByTestId('sys-demo-visible')).toHaveAttribute('data-visible', 'false')
  })

  it('falls back to "unknown" when config could not be loaded', () => {
    renderInfo({ config: null })
    expect(screen.getByTestId('sys-environment')).toHaveTextContent('—')
    expect(screen.getByTestId('sys-demo-visible')).toHaveAttribute('data-visible', 'false')
  })

  it('states the path-based tenancy model', () => {
    renderInfo({ config: { environment: 'development' } })
    expect(screen.getByTestId('sys-tenancy')).toHaveTextContent('/t/')
  })

  it('is read-only: renders no form controls', () => {
    const { container } = renderInfo({ config: { environment: 'development' } })
    expect(container.querySelectorAll('input, button, select, textarea')).toHaveLength(0)
  })
})
