'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  XCircle,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  createDiscoveryBatch,
  getAgentDecisions,
  getDiscoveryBatches,
  getDiscoveryConfig,
  runDiscoveryBatch,
  syncDiscoveryBatch,
  type AgentDecision,
} from '@/lib/api'
import {
  CATEGORIES,
  CITIES,
  getBatchStatusColor,
  type DiscoveryBatch,
} from '@/lib/domain-types'
import { AgentControlPanel } from './agent-control-panel'
import { LiveMonitor } from './live-monitor'

type DiscoveryConfig = Awaited<ReturnType<typeof getDiscoveryConfig>>

export function DiscoveryTab() {
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [platforms] = useState('instagram')
  const [target, setTarget] = useState('500')
  const [minFollowers, setMinFollowers] = useState('20000')
  const [keywords, setKeywords] = useState('')
  const [batches, setBatches] = useState<DiscoveryBatch[]>([])
  const [decisions, setDecisions] = useState<AgentDecision[]>([])
  const [config, setConfig] = useState<DiscoveryConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [batchData, providerConfig, decisionData] = await Promise.all([
        getDiscoveryBatches(),
        getDiscoveryConfig(),
        getAgentDecisions(20).catch(() => []),
      ])
      setBatches(batchData)
      setConfig(providerConfig)
      setDecisions(decisionData)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load discovery')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // Keep the Agent Brain panel live even when no batches are actively syncing.
  useEffect(() => {
    const interval = window.setInterval(() => {
      void getAgentDecisions(20)
        .then(setDecisions)
        .catch(() => {})
    }, 20000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const activeIds = batches
      .filter((batch) => batch.status === 'Searching' || batch.status === 'Processing')
      .map((batch) => batch.id)

    if (activeIds.length === 0) return

    const interval = window.setInterval(() => {
      void Promise.all(activeIds.map((id) => syncDiscoveryBatch(id)))
        .then(() => fetchData())
        .catch((syncError) => {
          setError(syncError instanceof Error ? syncError.message : 'Automatic sync failed')
        })
    }, 15000)

    return () => window.clearInterval(interval)
  }, [batches, fetchData])

  async function handleCreate() {
    if (!category || !city || !platforms) {
      setError('Choose a category, city, and platform first.')
      return
    }

    setCreating(true)
    setError('')
    try {
      await createDiscoveryBatch({
        name: `${city} ${category} Creator Discovery`,
        platforms,
        niches: category,
        keywords,
        location_filter: city,
        min_followers: Number(minFollowers) || 20000,
        target_count: Number(target) || 500,
      })
      await fetchData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create search plan')
    } finally {
      setCreating(false)
    }
  }

  async function handleRun(batchId: string) {
    setBusyId(batchId)
    setError('')
    try {
      await runDiscoveryBatch(batchId)
      await fetchData()
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to start discovery')
    } finally {
      setBusyId('')
    }
  }

  async function handleSync(batchId: string) {
    setBusyId(batchId)
    setError('')
    try {
      await syncDiscoveryBatch(batchId)
      await fetchData()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Failed to sync discovery')
    } finally {
      setBusyId('')
    }
  }


  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const discoveryReady = config?.discoverySource.configured === true
  const activeSource = config?.discoverySource.active ?? 'self_scrape'
  const sourceLabel =
    activeSource === 'apify'
      ? 'Apify'
      : activeSource === 'browser_session'
        ? 'Stealth browser agent'
        : 'Self-hosted scraping'
  const activeCount = batches.filter(
    (batch) => batch.status === 'Searching' || batch.status === 'Processing'
  ).length

  return (
    <div className="space-y-6">
      {!discoveryReady && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="text-amber-700" />
          <AlertTitle>Discovery source is planned but not connected</AlertTitle>
          <AlertDescription>
            {activeSource === 'apify' ? (
              <>Add <code>APIFY_TOKEN</code> to <code>.env</code>.</>
            ) : activeSource === 'browser_session' ? (
              <>Start the <code>instagram-agent</code> service{' '}
                (<code>docker compose --profile browser-agent up -d</code>).</>
            ) : (
              <>Start <code>Crawl4AI</code> or <code>Scrapling</code> and set their URLs in{' '}
                <code>.env</code> (run <code>bun run docker:up</code>).</>
            )}{' '}
            You can create and inspect AI search plans now, but provider runs stay disabled
            until the source is available.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Discovery action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard
          icon={Search}
          label="Search Provider"
          value={discoveryReady ? `${sourceLabel} ready` : `${sourceLabel} not connected`}
          tone={discoveryReady ? 'ready' : 'warning'}
        />
        <StatusCard
          icon={Settings2}
          label="Query Planner"
          value={config?.providers.aiPlanner.mode || 'deterministic-template'}
          tone="ready"
        />
        <StatusCard
          icon={Layers}
          label="Active Pipelines"
          value={`${activeCount} running`}
          tone="neutral"
        />
      </div>

      <LiveMonitor />

      <AgentControlPanel />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bot className="size-4 text-primary" />
            Agent Brain — live decisions
            <Badge variant="outline" className="ml-1 font-normal">
              Plan → Act → Observe → Decide
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No decisions yet. When the autonomous agent runs, each segment choice
              (and why) shows up here in real time.
            </p>
          ) : (
            <ol className="relative space-y-3 border-l pl-5">
              {decisions.map((d) => (
                <li key={d.id} className="relative">
                  <span className="absolute -left-[23px] top-1 size-2.5 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    {d.category && d.city && (
                      <Badge variant="secondary" className="font-normal">
                        {d.category} · {d.city}
                      </Badge>
                    )}
                    {typeof d.minFollowers === 'number' && (
                      <Badge variant="outline" className="font-normal">
                        ≥ {d.minFollowers.toLocaleString()} followers
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatAgentTime(d.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{d.reason || d.message}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Layers className="size-4 text-primary" />
                Creator Discovery Pipelines
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Search queries → profile discovery → filtering → deduplication → scoring → leads
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchData()}>
              <RefreshCw className="mr-2 size-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Search Plan</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Current Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                    Create the first market discovery plan.
                  </TableCell>
                </TableRow>
              )}
              {batches.map((batch) => {
                const progress =
                  batch.target > 0 ? Math.min(100, (batch.found / batch.target) * 100) : 0
                const isBusy = busyId === batch.id
                const canStart =
                  batch.status === 'Planned' || batch.status === 'Failed'
                const canSync =
                  batch.status === 'Searching' || batch.status === 'Processing'

                return (
                  <TableRow key={batch.id}>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium">{batch.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {batch.queries?.slice(0, 3).map((query) => (
                          <Badge key={query} variant="outline" className="max-w-40 truncate text-[9px]">
                            {query}
                          </Badge>
                        ))}
                        {(batch.queries?.length || 0) > 3 && (
                          <Badge variant="secondary" className="text-[9px]">
                            +{(batch.queries?.length || 0) - 3} queries
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{batch.platform}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {batch.city} · {batch.category}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Target {batch.target.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-40">
                      <Progress value={progress} className="h-2" />
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {batch.found} found · {batch.leadsCreated || 0} leads
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 text-xs text-muted-foreground">
                      {batch.currentStep || 'Search plan ready'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getBatchStatusColor(batch.status)}`}
                      >
                        <StatusIcon status={batch.status} />
                        {batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canStart && (
                        <Button
                          size="sm"
                          disabled={!discoveryReady || isBusy}
                          onClick={() => void handleRun(batch.id)}
                        >
                          {isBusy ? (
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                          ) : (
                            <Play className="mr-2 size-3.5" />
                          )}
                          Start Search
                        </Button>
                      )}
                      {canSync && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleSync(batch.id)}
                        >
                          {isBusy ? (
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 size-3.5" />
                          )}
                          Sync Results
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="size-4 text-primary" />
            Build a New AI Search Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Choose creator category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="City">
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger><SelectValue placeholder="Choose market city" /></SelectTrigger>
                <SelectContent>
                  {CITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Search Platforms">
              <Input value="Instagram only" disabled />
            </Field>
            <Field label="Target Qualified Profiles">
              <Input type="number" min="1" value={target} onChange={(event) => setTarget(event.target.value)} />
            </Field>
            <Field label="Minimum Followers">
              <Input type="number" min="0" value={minFollowers} onChange={(event) => setMinFollowers(event.target.value)} />
            </Field>
            <Field label="Extra Keywords (optional)">
              <Input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="micro influencer, مطاعم جديدة"
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              The planner expands this brief into Arabic and English creator searches. Starting the
              plan later sends those queries to platform search Actors.
            </p>
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
              Create Search Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function StatusCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Search
  label: string
  value: string
  tone: 'ready' | 'warning' | 'neutral'
}) {
  const colors = {
    ready: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    neutral: 'bg-purple-50 text-purple-700',
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${colors[tone]}`}><Icon className="size-4" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-sm font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusIcon({ status }: { status: DiscoveryBatch['status'] }) {
  if (status === 'Searching') return <Loader2 className="mr-1 size-3 animate-spin" />
  if (status === 'Processing') return <RefreshCw className="mr-1 size-3" />
  if (status === 'Completed') return <CheckCircle2 className="mr-1 size-3" />
  if (status === 'Failed') return <XCircle className="mr-1 size-3" />
  return <Clock className="mr-1 size-3" />
}

function formatAgentTime(value?: string) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
