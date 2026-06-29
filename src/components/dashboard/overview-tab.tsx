'use client'

import { Activity, Flame, Layers, Loader2, Target, TrendingUp, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { useDashboardStats } from '@/lib/use-supabase'

const funnelColors = ['#7e22ce', '#9333ea', '#0891b2', '#2563eb', '#10b981', '#22c55e']

export function OverviewTab() {
  const { stats, loading, dbReady } = useDashboardStats()

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!dbReady || !stats) {
    return (
      <EmptyState
        title="Database is not ready"
        description="Connect Supabase and run the migration before live metrics can appear."
      />
    )
  }

  const cards = [
    { title: 'Total Creators', value: stats.totalInfluencers, icon: Users },
    { title: 'Total Leads', value: stats.totalLeads, icon: Target },
    { title: 'Hot Leads', value: stats.hotLeads, icon: Flame },
    { title: 'Active Batches', value: stats.activeBatches, icon: Layers },
    { title: 'Response Rate', value: `${stats.responseRate}%`, icon: TrendingUp },
  ]
  const maxCategory = Math.max(0, ...stats.categoryDistribution.map((item: any) => item.count))

  return (
    <div className="space-y-6">
      <div className="text-xs text-emerald-700">Live data from Supabase</div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
                <p className="mt-1 text-2xl font-bold">{Number.isFinite(value) ? value.toLocaleString() : value}</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-2.5 text-purple-700">
                <Icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Acquisition Funnel</CardTitle></CardHeader>
          <CardContent>
            {stats.totalLeads === 0 ? (
              <EmptyBlock text="No leads have been collected yet." />
            ) : (
              <ChartContainer config={{ count: { label: 'Count', color: '#7e22ce' } }} className="h-64">
                <BarChart data={stats.funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.funnelData.map((_: unknown, index: number) => (
                      <Cell key={index} fill={funnelColors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Category Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.categoryDistribution.length === 0 ? (
              <EmptyBlock text="No creator categories are available yet." />
            ) : stats.categoryDistribution.map((item: any) => (
              <div key={item.category}>
                <div className="flex justify-between text-xs">
                  <span>{item.category}</span>
                  <span>{item.count.toLocaleString()}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-purple-600"
                    style={{ width: `${maxCategory ? (item.count / maxCategory) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4 text-purple-700" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentActivity.length === 0 ? (
              <EmptyBlock text="No system activity has been recorded yet." />
            ) : stats.recentActivity.map((item: any) => (
              <div key={item.id} className="rounded-lg border p-3">
                <p className="text-xs">{item.message}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{item.timestamp}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="flex min-h-40 items-center justify-center text-center text-sm text-muted-foreground">{text}</div>
}
