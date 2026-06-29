import { NextResponse } from 'next/server'
import { z } from 'zod'

// ── Shared response helpers ─────────────────────────────────────────
/** 400 with the first validation issue (safe to expose — it's about the request). */
export function badRequest(error: z.ZodError) {
  const first = error.issues[0]
  const path = first?.path.join('.') || 'body'
  return NextResponse.json(
    { error: `Invalid request: ${path} — ${first?.message || 'validation failed'}` },
    { status: 400 }
  )
}

/**
 * 500 that does NOT leak internal/DB error text to the client. The real error is
 * logged server-side; the client gets a generic message.
 */
export function serverError(error: unknown, context: string) {
  console.error(`[${context}]`, error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

// ── Request body schemas ────────────────────────────────────────────
export const leadCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(100).optional(),
})

export const taskCreateSchema = z.object({
  agent_type: z.string().trim().max(64).optional(),
  task_name: z.string().trim().max(200).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  input_data: z.unknown().optional(),
})

export const qualifySchema = z.object({
  niche: z.string().trim().max(120).optional(),
  profiles: z
    .array(
      z.object({
        username: z.string().trim().min(1).max(100),
        fullName: z.string().max(200).optional(),
        bio: z.string().max(3000).optional(),
        category: z.string().max(200).optional(),
        followers: z.number().int().min(0).optional(),
        engagementRate: z.number().min(0).nullish(),
        captions: z.array(z.string().max(600)).max(12).optional(),
        images: z.array(z.string().max(500000)).max(4).optional(), // http or data URLs
      })
    )
    .min(1)
    .max(12),
})

export const knownSchema = z.object({
  usernames: z.array(z.string().trim().max(100)).min(1).max(300),
  // Treat a saved profile as "known" (skip) only if synced within this many
  // days; older ones are re-visited to refresh their data. 0 = always known.
  freshDays: z.number().int().min(0).max(365).optional(),
})

// Adaptive agent brain: the caller (extension or server worker) sends the
// current run state and gets back ONE next action to execute.
const roundStatSchema = z.object({
  action: z.string().max(40),
  kept: z.number().int().min(0),
  seen: z.number().int().min(0),
  duplicates: z.number().int().min(0),
})
export const decideSchema = z.object({
  goal: z.object({
    targetCount: z.number().int().min(1).max(5000),
    minFollowers: z.number().int().min(0),
    platform: z.enum(['instagram', 'tiktok']),
    personas: z.array(z.string().max(40)).max(12).optional(),
  }),
  segment: z.object({
    category: z.string().trim().max(100),
    city: z.string().trim().max(100),
  }),
  totals: z.object({
    kept: z.number().int().min(0),
    seen: z.number().int().min(0),
    rounds: z.number().int().min(0),
  }),
  history: z.array(roundStatSchema).max(50).default([]),
  frontier: z.object({
    queries: z.array(z.string().max(120)).max(60).default([]),
    seedAccounts: z.array(z.string().max(100)).max(60).default([]),
  }),
  topAccounts: z
    .array(
      z.object({
        username: z.string().max(100),
        followers: z.number().int().min(0),
        score: z.number().nullish(),
        persona: z.string().max(40).optional(),
      })
    )
    .max(60)
    .default([]),
  exhaustedSegments: z.array(z.string().max(220)).max(100).optional(),
  candidateSegments: z
    .array(z.object({ category: z.string().max(100), city: z.string().max(100) }))
    .max(60)
    .optional(),
})

export const planRequestSchema = z.object({
  category: z.string().trim().max(100).default('Other'),
  city: z.string().trim().max(100).default('All'),
  minFollowers: z.number().int().min(0).optional(),
  targetCount: z.number().int().min(1).max(200).optional(),
  extraKeywords: z.string().trim().max(500).optional(),
})

const ingestProfileSchema = z.object({
  platform: z.enum(['instagram', 'tiktok']).optional(),
  username: z.string().trim().min(1).max(100),
  full_name: z.string().max(200).optional(),
  biography: z.string().max(3000).optional(),
  followers: z.number().int().min(0).optional(),
  following: z.number().int().min(0).optional(),
  posts: z.number().int().min(0).optional(),
  is_verified: z.boolean().optional(),
  is_private: z.boolean().optional(),
  is_business: z.boolean().optional(),
  category: z.string().max(200).optional(),
  website: z.string().max(500).nullish(),
  profile_pic_url: z.string().max(1000).nullish(),
  email: z.string().max(320).nullish(),
  avg_likes: z.number().min(0).nullish(),
  avg_comments: z.number().min(0).nullish(),
  engagement_rate: z.number().min(0).nullish(),
  posts_sampled: z.number().int().min(0).optional(),
  persona: z.string().max(60).optional(),
  qualify_reason: z.string().max(300).optional(),
})

export const ingestSchema = z.object({
  platform: z.enum(['instagram', 'tiktok']).default('instagram'),
  category: z.string().trim().max(100).default('Other'),
  city: z.string().trim().max(100).default('All'),
  minFollowers: z.number().int().min(0).optional(),
  candidates: z.array(ingestProfileSchema).min(1).max(200),
})

export const outreachActionSchema = z.object({
  action: z.enum(['approve', 'send', 'edit', 'reject', 'create']),
  conversationId: z.string().trim().max(64).optional(),
  messageId: z.string().trim().max(64).optional(),
  body: z.string().max(5000).optional(),
  feedback: z.string().max(2000).optional(),
  complianceChecks: z.unknown().optional(),
})
