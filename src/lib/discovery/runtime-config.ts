// ============================================================================
// Risha 360 — Runtime config resolver.
// ----------------------------------------------------------------------------
// Lets the user control LLM keys/models from the dashboard (stored in
// discovery_agent_settings) instead of only .env. Call applyAgentConfig() at
// the start of any server entry point that will reach the planner / qualifier /
// agent brain; it copies non-empty DB values into process.env so every existing
// `process.env.OPENROUTER_API_KEY`-style read transparently picks them up.
//
// Safe because discovery_agent_settings is a SINGLETON row — all requests share
// the same config, so there is no per-request race on process.env.
// ============================================================================
import type { DiscoveryAgentSettings } from './types'

type ConfigKeys = Partial<{
  openrouter_api_key: string | null
  openrouter_model: string | null
  openrouter_vision_model: string | null
  gemini_api_key: string | null
  gemini_model: string | null
  planner_provider: string | null
}>

const MAP: Record<keyof ConfigKeys, string> = {
  openrouter_api_key: 'OPENROUTER_API_KEY',
  openrouter_model: 'OPENROUTER_MODEL',
  openrouter_vision_model: 'OPENROUTER_VISION_MODEL',
  gemini_api_key: 'GEMINI_API_KEY',
  gemini_model: 'GEMINI_DISCOVERY_MODEL',
  planner_provider: 'PLANNER_PROVIDER',
}

/** DB-stored keys/models override .env when present (non-empty). */
export function applyAgentConfig(settings: ConfigKeys | DiscoveryAgentSettings | null | undefined) {
  if (!settings) return
  for (const [col, envName] of Object.entries(MAP)) {
    const value = (settings as Record<string, unknown>)[col]
    if (typeof value === 'string' && value.trim()) {
      process.env[envName] = value.trim()
    }
  }
}
