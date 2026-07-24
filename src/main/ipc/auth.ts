import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { createSession, destroySession } from './session'
import { handle, handlePublic } from './handle'
import { AuthError, BadRequestError } from './errors'
import type { Role } from './types'
import { getPinnedKpis } from './repositories/pinnedKpis'

const BCRYPT_ROUNDS = 12

// A session can outlive the user it belongs to (e.g. an admin removes the
// account while its token is still within the TTL). Prisma's own not-found
// error isn't an AppError, so without this it would surface as a generic
// INTERNAL_ERROR instead of a clean "please log in again."
async function getSessionUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AuthError('Session user no longer exists')
  return user
}

function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
  return null
}

interface LoginPayload {
  email: string
  password: string
}

interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

interface UpdateProfilePayload {
  full_name?: string
  email?: string
}

interface CreateUserPayload {
  email: string
  password: string
  full_name: string
  role: Role
}

interface UpdateUserPayload {
  id: string
  full_name?: string
  role?: Role
  is_active?: boolean
  password?: string
}

export function registerAuthHandlers(): void {
  handlePublic<LoginPayload, { token: string; user: { id: string; email: string; full_name: string; role: Role } }>(
    'auth:login',
    async ({ email, password }) => {
      if (!email || !password) throw new BadRequestError('Email and password required')
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || !user.is_active) throw new AuthError('Invalid credentials')
      const valid = await bcrypt.compare(password, user.password)
      if (!valid) throw new AuthError('Invalid credentials')
      const token = createSession(user.id, user.email, user.role)
      return { token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } }
    }
  )

  // Public, not handle(): the source route has no authenticate middleware, so
  // logout must succeed even with an already-expired or missing token.
  handlePublic<{ token: string | null }, null>('auth:logout', async ({ token }) => {
    if (token) destroySession(token)
    return null
  })

  handle<void, { id: string; email: string; full_name: string; role: Role; pinnedKpis: string[] }>(
    'auth:profile',
    null,
    async (_payload, session) => {
      const user = await getSessionUser(session.userId)
      const pinnedKpis = await getPinnedKpis(user.id)
      return { id: user.id, email: user.email, full_name: user.full_name, role: user.role, pinnedKpis }
    }
  )

  handle<ChangePasswordPayload, null>(
    'auth:changePassword',
    null,
    async ({ currentPassword, newPassword }, session) => {
      const strengthError = validatePasswordStrength(newPassword)
      if (strengthError) throw new BadRequestError(strengthError)
      const user = await getSessionUser(session.userId)
      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) throw new BadRequestError('Current password is incorrect')
      const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
      await prisma.user.update({ where: { id: session.userId }, data: { password: hashed } })
      return null
    },
    { resource: 'auth', action: 'UPDATE' }
  )

  handle<UpdateProfilePayload, { id: string; email: string; full_name: string; role: Role }>(
    'auth:updateProfile',
    null,
    async ({ full_name, email }, session) => {
      const data: { full_name?: string; email?: string } = {}
      if (full_name?.trim()) data.full_name = full_name.trim()
      if (email?.trim()) {
        const exists = await prisma.user.findFirst({ where: { email: email.trim(), NOT: { id: session.userId } } })
        if (exists) throw new BadRequestError('Email already in use')
        data.email = email.trim()
      }
      if (Object.keys(data).length === 0) throw new BadRequestError('No fields to update')
      return prisma.user.update({
        where: { id: session.userId },
        data,
        select: { id: true, email: true, full_name: true, role: true }
      })
    },
    { resource: 'auth', action: 'UPDATE' }
  )

  handle<void, Array<{ id: string; email: string; full_name: string; role: Role; is_active: boolean; createdAt: Date }>>(
    'auth:listUsers',
    ['ADMIN'],
    async () =>
      prisma.user.findMany({
        select: { id: true, email: true, full_name: true, role: true, is_active: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      })
  )

  handle<CreateUserPayload, { id: string; email: string; full_name: string; role: Role; is_active: boolean }>(
    'auth:createUser',
    ['ADMIN'],
    async ({ email, password, full_name, role }) => {
      if (!email || !password || !full_name || !role) {
        throw new BadRequestError('email, password, full_name and role are required')
      }
      const strengthError = validatePasswordStrength(password)
      if (strengthError) throw new BadRequestError(strengthError)
      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) throw new BadRequestError('Email already in use')
      const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS)
      return prisma.user.create({
        data: { email, password: hashed, full_name, role },
        select: { id: true, email: true, full_name: true, role: true, is_active: true }
      })
    },
    { resource: 'auth', action: 'CREATE' }
  )

  handle<UpdateUserPayload, { id: string; email: string; full_name: string; role: Role; is_active: boolean }>(
    'auth:updateUser',
    ['ADMIN'],
    async ({ id, full_name, role, is_active, password }) => {
      const user = await prisma.user.findUnique({ where: { id } })
      if (!user) throw new BadRequestError('User not found')
      const data: { full_name?: string; role?: Role; is_active?: boolean; password?: string } = {}
      if (full_name !== undefined) data.full_name = full_name
      if (role !== undefined) data.role = role
      if (is_active !== undefined) data.is_active = is_active
      if (password) {
        const strengthError = validatePasswordStrength(password)
        if (strengthError) throw new BadRequestError(strengthError)
        data.password = await bcrypt.hash(password, BCRYPT_ROUNDS)
      }
      return prisma.user.update({
        where: { id },
        data,
        select: { id: true, email: true, full_name: true, role: true, is_active: true }
      })
    },
    { resource: 'auth', action: 'UPDATE' }
  )
}
