import crypto from 'node:crypto'
import type { AstroCookies } from 'astro'

// Single shared password gates the admin. A successful login mints a signed,
// expiring cookie; no server-side session store.
const COOKIE = 'bs_session'
const TTL_MS = 12 * 60 * 60 * 1000

const env = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const sign = (payload: string): string =>
  crypto.createHmac('sha256', env('SESSION_SECRET')).update(payload).digest('base64url')

const safeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

export const checkPassword = (input: string): boolean => safeEqual(input, env('ADMIN_PASSWORD'))

const mintToken = (): string => {
  const payload = String(Date.now() + TTL_MS)
  return `${payload}.${sign(payload)}`
}

const tokenValid = (token: string | undefined): boolean => {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false
  const expiry = Number(payload)
  return Number.isFinite(expiry) && Date.now() < expiry
}

export const startSession = (cookies: AstroCookies): void => {
  cookies.set(COOKIE, mintToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_MS / 1000,
  })
}

export const endSession = (cookies: AstroCookies): void => {
  cookies.delete(COOKIE, { path: '/' })
}

export const isAuthed = (cookies: AstroCookies): boolean => tokenValid(cookies.get(COOKIE)?.value)
