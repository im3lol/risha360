import type { DiscoveryPlatform, SearchPlan } from './types'
import { pickCreatorNames } from './saudi-creators'

const arabicCategories: Record<string, string[]> = {
  Food: ['صانع محتوى أكل', 'فود بلوجر', 'تقييم مطاعم'],
  Fashion: ['صانع محتوى موضة', 'فاشن سعودي', 'أزياء'],
  Beauty: ['صانعة محتوى تجميل', 'خبيرة مكياج', 'عناية بالبشرة'],
  Lifestyle: ['صانع محتوى لايف ستايل', 'يوميات سعودي', 'أسلوب حياة'],
  Comedy: ['كوميدي سعودي', 'صانع محتوى كوميدي', 'مقاطع مضحكة'],
  Fitness: ['مدرب لياقة', 'صانع محتوى رياضي', 'فتنس سعودي'],
  Tech: ['مراجع تقني', 'صانع محتوى تقنية', 'مراجعات أجهزة'],
  Actor: ['ممثل سعودي', 'صانع أفلام سعودي', 'ممثل'],
  Artist: ['فنان سعودي', 'رسام سعودي', 'صانع محتوى فني'],
}

const englishCategories: Record<string, string[]> = {
  Food: ['food creator', 'food blogger', 'restaurant reviewer'],
  Fashion: ['fashion creator', 'Saudi fashion', 'style blogger'],
  Beauty: ['beauty creator', 'makeup artist', 'skincare creator'],
  Lifestyle: ['lifestyle creator', 'Saudi lifestyle', 'daily vlogger'],
  Comedy: ['Saudi comedian', 'comedy creator', 'funny videos'],
  Fitness: ['fitness creator', 'personal trainer', 'Saudi fitness'],
  Tech: ['tech reviewer', 'technology creator', 'gadget reviewer'],
  Actor: ['Saudi actor', 'filmmaker', 'acting creator'],
  Artist: ['Saudi artist', 'visual artist', 'art creator'],
}

const arabicCities: Record<string, string> = {
  Riyadh: 'الرياض',
  Jeddah: 'جدة',
  Dammam: 'الدمام',
  Khobar: 'الخبر',
  Makkah: 'مكة',
  Madinah: 'المدينة',
  Abha: 'أبها',
  Taif: 'الطائف',
}

export function createSearchPlan(input: {
  category: string
  city: string
  platforms: string[]
  minFollowers: number
  targetCount: number
  extraKeywords?: string
}): SearchPlan {
  const english = englishCategories[input.category] || [`${input.category} creator`]
  const arabic = arabicCategories[input.category] || [`صانع محتوى ${input.category}`]
  const arabicCity = arabicCities[input.city] || input.city
  const extra = (input.extraKeywords || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const queries = [
    ...english.map((term) => `${term} ${input.city}`),
    ...arabic.map((term) => `${term} ${arabicCity}`),
    ...extra,
  ]

  const hashtags = [
    `${input.city}${input.category}`.replace(/\s+/g, ''),
    `${input.category}Saudi`.replace(/\s+/g, ''),
    `${arabicCity}${arabic[0]}`.replace(/\s+/g, ''),
  ]

  const platforms = input.platforms.filter(
    (platform): platform is DiscoveryPlatform =>
      platform === 'instagram' || platform === 'tiktok'
  )

  return {
    version: 1,
    category: input.category,
    city: input.city,
    platforms,
    minFollowers: input.minFollowers,
    targetCount: input.targetCount,
    queries: [...new Set(queries.map(shortenQuery).filter(Boolean))].slice(0, 12),
    hashtags: [...new Set(hashtags)].slice(0, 6),
    createdAt: new Date().toISOString(),
    planner: 'deterministic',
  }
}

type PlannerProvider = 'gemini' | 'openrouter'
interface RawPlan {
  queries?: string[]
  hashtags?: string[]
  rationale?: string
}

const PLANNER_INSTRUCTION =
  'You generate Instagram SEARCH-BOX terms to find Saudi creators. CRITICAL: each query must ' +
  'be a SHORT keyword phrase of 2 to 4 words — exactly what a person types into the Instagram ' +
  'search box — NOT a full sentence. No prepositions, verbs, "looking for", quotes, hashtags, ' +
  'or URLs inside queries. Mix natural Arabic and English. ' +
  'GOOD examples: "فاشن جدة", "مدونة موضة", "food blogger riyadh", "مكياج سعودي", "travel ksa". ' +
  'BAD (never do this): "صانع محتوى أزياء فاخرة في جدة على انستغرام للتعاون". ' +
  'Respond ONLY with JSON: {"queries": string[6..12], "hashtags": string[3..8], "rationale": string}.'

/**
 * Pick the LLM provider for query planning:
 *   PLANNER_PROVIDER=openrouter|gemini forces a specific provider (if its key exists).
 *   PLANNER_PROVIDER=auto (default) prefers OpenRouter, then Gemini, else deterministic.
 */
export function selectPlannerProvider(): PlannerProvider | null {
  const forced = (process.env.PLANNER_PROVIDER || 'auto').toLowerCase()
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY)
  const hasGemini = Boolean(process.env.GEMINI_API_KEY)

  if (forced === 'openrouter') return hasOpenRouter ? 'openrouter' : null
  if (forced === 'gemini') return hasGemini ? 'gemini' : null
  // auto
  if (hasOpenRouter) return 'openrouter'
  if (hasGemini) return 'gemini'
  return null
}

