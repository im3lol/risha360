'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getLiveActivity, type LiveActivity } from '@/lib/api'

// Live, human-readable monitor: shows whether the agent is working right now,
// the current step, and a streaming log of what it's doing. Polls every 3s.
export function LiveMonitor() {
  const [data, setData] = useState<LiveActivity | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await getLiveActivity(30)
      setData(d)
    } catch {
      /* keep last snapshot */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => { void load() }, 3000)
    return () => window.clearInterval(id)
  }, [load])

  if (!loaded || !data) {
    return (
      <Card><CardContent className="flex h-24 items-center justify-center p-4">
        <Loader2 className="size-5 animate-spin text-primary" />
      </CardContent></Card>
    )
  }

  const { status, events } = data
  const running = status.running

  return (
    <Card className={running ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'}>
      <CardContent className="p-4 sm:p-5">
        {/* Status header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex size-3">
              {running && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex size-3 rounded-full ${running ? 'bg-emerald-500' : status.enabled ? 'bg-amber-400' : 'bg-slate-400'}`} />
            </span>
            <div>
              <div className="text-sm font-semibold">
                {running ? '🟢 الوكيل شغّال دلوقتي' : status.enabled ? '🟡 مفعّل — في انتظار الدورة الجاية' : '⚪ متوقّف'}
              </div>
              <div className="text-xs text-muted-foreground">
                {running && status.currentStep
                  ? status.currentStep
                  : status.activeBatch
                    ? status.activeBatch
                    : status.enabled
                      ? `الدورة الجاية: ${fmt(status.nextRun)} · آخر فحص: ${fmt(status.lastTick)}`
                      : 'فعّل التشغيل التلقائي من لوحة التحكّم أو اضغط «شغّل دلوقتي».'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="size-3.5" />
            مباشر · يتحدّث كل ٣ ث
          </div>
        </div>

        {status.lastError && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            ⚠️ {status.lastError}
          </p>
        )}

        {/* Live event stream */}
        <div className="mt-4 max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لسه مفيش نشاط — شغّل الاكتشاف وهتشوفه هنا لحظة بلحظة.</p>
          ) : (
            events.map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded-md border bg-background/70 px-2.5 py-1.5">
                <span className={`mt-1 size-1.5 shrink-0 rounded-full ${dotColor(e.message)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-5 text-foreground">{e.message}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{e.at}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function dotColor(message: string): string {
  if (message.startsWith('✅') || /اتحفظ|خلص/.test(message)) return 'bg-emerald-500'
  if (message.startsWith('🔎') || message.startsWith('👁️') || /بدأ|بفحص|بيدوّر/.test(message)) return 'bg-blue-500'
  if (message.startsWith('🧠') || /Agent brain|chose|قرّر/.test(message)) return 'bg-purple-500'
  if (message.startsWith('⚠️') || /fail|error|خطأ|فشل/i.test(message)) return 'bg-red-500'
  return 'bg-slate-400'
}

function fmt(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('ar', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}
