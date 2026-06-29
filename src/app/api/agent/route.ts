import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import {
  getAgentSettings,
  runAgentTick,
  updateAgentSettings,
} from '@/lib/discovery/orchestrator'
import { getDiscoverySource, isDiscoveryConfigured } from '@/lib/discovery/source'
import { selectPlannerProvider } from '@/lib/discovery/query-planner'
import { applyAgentConfig } from '@/lib/discovery/runtime-config'
import type { DiscoveryAgentSettings } from '@/lib/discovery/types'

// Key columns are never sent to the client — only whether they are set.
const SECRET_COLS = ['openrouter_api_key', 'gemini_api_key'] as const

function maskSettings(settings: DiscoveryAgentSettings) {
  const out: Record<string, unknown> = { ...settings }
  const flags: Record<string, boolean> = {}
  for (const col of SECRET_COLS) {
    flags[`${col}_set`] = Boolean((settings as unknown as Record<string, unknown>)[col])
    delete out[col]
  }
  return { ...out, ...flags }
}

export async function GET(request: NextRequest) {
  const authError = await requireAuthenticatedUser(request)
  if (authError) return authError

  try {
    const settings = await getAgentSettings()
    applyAgentConfig(settings) // DB keys/models take effect for provider checks below
    return NextResponse.json({
      settings: maskSettings(settings),
      providers: {
        discoverySource: getDiscoverySource(),
        discoveryReady: isDiscoveryConfigured(),
        plannerProvider: selectPlannerProvider(),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuthenticatedUser(request)
  if (authError) return authError

  try {
    const body = await request.json()
    if (body.action === 'run_now') {
      applyAgentConfig(await getAgentSettings())
      return NextResponse.json({ result: await runAgentTick() })
    }

    // Partial update — only fields actually present in the body are written, so
    // updating (say) followers never wipes saved API keys or instructions.
    const update: Record<string, unknown> = {}
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

    if (has('enabled')) update.enabled = body.enabled === true
    if (has('interval_minutes')) update.interval_minutes = clamp(body.interval_minutes, 15, 1440, 120)
    if (has('categories')) update.categories = cleanCsv(body.categories)
    if (has('cities')) update.cities = cleanCsv(body.cities)
    if (has('target_count')) update.target_count = clamp(body.target_count, 10, 1000, 100)
    if (has('min_followers')) update.min_followers = clamp(body.min_followers, 0, 50_000_000, 20000)
    if (has('max_active_batches')) update.max_active_batches = clamp(body.max_active_batches, 1, 3, 1)

    // New dashboard-controlled fields.
    if (has('max_followers')) {
      const n = Number(body.max_followers)
      update.max_followers = Number.isFinite(n) && n > 0 ? Math.round(n) : null
    }
    if (has('country')) update.country = String(body.country || 'SA').trim().slice(0, 8) || 'SA'
    if (has('custom_instructions')) update.custom_instructions = String(body.custom_instructions || '').slice(0, 2000)
    if (has('planner_provider')) {
      const p = String(body.planner_provider || 'auto').toLowerCase()
      update.planner_provider = ['auto', 'openrouter', 'gemini'].includes(p) ? p : 'auto'
    }
    if (has('openrouter_model')) update.openrouter_model = strOrNull(body.openrouter_model, 128)
    if (has('openrouter_vision_model')) update.openrouter_vision_model = strOrNull(body.openrouter_vision_model, 128)
    if (has('gemini_model')) update.gemini_model = strOrNull(body.gemini_model, 128)
    // API keys: only overwrite when a non-empty value is supplied (blank = keep).
    if (has('openrouter_api_key') && String(body.openrouter_api_key || '').trim()) {
      update.openrouter_api_key = String(body.openrouter_api_key).trim()
    }
    if (has('gemini_api_key') && String(body.gemini_api_key || '').trim()) {
      update.gemini_api_key = String(body.gemini_api_key).trim()
    }

    const settings = await updateAgentSettings(update)
    return NextResponse.json({ settings: maskSettings(settings) })
  } catch (error) {
    const msg = errorMessage(error)
    // The control-panel columns (API keys, country, instructions, …) come from
    // migration 004. If it hasn't been run yet, give a clear, actionable hint.
    if (/does not exist|column .* of relation|42703/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            'الإعدادات المتقدّمة (مفاتيح API، البلد، التعليمات…) محتاجة تشغّل قاعدة البيانات أولاً: ' +
            'افتح Supabase → SQL Editor وشغّل docs/setup-database.sql (أو migrations/004_agent_control.sql). ' +
            '— Advanced settings need migration 004: run docs/setup-database.sql in the Supabase SQL Editor.',
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}

function cleanCsv(value: unknown) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30).join(',')
}

function strOrNull(value: unknown, max: number) {
  const s = String(value || '').trim().slice(0, max)
  return s || null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Agent configuration failed'
}
