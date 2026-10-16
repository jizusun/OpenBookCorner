import { setCookie, deleteCookie } from '@tanstack/react-start/server'
import { SESSION_COOKIE } from '@/server/auth/session'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const

export function setSessionCookie(id: string) {
  setCookie(SESSION_COOKIE, id, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS })
}

export function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, cookieOptions)
}
