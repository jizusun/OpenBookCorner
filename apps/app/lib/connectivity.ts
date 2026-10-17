/**
 * WeChat-safe connectivity check.
 *
 * `navigator.onLine` is unreliable in some embedded WebViews — notably WeChat's
 * in-app browser, which can report `onLine === false` while the device is fully
 * online. Trusting it directly made us block borrow/return and show a false
 * "offline" banner inside WeChat.
 *
 * Rule: if `navigator.onLine` is true, we're online (fast path, no probe). If it
 * reports false, DON'T trust it — probe a tiny same-origin endpoint; only treat
 * as offline when that probe also fails.
 */
export async function isLikelyOffline(timeoutMs = 3000): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  if (navigator.onLine) return false

  // onLine says offline — verify with a real request before believing it.
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    await fetch('/health', { method: 'GET', cache: 'no-store', signal: controller.signal })
    clearTimeout(t)
    return false // probe reached the server → we are online (WeChat lied)
  } catch {
    return true // onLine=false AND probe failed → genuinely offline
  }
}
