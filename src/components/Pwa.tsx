import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Registers the service worker, surfaces an "Install app" button when the browser
 * offers it, and shows an offline indicator. Client-only (guards on `window`).
 */
export function Pwa() {
  const [offline, setOffline] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setOffline(!navigator.onLine)
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  return (
    <>
      {offline && (
        <div
          data-testid="offline-indicator"
          className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-1 text-center text-xs font-medium text-amber-950"
        >
          You are offline — showing cached data. Borrowing requires a connection.
        </div>
      )}
      {installEvent && (
        <button
          type="button"
          onClick={install}
          data-testid="install-button"
          className="fixed bottom-4 right-4 z-50 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg"
        >
          Install app
        </button>
      )}
    </>
  )
}
