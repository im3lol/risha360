'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Key, Loader2, RefreshCw, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatabaseSetup } from '@/components/dashboard/database-setup'
import { AgentControlPanel } from '@/components/dashboard/agent-control-panel'
import { getDiscoveryConfig } from '@/lib/api'

export function SettingsTab() {
  const [config, setConfig] = useState<Awaited<ReturnType<typeof getDiscoveryConfig>> | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setConfig(await getDiscoveryConfig())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">System Configuration</h3>
          <p className="text-sm text-muted-foreground">
            This page reports server configuration only. Secrets are never displayed in the browser.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-3.5" />
          Refresh
        </Button>
      </div>

      <AgentControlPanel />

      <DatabaseSetup />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Key className="size-4 text-purple-700" />
            Provider Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Provider
                name={`Discovery Source: ${
                  config?.discoverySource.active === 'apify'
                    ? 'Apify'
                    : config?.discoverySource.active === 'browser_session'
                      ? 'Stealth browser agent'
                      : 'Self-hosted scraping'
                }`}
                configured={config?.discoverySource.configured === true}
                details={
                  config?.discoverySource.active === 'apify'
                    ? 'Paid Apify search actors'
                    : config?.discoverySource.active === 'browser_session'
                      ? 'Camoufox stealth browser — real engagement data'
                      : 'Crawl4AI / Scrapling — no paid API'
                }
                variable="DISCOVERY_SOURCE"
              />
              <Provider
                name="AI Query Planner"
                configured={config?.providers.aiPlanner.configured === true}
                details={`${config?.providers.aiPlanner.model || 'gemini'} · ${config?.providers.aiPlanner.mode || 'deterministic'}`}
                variable="GEMINI_API_KEY (optional)"
              />
              <Provider
                name="Apify Search (legacy)"
                configured={config?.providers.apify.configured === true}
                details={`${config?.providers.apify.instagramActor} / ${config?.providers.apify.tiktokActor}`}
                variable="APIFY_TOKEN (only if DISCOVERY_SOURCE=apify)"
              />
              <Provider
                name="Scrapling Extractor"
                configured={config?.providers.scrapling.configured === true}
                details="Deterministic extraction for public HTML pages"
                variable="SCRAPLING_SERVICE_URL"
              />
              <Provider
                name="Crawl4AI Enrichment"
                configured={config?.providers.crawl4ai.configured === true}
                details="Deep crawl and LLM-ready content enrichment"
                variable="CRAWL4AI_BASE_URL"
              />
              <Provider
                name="Browser-use Fallback"
                configured={config?.providers.browserUse.configured === true}
                details="Optional agent for complex interactive pages"
                variable="BROWSER_USE_SERVICE_URL + GEMINI_API_KEY"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Settings className="size-4 text-purple-700" />
            Runtime Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Targeting (country, cities, categories, follower bounds, custom instructions) and LLM keys/models are set in the Agent Control Panel above.</p>
          <p>Only individual people/creators are saved — restaurants, shops, and places are filtered out automatically at save time.</p>
          <p>Duplicate detection uses platform + username, with a 30-day refresh window.</p>
          <p>Outreach requires human approval before a message is marked as sent.</p>
          <p>API keys are stored server-side and never returned to the browser.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Provider({
  name,
  configured,
  details,
  variable,
}: {
  name: string
  configured: boolean
  details: string
  variable: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {configured ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <Clock className="size-4 text-amber-600" />
          )}
          <span className="font-medium">{name}</span>
        </div>
        <Badge variant="outline">{configured ? 'Configured' : 'Not configured'}</Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{details}</p>
      {!configured && <code className="mt-2 block text-xs">{variable}</code>}
    </div>
  )
}
