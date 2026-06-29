import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * Constant-time check of the shared agent secret (x-agent-secret header), used
 * by machine-to-machine endpoints (cron tick, extension ingest) that aren't
 * driven by a logged-in user.
 */
export function verifyAgentSecret(request: Request): boolean {
  const expected = process.env.AGENT_CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  const supplied = request.headers.get('x-agent-secret')
  if (!supplied || !expected) return false
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function requireAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { data, error } = await supabaseServer.auth.getUser(token)

  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
  }

  return null
}
