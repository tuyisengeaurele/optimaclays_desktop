import { randomBytes } from 'crypto'
import type { Role, SessionInfo } from './types'

interface StoredSession extends SessionInfo {
  expiresAt: number
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000

const sessions = new Map<string, StoredSession>()

export function createSession(userId: string, email: string, role: Role): string {
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { userId, email, role, expiresAt: Date.now() + SESSION_TTL_MS })
  return token
}

export function getSession(token: string | undefined | null): SessionInfo | null {
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  return { userId: session.userId, email: session.email, role: session.role }
}

export function destroySession(token: string): void {
  sessions.delete(token)
}
