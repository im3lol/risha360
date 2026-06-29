import type {
  DiscoveredCandidate,
  DiscoveryPlatform,
  ProviderRun,
  SearchPlan,
} from './types'

const APIFY_API = 'https://api.apify.com/v2'

function getToken() {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN is not configured')
  return token
}

function actorId(platform: DiscoveryPlatform) {
  return platform === 'instagram'
    ? process.env.APIFY_INSTAGRAM_SEARCH_ACTOR || 'apify/instagram-search-scraper'
    : process.env.APIFY_TIKTOK_SEARCH_ACTOR || 'clockworks/tiktok-user-search-scraper'
}

function actorApiId(id: string) {
  return id.replace('/', '~')
}

export function isApifyConfigured() {
  return Boolean(process.env.APIFY_TOKEN)
}

export async function startSearchRun(
  platform: DiscoveryPlatform,
  plan: SearchPlan
): Promise<ProviderRun> {
  const token = getToken()
  const id = actorId(platform)
  const perQuery = Math.max(
    1,
    Math.min(250, Math.ceil(plan.targetCount / Math.max(plan.queries.length, 1)))
  )

  const input =
    platform === 'instagram'
      ? {
          search: plan.queries.join(','),
          searchType: 'user',
          searchLimit: perQuery,
        }
      : {
          searchQueries: plan.queries,
          maxProfilesPerQuery: perQuery,
        }

  const response = await fetch(
    `${APIFY_API}/acts/${actorApiId(id)}/runs?token=${encodeURIComponent(token)}&waitForFinish=0`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    }
  )

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Failed to start ${platform} search`)
  }

  return {
    platform,
    actorId: id,
    runId: payload.data.id,
    datasetId: payload.data.defaultDatasetId,
    status: payload.data.status,
  }
}

export async function getRun(run: ProviderRun): Promise<ProviderRun> {
  const token = getToken()
  const response = await fetch(
    `${APIFY_API}/actor-runs/${run.runId}?token=${encodeURIComponent(token)}`,
    { cache: 'no-store' }
  )
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Failed to read Apify run')
  }

  return {
    ...run,
    datasetId: payload.data.defaultDatasetId || run.datasetId,
    status: payload.data.status,
  }
}

export async function getRunCandidates(run: ProviderRun): Promise<DiscoveredCandidate[]> {
  if (!run.datasetId) return []
  const token = getToken()
  const response = await fetch(
    `${APIFY_API}/datasets/${run.datasetId}/items?token=${encodeURIComponent(token)}&clean=true&format=json`,
    { cache: 'no-store' }
  )
  const items = await response.json()
  if (!response.ok || !Array.isArray(items)) {
    throw new Error('Failed to read Apify dataset')
  }

  return items
    .map((item) => normalizeCandidate(run.platform, item))
    .filter((candidate): candidate is DiscoveredCandidate => candidate !== null)
}

function normalizeCandidate(
  platform: DiscoveryPlatform,
  item: Record<string, unknown>
): DiscoveredCandidate | null {
  if (item.errorCode) return null

  const username = stringValue(
    platform === 'instagram'
      ? item.username || nested(item, 'user', 'username') || nested(item, 'owner', 'username')
      : item.name || item.uniqueId || item.username
  ).replace(/^@/, '')

  if (!username) return null

  const followers = numberValue(
    platform === 'instagram'
      ? item.followersCount || item.followers || item.edge_followed_by
      : item.fans || item.followerCount
  )

  return {
    platform,
    username,
    displayName: stringValue(
      platform === 'instagram'
        ? item.fullName || item.full_name || item.name
        : item.nickName || item.nickname || item.name
    ) || username,
    bio: stringValue(platform === 'instagram' ? item.biography || item.bio : item.signature || item.bio),
    profileUrl:
      stringValue(item.url || item.profileUrl) ||
      (platform === 'instagram'
        ? `https://www.instagram.com/${username}/`
        : `https://www.tiktok.com/@${username}`),
    profileImageUrl: stringValue(item.profilePicUrl || item.profile_pic_url || item.avatar),
    followers,
    following: numberValue(item.followingCount || item.following),
    posts: numberValue(item.postsCount || item.mediaCount || item.video),
    verified: Boolean(item.verified || item.isVerified || item.is_verified),
    website: stringValue(item.externalUrl || item.bioLink || item.website),
    sourceMetadata: item,
  }
}

function nested(
  value: Record<string, unknown>,
  parent: string,
  child: string
) {
  const nestedValue = value[parent]
  if (!nestedValue || typeof nestedValue !== 'object') return undefined
  return (nestedValue as Record<string, unknown>)[child]
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? Math.round(parsed) : 0
  }
  return 0
}
