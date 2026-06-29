'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, X, Rocket, Database,
  ShieldCheck, SlidersHorizontal, Sparkles, Play, Users, Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getDiscoveryAgent, getLeads } from '@/lib/api'

const DISMISS_KEY = 'risha_onboarding_dismissed'
const MANUAL_KEY = 'risha_onboarding_manual' // { migrations: bool, signup: bool }

type Manual = { migrations?: boolean; signup?: boolean }

function readManual(): Manual {
  try { return JSON.parse(localStorage.getItem(MANUAL_KEY) || '{}') } catch { return {} }
}
function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}

type Step = {
  id: string
  icon: React.ElementType
  title: string
  desc: string
  done: boolean
  manual?: boolean
  action?: { label: string; onClick: () => void }
}

const SUPA = 'https://supabase.com/dashboard/project/lklbdjwslwyhndmfzkta'

export function Onboarding({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [agent, setAgent] = useState<Record<string, unknown> | null>(null)
  const [leadCount, setLeadCount] = useState(0)
  const [dbReady, setDbReady] = useState(true)
  const [manual, setManual] = useState<Manual>(readManual)
  const [dismissed, setDismissed] = useState(readDismissed)
  const [collapsed, setCollapsed] = useState(false)
  const [showRun, setShowRun] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const a = await getDiscoveryAgent()
      setAgent(a.settings as unknown as Record<string, unknown>)
      setDbReady(true)
      const { count } = await getLeads({ limit: 1 }).catch(() => ({ count: 0 }))
      setLeadCount(count)
    } catch {
      setDbReady(false)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const setManualFlag = (k: keyof Manual) => {
    const next = { ...manual, [k]: true }
    setManual(next)
    try { localStorage.setItem(MANUAL_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  if (dismissed || !loaded) return null

  const s = agent || {}
  const steps: Step[] = [
    {
      id: 'db', icon: Database, title: 'شغّل قاعدة البيانات (Migrations)',
      desc: 'في Supabase SQL Editor شغّل 003 + 004 + 005 (الجداول + لوحة التحكّم + تأمين المفاتيح).',
      done: dbReady && manual.migrations === true, manual: true,
      action: { label: 'افتح SQL Editor', onClick: () => window.open(`${SUPA}/sql/new`, '_blank') },
    },
    {
      id: 'signup', icon: ShieldCheck, title: 'عطّل التسجيل العام (أمان)',
      desc: 'امنع أي حد يعمل حساب جديد يشوف بياناتك — Authentication ← Sign-ups ← Disable.',
      done: manual.signup === true, manual: true,
      action: { label: 'افتح Auth', onClick: () => window.open(`${SUPA}/auth/providers`, '_blank') },
    },
    {
      id: 'config', icon: SlidersHorizontal, title: 'اضبط الـ AI Agent',
      desc: 'البلد · المدن · الأقسام · حد المتابعين · تعليماتك الدقيقة للداتا.',
      done: Boolean((s.country && s.country !== 'SA') || s.custom_instructions || Number(s.total_runs) > 0),
      action: { label: 'افتح الإعدادات', onClick: () => onNavigate?.('settings') },
    },
    {
      id: 'gemini', icon: Sparkles, title: '(اختياري) أضف مفتاح Gemini مجاني',
      desc: 'لتوليد أسماء مؤثرين متجدّدة بلا حدود — Google AI Studio (مجاني).',
      done: Boolean(s.gemini_api_key_set),
      action: { label: 'إعدادات الموديلات', onClick: () => onNavigate?.('settings') },
    },
    {
      id: 'start', icon: Play, title: 'شغّل الاكتشاف',
      desc: 'فعّل التشغيل التلقائي واضغط «شغّل دلوقتي» — الـ agent هيبدأ يجمع لوحده.',
      done: s.enabled === true,
      action: { label: 'لوحة التحكّم', onClick: () => onNavigate?.('discovery') },
    },
    {
      id: 'leads', icon: Users, title: 'شوف الـ Leads',
      desc: 'راجع المؤثرين، احذف غير المناسب، ونظّف غير-الأشخاص.',
      done: leadCount > 0,
      action: { label: 'افتح Leads', onClick: () => onNavigate?.('leads') },
    },
  ]

  const doneCount = steps.filter((x) => x.done).length
  const pct = Math.round((doneCount / steps.length) * 100)
  const allDone = doneCount === steps.length

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><Rocket className="size-5" /></div>
            <div>
              <h3 className="font-semibold text-sm">
                {allDone ? '🎉 كل حاجة جاهزة — النظام شغّال!' : 'دليل البدء — جهّز نظامك في خطوات'}
              </h3>
              <p className="text-xs text-muted-foreground">{doneCount}/{steps.length} مكتمل</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'عرض' : 'طيّ'}>
              {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={dismiss} title="إخفاء الدليل">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <Progress value={pct} className="mt-3 h-1.5" />

        {!collapsed && (
          <>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {steps.map((step, i) => {
                const Icon = step.icon
                return (
                  <div key={step.id} className={`flex items-start gap-3 rounded-lg border p-3 ${step.done ? 'border-emerald-200 bg-emerald-50/50' : 'bg-background'}`}>
                    <div className="mt-0.5">
                      {step.done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-muted-foreground/40" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <Icon className="size-3.5 text-primary shrink-0" />
                        <span className="truncate">{step.title}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                      {!step.done && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {step.action && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={step.action.onClick}>
                              {step.action.label}
                            </Button>
                          )}
                          {step.manual && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-700" onClick={() => setManualFlag(step.id as keyof Manual)}>
                              تمّ ✓
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* How to run */}
            <div className="mt-4 rounded-lg border bg-muted/30">
              <button className="flex w-full items-center justify-between p-3 text-sm font-medium" onClick={() => setShowRun((v) => !v)}>
                <span className="flex items-center gap-2"><Terminal className="size-4 text-primary" /> إزاي تشغّل المشروع وتخلّيه مستمر</span>
                {showRun ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {showRun && (
                <div className="space-y-2 border-t p-3 text-xs text-muted-foreground">
                  <p>المشروع شغّال على Docker (المنفذ <code>3009</code>) ويعيد تشغيل نفسه تلقائيًّا.</p>
                  <pre className="overflow-x-auto rounded bg-background p-2 text-[11px] leading-5">
{`# تشغيل كل الخدمات (مرة واحدة)
bun run docker:up

# متابعة اللوجات الحيّة
bun run docker:logs

# إيقاف الكل
bun run docker:down`}
                  </pre>
                  <p>للاستمرار بعد إعادة تشغيل الجهاز: خلّي <strong>Docker Desktop</strong> يبدأ مع ويندوز (Settings ← General). الحاويات هتشتغل لوحدها والـ worker يكمّل الاكتشاف.</p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
