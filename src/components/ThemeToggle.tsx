import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'obc-theme'

/**
 * Inline script injected into <head> to apply the stored (or system) theme before
 * first paint, avoiding a light/dark flash. Mirrors getInitialTheme() below.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    var dark = stored ? stored === 'dark' : mql.matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`

function getStoredTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'dark' || v === 'light' ? v : null
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/** Light/dark toggle that persists the user's choice in localStorage. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  // Sync initial state from the DOM class the init script already applied.
  useEffect(() => {
    const isDark =
      getStoredTheme() === 'dark' ||
      (getStoredTheme() === null && document.documentElement.classList.contains('dark'))
    setTheme(isDark ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }

  const isDark = theme === 'dark'
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      data-testid="theme-toggle"
    >
      <span aria-hidden>{isDark ? '☀️' : '🌙'}</span>
    </Button>
  )
}
