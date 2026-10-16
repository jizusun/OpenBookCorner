import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { sessions, users, type User } from '@/db/schema'

// Minimal, Workers-compatible session layer (Lucia-style: opaque session id in an
// httpOnly cookie; sessions row stores userId + expiry). KISS for Phase 1.

export const SESSION_COOKIE = 'obc_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createSession(db: Db, userId: string): Promise<{ id: string; expiresAt: number }> {
  const id = generateSessionId()
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  await db.insert(sessions).values({ id, userId, expiresAt })
  return { id, expiresAt }
}

export interface ValidatedSession {
  user: User
  sessionId: string
}

export async function validateSession(db: Db, sessionId: string): Promise<ValidatedSession | null> {
  const row = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get()

  if (!row) return null

  const now = Math.floor(Date.now() / 1000)
  if (row.session.expiresAt < now) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
    return null
  }
  if (!row.user.isActive) return null

  return { user: row.user, sessionId }
}

export async function invalidateSession(db: Db, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

export function buildSessionCookie(id: string, maxAgeSeconds = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${id}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=${maxAgeSeconds}`
}

export function buildBlankSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0`
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === SESSION_COOKIE) return v.join('=') || null
  }
  return null
}
