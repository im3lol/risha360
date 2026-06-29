/**
 * Risha 360 — Visual AI qualification.
 *
 * Given a profile "snapshot" (text + profile/post images), a vision model on
 * OpenRouter decides whether the account is an individual creator worth keeping
 * (influencer / celebrity / artist / actor / athlete / musician / model) versus
 * a business / brand / shop / page / meme / news / random account.
 *
 * Cost-aware: only call this for accounts that already passed the cheap
 * heuristic filter, cap images, small max_tokens, free vision model by default.
 * On any AI error it defaults to KEEP so the pipeline never loses leads.
 */

export interface QualifySnapshot {
  username: string
  fullName?: string
  bio?: string
  category?: string
  followers?: number
  engagementRate?: number
  captions?: string[]
  images?: string[] // http(s) URLs or data: URLs
  niche?: string
}

export interface Verdict {
  username: string
  keep: boolean
  persona: string
  nicheMatch: boolean
  confidence: number
  reason: string
}

const KEEP_PERSONAS = new Set([
  'influencer', 'celebrity', 'artist', 'actor', 'athlete', 'musician', 'model',
  'creator', 'public_figure', 'public figure',
])

const MAX_IMAGES = 4

const QUALIFY_INSTRUCTION =
  'You vet Instagram accounts for an influencer-marketing platform targeting Saudi Arabia. ' +
  'Using the profile picture, post images, and the text, decide whether this is an INDIVIDUAL ' +
  'person who is an influencer, celebrity, artist, actor, athlete, musician, or model (these are ' +
  'KEEP) versus a business, brand, shop, e-commerce, restaurant, agency, news/media, meme page, ' +
  'or an ordinary private person with no creator presence (these are REJECT). The profile picture ' +
  'should look like a real person and posts should be personal/creative content, not product ads. ' +
  'Respond with ONLY JSON: {"keep":boolean,"persona":"influencer|celebrity|artist|actor|athlete|' +
  'musician|model|business|brand|shop|news|meme|personal|other","nicheMatch":boolean,' +
  '"confidence":0..1,"reason":"<=20 words"}.'

export async function qualifyProfile(s: QualifySnapshot): Promise<Verdict> {
  const apiKey = process.env.OPENROUTER_API_KEY
  // Default to a free vision model so qualification never surprises the user's
  // OpenRouter balance. Override with OPENROUTER_VISION_MODEL.
  const model = process.env.OPENROUTER_VISION_MODEL || 'google/gemma-4-31b-it:free'

  if (!apiKey) {
    return { username: s.username, keep: true, persona: 'unknown', nicheMatch: true, confidence: 0, reason: 'AI qualification disabled (no key)' }
  }

  const text =
    `Account @${s.username} | name: ${s.fullName || ''} | bio: ${(s.bio || '').slice(0, 400)} | ` +
    `IG category: ${s.category || 'none'} | followers: ${s.followers || 0} | ` +
    `engagement: ${s.engagementRate ?? '?'}% | target niche: ${s.niche || 'any'} | ` +
    `recent captions: ${(s.captions || []).slice(0, 6).join(' || ').slice(0, 600)}`

  const content: Array<Record<string, unknown>> = [{ type: 'text', text }]
  for (const img of (s.images || []).slice(0, MAX_IMAGES)) {
    if (img) content.push({ type: 'image_url', image_url: { url: img } })
  }

  // Free vision models are flaky/rate-limited — try the primary then a fallback.
  const fallback = process.env.OPENROUTER_VISION_MODEL_FALLBACK || 'nvidia/nemotron-nano-12b-v2-vl:free'
  const models = [...new Set([model, fallback])]
  let lastError: unknown = null

  for (const m of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: QUALIFY_INSTRUCTION },
            { role: 'user', content },
          ],
          max_tokens: Number(process.env.OPENROUTER_VISION_MAX_TOKENS) || 300,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(60_000),
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error?.message || 'vision qualify failed')
      const raw = payload?.choices?.[0]?.message?.content
      const v = parseVerdict(typeof raw === 'string' ? raw : '')
      if (!v) {
        lastError = new Error('unparseable response')
        continue
      }
      // Final keep = model said keep AND the persona is one we want.
      const persona = String(v.persona || '').toLowerCase()
      const keep = v.keep === true && KEEP_PERSONAS.has(persona)
      return {
        username: s.username,
        keep,
        persona,
        nicheMatch: v.nicheMatch !== false,
        confidence: Number(v.confidence) || 0,
        reason: String(v.reason || '').slice(0, 160),
      }
    } catch (error) {
      lastError = error
    }
  }

  console.error('qualifyProfile fell back to keep:', lastError)
  return { username: s.username, keep: true, persona: 'unknown', nicheMatch: true, confidence: 0, reason: 'AI error — kept by fallback' }
}

function parseVerdict(text: string): Record<string, unknown> | null {
  let raw = text.trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1)
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}
