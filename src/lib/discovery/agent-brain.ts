// ============================================================================
// Risha 360 — Adaptive Discovery Agent Brain
// ----------------------------------------------------------------------------
// A SHARED decision core used by both the autonomous server worker and the
// browser extension. It turns the discovery pipeline from a fixed sequence into
// a Plan → Act → Observe → Decide loop:
//
//   caller gathers state (what was searched, yield, top accounts, frontier)
//        → decideNextAction(state) returns ONE next action
//        → caller executes it (snowball / refine / broaden / switch / stop)
//        → caller measures the new round and loops.
//
// The brain is PURE (state in → action out) so it can be unit-tested and reused
// anywhere. An LLM (OpenRouter → Gemini) picks the action when available; a
// deterministic policy is always enforced as guardrails AND as the fallback
// when no LLM key is configured or the model misbehaves.
// ============================================================================
import type { DiscoveryPlatform } from './types'
import { shortenQuery } from './query-planner'

// ── Actions the brain can choose ────────────────────────────────────
export type AgentAction =
  // Expand from the best accounts found so far via the platform's
  // "similar accounts" graph — highest quality, lowest duplication.
  | { type: 'snowball'; seeds: string[]; reason: string }
  // Try a fresh set of short search-box terms in the same segment.
  | { type: 'refine_queries'; queries: string[]; hashtags: string[]; reason: string }
  // Loosen the follower floor once to surface more of the long tail.
  | { type: 'broaden'; minFollowers: number; reason: string }
  // Move to a different category/city — the current one is mined dry.
  | { type: 'switch_segment'; category: string; city: string; reason: string }
  // Done: target reached, budget spent, or diminishing returns.
  | { type: 'stop'; reason: string }

export type AgentActionType = AgentAction['type']

export interface RoundStat {
  /** Which action produced this round (e.g. 'snowball', 'refine_queries'). */
  action: string
  /** New qualified personal creator accounts kept this round. */
  kept: number
  /** Total profiles examined this round (kept + rejected + duplicates). */
  seen: number
  /** Profiles already known/seen before (skipped). */
  duplicates: number
}

export interface TopAccount {
  username: string
  followers: number
  score?: number
  persona?: string
}

export interface AgentState {
  goal: {
    targetCount: number
    minFollowers: number
    platform: DiscoveryPlatform
    /** Personas worth keeping, e.g. influencer/celebrity/artist/actor/athlete. */
    personas?: string[]
  }
  segment: { category: string; city: string }
  totals: { kept: number; seen: number; rounds: number }
  history: RoundStat[]
  frontier: {
    /** Short search-box terms not yet tried. */
    queries: string[]
    /** Top-account usernames available to snowball from (not yet expanded). */
    seedAccounts: string[]
  }
  topAccounts: TopAccount[]
  /** "category|city" segments already exhausted, to avoid re-mining. */
  exhaustedSegments?: string[]
  /** Other segments the agent may switch to (autonomous mode). */
  candidateSegments?: { category: string; city: string }[]
}

// ── Tunables ────────────────────────────────────────────────────────
const MAX_ROUNDS = Number(process.env.AGENT_MAX_ROUNDS) || 14
// Below this many new keeps, a round is "low yield".
const LOW_YIELD = Number(process.env.AGENT_LOW_YIELD) || 3
// Consecutive low-yield rounds before we abandon the current segment.
const STALL_ROUNDS = Number(process.env.AGENT_STALL_ROUNDS) || 2
// How far the follower floor may be lowered by broaden, and the step.
const MIN_FOLLOWER_FLOOR = Number(process.env.AGENT_MIN_FOLLOWER_FLOOR) || 1000

// ============================================================================
// decideNextAction — the entry point. Guardrails first, then LLM, then policy.
// ============================================================================
export async function decideNextAction(state: AgentState): Promise<AgentAction> {
  // 1) Hard guardrails — always win, regardless of what an LLM might say.
  const guard = hardStop(state)
  if (guard) return guard

  // 2) Let an LLM choose if one is configured; validate strictly.
  const llm = await llmDecide(state).catch(() => null)
  if (llm && isExecutable(llm, state)) return llm

  // 3) Deterministic policy — the always-available fallback.
  return policyDecide(state)
}

// ── 1) Guardrails ───────────────────────────────────────────────────
function hardStop(state: AgentState): AgentAction | null {
  if (state.totals.kept >= state.goal.targetCount) {
    return { type: 'stop', reason: `Target reached: ${state.totals.kept}/${state.goal.targetCount} kept.` }
  }
  if (state.totals.rounds >= MAX_ROUNDS) {
    return { type: 'stop', reason: `Round budget exhausted (${MAX_ROUNDS} rounds).` }
  }
  return null
}

