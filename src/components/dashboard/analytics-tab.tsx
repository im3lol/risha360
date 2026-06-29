'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Loader2, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { getCategoryDistribution, getFunnelData } from '@/lib/api'

export function AnalyticsTab() {
  const [funnel, setFunnel] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [funnelData, categoryData] = await Promise.all([
        getFunnelData(),
        getCategoryDistribution(),
      ])
      setFunnel(funnelData)
      setCategories(categoryData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Analytics could not be loaded')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  }

  if (error) {
    return <Empty text={error} />
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="size-4 text-purple-700" />
            Acquisition Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {funnel.every((item) => item.count === 0) ? (
            <Empty text="No lead activity is available yet." />
          ) : (
            <ChartContainer config={{ count: { label: 'Leads', color: '#7e22ce' } }} className="h-72">
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#7e22ce" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="size-4 text-purple-700" />
            Creator Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <Empty text="No creator data is available for analysis." />
          ) : (
            <ChartContainer config={{ count: { label: 'Creators', color: '#9333ea' } }} className="h-72">
              <BarChart data={categories}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {categories.map((_: unknown, index: number) => (
                    <Cell key={index} fill={index % 2 ? '#9333ea' : '#7e22ce'} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="flex min-h-56 items-center justify-center text-center text-sm text-muted-foreground">{text}</div>
}