export async function createIntelligentSearchPlan(input: {
  category: string
  city: string
  platforms: string[]
  minFollowers: number
  targetCount: number
  extraKeywords?: string
}): Promise<SearchPlan> {
  const fallback = createSearchPlan(input)
  const provider = selectPlannerProvider()
  if (!provider) return fallback

  const userPayload = JSON.stringify({
    outcome: 'Find relevant public creator profiles for partnership outreach.',
    market: input.city,
    category: input.category,
    platforms: input.platforms,
    minimumFollowers: input.minFollowers,
    targetCount: input.targetCount,
    extraKeywords: input.extraKeywords || '',
    fallbackQueries: fallback.queries,
  })

  try {
    const raw =
      provider === 'openrouter'
        ? await callOpenRouter(userPayload)
        : await callGemini(userPayload)
    if (!raw) return fallback

    const queries = cleanStrings(
      [...(raw.queries || []), ...(input.extraKeywords || '').split(',')].map(shortenQuery),
      12
    )
    const hashtags = cleanStrings(
      (raw.hashtags || []).map((value) => value.replace(/^#/, '')),
      8
    )
    if (queries.length < 3) return fallback

    return {
      ...fallback,
      queries,
      hashtags: hashtags.length ? hashtags : fallback.hashtags,
      planner: provider,
      rationale: (raw.rationale || '').slice(0, 500),
    }
  } catch (error) {
    console.error(`${provider} query planner fell back to deterministic planning`, error)
    return fallback
  }
}

/**
 * Build NAME-based search queries for autonomous discovery. Instagram top-search
 * only surfaces diverse real creators when queried by a person's name, so we
 * search real Saudi creator names: a rotating slice of the curated pool (always
 * available, free) expanded with fresh AI-generated names when a Gemini key is
 * configured. `offset` rotates the curated slice so each run hits new creators.
 */
export async function buildCreatorNameQueries(input: {
  category?: string
  city?: string
  country?: string
  instructions?: string
  offset: number
  count?: number
}): Promise<string[]> {
  const count = input.count ?? 10
  const curated = pickCreatorNames(count, input.offset)
  let aiNames: string[] = []
  if (process.env.GEMINI_API_KEY) {
    aiNames = await geminiCreatorNames(input, count).catch(() => [])
  }
  // AI names first (fresh/diverse), then curated rotation; dedup, cap.
  return cleanStrings([...aiNames, ...curated], count + 8)
}

/** Ask Gemini for REAL famous creator names in a niche/country (free tier). */
async function geminiCreatorNames(
  input: { category?: string; city?: string; country?: string; instructions?: string },
  limit: number
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []
  const model = process.env.GEMINI_DISCOVERY_MODEL || 'gemini-2.0-flash'
  const niche = input.category && !/^(all|other|influencer)/i.test(input.category) ? input.category : 'any niche'
  const countryName = countryLabel(input.country)
  const where = input.city && !/^all$/i.test(input.city) ? ` based in or from ${input.city}, ${countryName}` : ` from ${countryName}`
  const extra = input.instructions ? ` IMPORTANT extra requirements from the user: ${input.instructions}.` : ''
  const prompt =
    `List ${limit + 6} REAL, currently-active ${countryName} social-media creators/celebrities ` +
    `(${niche})${where} — actors, singers, YouTubers, athletes, comedians, influencers.${extra} ` +
    `Use their commonly-known full names (Arabic or English). Respond ONLY with JSON: ` +
    `{"names": string[]}. No accounts that are brands, shops, or companies.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.9 },
      }),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    }
  )
  const payload = await response.json()
  if (!response.ok) return []
  const text = ((payload?.candidates || [])[0]?.content?.parts || [])
    .map((part: { text?: string }) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
  try {
    const parsed = JSON.parse(text)
    const names = Array.isArray(parsed?.names) ? parsed.names : []
    return names.map((n: unknown) => String(n).trim()).filter(Boolean)
  } catch {
    return []
  }
}

async function callGemini(userPayload: string): Promise<RawPlan | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const model = process.env.GEMINI_DISCOVERY_MODEL || 'gemini-2.0-flash'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: PLANNER_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: userPayload }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    }
  )

  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error?.message || 'Gemini planning failed')
  const text = ((payload?.candidates || [])[0]?.content?.parts || [])
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
  return JSON.parse(text) as RawPlan
}

async function callOpenRouter(userPayload: string): Promise<RawPlan | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null
  // OpenRouter is OpenAI-compatible. Pick a model with OPENROUTER_MODEL — verify
  // the id exists in your OpenRouter account; on error this falls back gracefully.
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free'

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  // Optional attribution headers recommended by OpenRouter.
  if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL
  if (process.env.OPENROUTER_APP_NAME) headers['X-Title'] = process.env.OPENROUTER_APP_NAME

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: PLANNER_INSTRUCTION },
        { role: 'user', content: userPayload },
      ],
      // No response_format: not every OpenRouter model supports json_object mode;
      // we rely on the instruction + tolerant JSON extraction instead.
      // Cap output tokens — the plan is a small JSON, and an uncapped request
      // defaults to the model's full context and gets rejected on low credit.
      max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS) || 1024,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(45_000),
    cache: 'no-store',
  })

  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error?.message || 'OpenRouter planning failed')
  const text = payload?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) return null
  return parseJsonLoose(text)
}

/** Extract a JSON object from model text that may be fenced or wrapped in prose. */
function parseJsonLoose(text: string): RawPlan | null {
  let raw = text.trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1)
  try {
    return JSON.parse(raw) as RawPlan
  } catch {
    return null
  }
}

// Map a country code (or name) to a human label for the name-generation prompt.
const COUNTRY_NAMES: Record<string, string> = {
  SA: 'Saudi Arabia', AE: 'the UAE', KW: 'Kuwait', QA: 'Qatar', BH: 'Bahrain',
  OM: 'Oman', EG: 'Egypt', JO: 'Jordan', LB: 'Lebanon', IQ: 'Iraq', MA: 'Morocco',
}
export function countryLabel(code?: string): string {
  if (!code) return 'Saudi Arabia'
  return COUNTRY_NAMES[code.toUpperCase()] || code
}

function cleanStrings(values: string[], limit: number) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit)
}

// Force every query to look like an Instagram search-box term, not a sentence:
// strip punctuation/filler, cap to ~4 words and 40 chars.
const FILLER = /\b(in|on|at|for|the|a|an|with|and|to|of|من|في|على|عن|مع|الذي|اللي|على انستغرام|انستغرام|instagram|looking|find)\b/gi
export function shortenQuery(q: string): string {
  const cleaned = (q || '')
    .replace(/[#@"'.,!?:؛،()]/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.split(' ').slice(0, 4).join(' ').slice(0, 40).trim()
}