// ── 3) Deterministic policy ─────────────────────────────────────────
// Priority: snowball from fresh top accounts > refine queries > broaden once >
// switch segment > stop. This mirrors the highest-ROI ordering (the similar-
// accounts graph yields the least-duplicated, highest-quality creators).
export function policyDecide(state: AgentState): AgentAction {
  const freshSeeds = pickSeeds(state)
  if (freshSeeds.length) {
    return {
      type: 'snowball',
      seeds: freshSeeds,
      reason: `Expanding from ${freshSeeds.length} top account(s) via the similar-accounts graph.`,
    }
  }

  const stalled = isStalled(state)

  if (!stalled && state.frontier.queries.length) {
    return {
      type: 'refine_queries',
      queries: state.frontier.queries.slice(0, 12).map(shortenQuery).filter(Boolean),
      hashtags: [],
      reason: 'Trying remaining search terms in the current segment.',
    }
  }

  // Stalled: try lowering the follower floor once before abandoning the segment.
  if (stalled && state.goal.minFollowers > MIN_FOLLOWER_FLOOR && !broadenedAlready(state)) {
    const lowered = Math.max(MIN_FOLLOWER_FLOOR, Math.floor(state.goal.minFollowers / 2))
    return {
      type: 'broaden',
      minFollowers: lowered,
      reason: `Low yield — lowering follower floor ${state.goal.minFollowers} → ${lowered} to reach the long tail.`,
    }
  }

  // Move to the next unexhausted segment if we have candidates (autonomous mode).
  const next = nextSegment(state)
  if (next) {
    return {
      type: 'switch_segment',
      category: next.category,
      city: next.city,
      reason: `Segment "${state.segment.category}/${state.segment.city}" is mined dry — moving to "${next.category}/${next.city}".`,
    }
  }

  return { type: 'stop', reason: 'No fresh seeds, no remaining queries, and no segments left.' }
}

// ── Policy helpers ──────────────────────────────────────────────────
/** Top accounts not yet snowballed, best-first, capped for a single round. */
function pickSeeds(state: AgentState): string[] {
  const seeds = state.frontier.seedAccounts
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(seeds)].slice(0, 5)
}

function isStalled(state: AgentState): boolean {
  const recent = state.history.slice(-STALL_ROUNDS)
  if (recent.length < STALL_ROUNDS) return false
  return recent.every((r) => r.kept < LOW_YIELD)
}

function broadenedAlready(state: AgentState): boolean {
  return state.history.some((r) => r.action === 'broaden')
}

function nextSegment(state: AgentState): { category: string; city: string } | null {
  const exhausted = new Set([
    ...(state.exhaustedSegments || []),
    segKey(state.segment.category, state.segment.city),
  ])
  for (const seg of state.candidateSegments || []) {
    if (!exhausted.has(segKey(seg.category, seg.city))) return seg
  }
  return null
}

function segKey(category: string, city: string) {
  return `${category}|${city}`.toLowerCase()
}

/** A returned action is only usable if it carries the data needed to execute it. */
function isExecutable(action: AgentAction, state: AgentState): boolean {
  switch (action.type) {
    case 'snowball':
      return Array.isArray(action.seeds) && action.seeds.length > 0
    case 'refine_queries':
      return Array.isArray(action.queries) && action.queries.length > 0
    case 'broaden':
      return (
        typeof action.minFollowers === 'number' &&
        action.minFollowers >= MIN_FOLLOWER_FLOOR &&
        action.minFollowers < state.goal.minFollowers
      )
    case 'switch_segment':
      return Boolean(action.category && action.city)
    case 'stop':
      return true
    default:
      return false
  }
}

// ============================================================================
// 2) LLM decision — OpenRouter → Gemini, tolerant JSON, strict validation.
// ============================================================================
const BRAIN_INSTRUCTION =
  'You are the controller of an autonomous agent that discovers REAL Saudi creator ' +
  'accounts (influencers, celebrities, artists, actors, athletes, musicians) — never ' +
  'businesses, shops, or news pages. Given the current run state, choose the SINGLE ' +
  'best next action to maximise NEW high-quality unique creators while avoiding ' +
  'duplicates. Prefer "snowball" from the best accounts (the similar-accounts graph ' +
  'gives the least-duplicated, highest-quality leads) when fresh seeds exist. Use ' +
  '"refine_queries" with SHORT 2–4 word Instagram search terms (mix Arabic + English, ' +
  'never sentences) when seeds are exhausted. Use "broaden" to lower the follower floor ' +
  'only when yield stalls. Use "switch_segment" when the current category/city is dry. ' +
  'Use "stop" when the target is met or returns clearly diminish. ' +
  'Respond ONLY with JSON of one of these shapes: ' +
  '{"type":"snowball","seeds":string[],"reason":string} | ' +
  '{"type":"refine_queries","queries":string[],"hashtags":string[],"reason":string} | ' +
  '{"type":"broaden","minFollowers":number,"reason":string} | ' +
  '{"type":"switch_segment","category":string,"city":string,"reason":string} | ' +
  '{"type":"stop","reason":string}.'

