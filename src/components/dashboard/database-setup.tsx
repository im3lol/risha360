'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Database, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'

export function DatabaseSetup() {
  const [status, setStatus] = useState<{
    dbReady: boolean
    writeReady: boolean
    influencerCount: number
    message?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  async function checkStatus() {
    setLoading(true)
    try {
      setStatus(await apiFetch<{
        dbReady: boolean
        writeReady: boolean
        influencerCount: number
        message?: string
      }>('/api/setup'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void checkStatus() }, [])

  if (loading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10">
        <Loader2 className="mr-2 size-5 animate-spin text-primary" />
        Checking Supabase...
      </CardContent></Card>
    )
  }

  if (status?.dbReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="size-4 text-purple-700" />
            Supabase Database
            <Badge className="bg-emerald-100 text-emerald-700">Connected</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" />
            Database schema is ready.
          </div>
          <p className="text-xs text-muted-foreground">
            Live creators: {status.influencerCount || 0}. Only persisted records are shown.
          </p>
          {!status.writeReady && (
            <Alert>
              <AlertTitle>Read-only mode</AlertTitle>
              <AlertDescription>Add SUPABASE_SERVICE_ROLE_KEY to enable server writes.</AlertDescription>
            </Alert>
          )}
          <Button variant="outline" size="sm" onClick={() => void checkStatus()}>
            <RefreshCw className="mr-2 size-3.5" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="size-4 text-purple-700" />
          Database Setup Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>Schema not found</AlertTitle>
          <AlertDescription>{status?.message || 'Run the migration in Supabase SQL Editor.'}</AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://supabase.com/dashboard/project/lklbdjwslwyhndmfzkta/sql" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 size-3.5" />
              Open SQL Editor
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
