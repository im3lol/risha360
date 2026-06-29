'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Cpu, Loader2, RefreshCw, Server, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAgentTasks, getDiscoveryConfig } from '@/lib/api'
import {
  getPriorityBadgeColor,
  getTaskStatusColor,
  type AgentTask,
} from '@/lib/domain-types'

export function AgentTab() {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [config, setConfig] = useState<Awaited<ReturnType<typeof getDiscoveryConfig>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [taskData, providerConfig] = await Promise.all([
        getAgentTasks(),
        getDiscoveryConfig(),
      ])
      setTasks(taskData)
      setConfig(providerConfig)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Agent data could not be loaded')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const counts = {
    running: tasks.filter((task) => task.status === 'Running').length,
    pending: tasks.filter((task) => task.status === 'Pending').length,
    completed: tasks.filter((task) => task.status === 'Completed').length,
    failed: tasks.filter((task) => task.status === 'Failed').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <IntegrationCard
          name="Creator Discovery"
          configured={config?.discoverySource.configured === true}
          description={
            config?.discoverySource.active === 'apify'
              ? 'Instagram + TikTok search via Apify'
              : config?.discoverySource.active === 'browser_session'
                ? 'Instagram + TikTok discovery via stealth browser agent'
                : 'Instagram + TikTok via self-hosted scraping & extension'
          }
        />
        <IntegrationCard
          name="Agent Brain"
          configured
          description={`Adaptive loop (snowball / refine / broaden) — ${
            config?.providers.aiPlanner.configured
              ? `LLM-driven via ${config?.providers.aiPlanner.provider || 'OpenRouter'}`
              : 'deterministic policy'
          }`}
        />
        <IntegrationCard
          name="Query Planner"
          configured
          description={config?.providers.aiPlanner.mode || 'Deterministic bilingual planner'}
        />
        <IntegrationCard
          name="Scraping Pipeline"
          configured={tasks.length > 0}
          description={tasks.length > 0 ? 'Profile scraping and sales routing task log is active' : 'No workflow executions recorded'}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            Adaptive Acquisition Workflow
            <Badge variant="outline" className="font-normal">
              Plan → Act → Observe → Decide
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ['1', 'Plan', 'AI plans SHORT Saudi search keywords (Arabic + English).', false],
              ['2', 'Discover', 'Verified-first search + Instagram/TikTok similar-accounts graph.', false],
              ['3', 'Visit & Qualify', 'Visit each profile; vision-AI keeps real creators, rejects shops/pages.', false],
              ['4', 'Observe', 'Measure the round: new unique creators, duplicates, engagement.', false],
              ['5', 'Decide', 'The brain picks the next move — snowball / refine / broaden — and loops.', true],
              ['6', 'Save & Assign', 'Score, dedup, then route the qualified lead to the least-loaded sales agent.', false],
            ].map(([number, title, description, isBrain]) => (
              <div
                key={number as string}
                className={`rounded-lg border p-3 ${isBrain ? 'border-primary/40 bg-primary/5' : ''}`}
              >
                <div
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                    isBrain ? 'bg-purple-700 text-white' : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {number as string}
                </div>
                <div className="mt-2 text-sm font-semibold">{title as string}</div>
                <p className="mt-1 text-xs text-muted-foreground">{description as string}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Steps 2–5 repeat each round: the agent keeps expanding from the best
            accounts until it hits the target or returns diminish — then stops on its own.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Object.entries(counts).map(([label, count]) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs capitalize text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Cpu className="size-4 text-purple-700" />
            Agent Task Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="size-7 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="flex h-48 items-center justify-center text-sm text-destructive">{error}</div>
          ) : tasks.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <Server className="mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">No agent executions yet</p>
              <p className="text-xs text-muted-foreground">Tasks will appear after a real discovery run starts.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="font-medium">{task.taskType}</div>
                      <div className="max-w-md text-xs text-muted-foreground">{task.details}</div>
                      {task.error && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="size-3" />
                          {task.error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{task.agent}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTaskStatusColor(task.status)}>
                        <TaskIcon status={task.status} />
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getPriorityBadgeColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{task.created}</TableCell>
                    <TableCell className="text-xs">{task.duration}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function IntegrationCard({
  name,
  configured,
  description,
}: {
  name: string
  configured: boolean
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`rounded-lg p-2 ${configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {configured ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
        </div>
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          <Badge variant="outline" className="mt-2 text-[9px]">
            {configured ? 'Configured' : 'Not configured'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function TaskIcon({ status }: { status: AgentTask['status'] }) {
  if (status === 'Running') return <Loader2 className="mr-1 size-3 animate-spin" />
  if (status === 'Completed') return <CheckCircle2 className="mr-1 size-3" />
  if (status === 'Failed') return <XCircle className="mr-1 size-3" />
  return <Clock className="mr-1 size-3" />
}