async function llmDecide(state: AgentState): Promise<AgentAction | null> {
  const provider = selectProvider()
  if (!provider) return null

  const payload = JSON.stringify({
    goal: state.goal,
    segment: state.segment,
    totals: state.totals,
    recentRounds: state.history.slice(-4),
    availableSeeds: state.frontier.seedAccounts.slice(0, 10),
    remainingQueries: state.frontier.queries.slice(0, 12),
    topAccounts: state.topAccounts.slice(0, 8),
    candidateSegments: (state.candidateSegments || []).slice(0, 8),
    exhaustedSegments: state.exhaustedSegments || [],
    limits: { maxRounds: MAX_ROUNDS, minFollowerFloor: MIN_FOLLOWER_FLOOR },
  })

  const text =
    provider === 'openrouter' ? await callOpenRouter(payload) : await callGemini(payload)
  if (!text) return null
  const parsed = parseJsonLoose(text)
  return normalizeAction(parsed, state)
}

type RawAction = Record<string, unknown>

/** Coerce loosely-typed model JSON into a validated AgentAction (or null). */
function normalizeAction(raw: RawAction | null, state: AgentState): AgentAction | null {
  if (!raw || typeof raw !== 'object') return null
  const type = String(raw.type || '').trim()
  const reason = String(raw.reason || '').slice(0, 300) || 'LLM decision'
  const asStrings = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []

  switch (type) {
    case 'snowball':
      return { type, seeds: asStrings(raw.seeds).map((s) => s.toLowerCase()).slice(0, 5), reason }
    case 'refine_queries':
      return {
        type,
        queries: asStrings(raw.queries).map(shortenQuery).filter(Boolean).slice(0, 12),
        hashtags: asStrings(raw.hashtags).map((h) => h.replace(/^#/, '')).slice(0, 8),
        reason,
      }
    case 'broaden': {
      const n = Number(raw.minFollowers)
      if (!Number.isFinite(n)) return null
      return { type, minFollowers: Math.max(MIN_FOLLOWER_FLOOR, Math.floor(n)), reason }
    }
    case 'switch_segment':
      return { type, category: String(raw.category || ''), city: String(raw.city || ''), reason }
    case 'stop':
      return { type, reason }
    default:
      return null
  }
}

// ── LLM transport (kept self-contained to avoid touching the planner) ──
type Provider = 'openrouter' | 'gemini'
function selectProvider(): Provider | null {
  const forced = (process.env.PLANNER_PROVIDER || 'auto').toLowerCase()
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY)
  const hasGemini = Boolean(process.env.GEMINI_API_KEY)
  if (forced === 'openrouter') return hasOpenRouter ? 'openrouter' : null
  if (forced === 'gemini') return hasGemini ? 'gemini' : null
  if (hasOpenRouter) return 'openrouter'
  if (hasGemini) return 'gemini'
  return null
}

async function callOpenRouter(userPayload: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free'
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL
  if (process.env.OPENROUTER_APP_NAME) headers['X-Title'] = process.env.OPENROUTER_APP_NAME

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: BRAIN_INSTRUCTION },
        { role: 'user', content: userPayload },
      ],
      max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS) || 1024,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(45_000),
    cache: 'no-store',
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error?.message || 'OpenRouter decision failed')
  const text = payload?.choices?.[0]?.message?.content
  return typeof text === 'string' && text.trim() ? text : null
}

async function callGemini(userPayload: string): Promise<string | null> {
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
        system_instruction: { parts: [{ text: BRAIN_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: userPayload }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    }
  )
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error?.message || 'Gemini decision failed')
  return ((payload?.candidates || [])[0]?.content?.parts || [])
    .map((part: { text?: string }) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
}

/** Extract a JSON object from model text that may be fenced or wrapped in prose. */
function parseJsonLoose(text: string): RawAction | null {
  let raw = text.trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1)
  try {
    return JSON.parse(raw) as RawAction
  } catch {
    return null
  }
}
