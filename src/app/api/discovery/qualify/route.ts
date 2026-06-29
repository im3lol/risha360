// POST /api/discovery/qualify
// Visual AI qualification: given profile snapshots (text + images), a vision
// model decides whether each account is an individual creator/celebrity/artist
// worth keeping. Used by the browser extension (and the agent) before saving.
// Authenticated with the shared agent secret.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentSecret } from '@/lib/api-auth'
import { badRequest, qualifySchema, serverError } from '@/lib/api-validation'
import { qualifyProfile } from '@/lib/discovery/qualify'
import { getAgentSettings } from '@/lib/discovery/orchestrator'
import { applyAgentConfig } from '@/lib/discovery/runtime-config'

export async function POST(request: NextRequest) {
  if (!verifyAgentSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = qualifySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return badRequest(parsed.error)
  const { niche, profiles } = parsed.data

  try {
    await applyAgentConfig(await getAgentSettings().catch(() => null))
    // Limited concurrency to be gentle on rate-limited free vision models.
    const verdicts = await mapPool(profiles, 2, (p) =>
      qualifyProfile({
        username: p.username,
        fullName: p.fullName,
        bio: p.bio,
        category: p.category,
        followers: p.followers,
        engagementRate: p.engagementRate ?? undefined,
        captions: p.captions,
        images: p.images,
        niche,
      })
    )
    return NextResponse.json({ verdicts })
  } catch (error) {
    return serverError(error, 'POST /api/discovery/qualify')
  }
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, () => worker()))
  return results
}
