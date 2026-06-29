// POST /api/discovery/known
// Returns which of the given usernames are ALREADY in the database, so the
// extension/agent can skip them and stop re-scraping the same accounts.
// Authenticated with the shared agent secret.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentSecret } from '@/lib/api-auth'
import { badRequest, knownSchema, serverError } from '@/lib/api-validation'
import { supabaseServer as supabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  if (!verifyAgentSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = knownSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return badRequest(parsed.error)

  const usernames = [...new Set(parsed.data.usernames.map((u) => u.toLowerCase()))]
  const freshDays = parsed.data.freshDays ?? 30

  try {
    const { data, error } = await supabase
      .from('social_profiles')
      .select('platform_username, last_synced_at')
      .in('platform_username', usernames)
    if (error) return serverError(error, 'POST /api/discovery/known')

    const cutoff = freshDays > 0 ? Date.now() - freshDays * 86_400_000 : null
    const known = (data || [])
      .filter((r: { last_synced_at?: string }) => {
        if (cutoff === null) return true // 0 → always known
        const synced = r.last_synced_at ? new Date(r.last_synced_at).getTime() : 0
        return synced >= cutoff // only recently-synced count as known (skip)
      })
      .map((r: { platform_username: string }) => String(r.platform_username).toLowerCase())
    return NextResponse.json({ known })
  } catch (error) {
    return serverError(error, 'POST /api/discovery/known')
  }
}
