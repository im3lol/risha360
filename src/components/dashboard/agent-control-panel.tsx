'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, Loader2, Play, Save, KeyRound, Target, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { getDiscoveryAgent, updateDiscoveryAgent, runDiscoveryAgentNow } from '@/lib/api'

const COUNTRIES = [
  ['SA', 'السعودية'], ['AE', 'الإمارات'], ['KW', 'الكويت'], ['QA', 'قطر'],
  ['BH', 'البحرين'], ['OM', 'عُمان'], ['EG', 'مصر'], ['JO', 'الأردن'],
]

type Form = {
  enabled: boolean
  country: string
  cities: string
  categories: string
  min_followers: number
  max_followers: string // '' = no limit
  target_count: number
  interval_minutes: number
  max_active_batches: number
  custom_instructions: string
  planner_provider: string
  openrouter_api_key: string
  openrouter_model: string
  openrouter_vision_model: string
  gemini_api_key: string
  gemini_model: string
}

export function AgentControlPanel() {
  const [form, setForm] = useState<Form | null>(null)
  const [flags, setFlags] = useState<{ or?: boolean; gem?: boolean }>({})
  const [status, setStatus] = useState<{ lastTick?: string; nextRun?: string; totalRuns?: number; lastError?: string }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try {
      const { settings } = await getDiscoveryAgent()
      const s = settings as unknown as Record<string, unknown>
      setForm({
        enabled: Boolean(s.enabled),
        country: String(s.country || 'SA'),
        cities: String(s.cities || ''),
        categories: String(s.categories || ''),
        min_followers: Number(s.min_followers || 0),
        max_followers: s.max_followers ? String(s.max_followers) : '',
        target_count: Number(s.target_count || 100),
        interval_minutes: Number(s.interval_minutes || 120),
        max_active_batches: Number(s.max_active_batches || 1),
        custom_instructions: String(s.custom_instructions || ''),
        planner_provider: String(s.planner_provider || 'auto'),
        openrouter_api_key: '',
        openrouter_model: String(s.openrouter_model || ''),
        openrouter_vision_model: String(s.openrouter_vision_model || ''),
        gemini_api_key: '',
        gemini_model: String(s.gemini_model || ''),
      })
      setFlags({ or: Boolean(s.openrouter_api_key_set), gem: Boolean(s.gemini_api_key_set) })
      setStatus({
        lastTick: s.last_tick_at as string, nextRun: s.next_run_at as string,
        totalRuns: Number(s.total_runs || 0), lastError: s.last_error as string,
      })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'فشل تحميل الإعدادات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

  const save = useCallback(async () => {
    if (!form) return
    setSaving(true); setMsg('')
    try {
      const payload: Record<string, unknown> = {
        enabled: form.enabled,
        country: form.country,
        cities: form.cities,
        categories: form.categories,
        min_followers: form.min_followers,
        max_followers: form.max_followers === '' ? 0 : Number(form.max_followers),
        target_count: form.target_count,
        interval_minutes: form.interval_minutes,
        max_active_batches: form.max_active_batches,
        custom_instructions: form.custom_instructions,
        planner_provider: form.planner_provider,
        openrouter_model: form.openrouter_model,
        openrouter_vision_model: form.openrouter_vision_model,
        gemini_model: form.gemini_model,
      }
      // Only send keys when typed (blank keeps the saved one).
      if (form.openrouter_api_key.trim()) payload.openrouter_api_key = form.openrouter_api_key.trim()
      if (form.gemini_api_key.trim()) payload.gemini_api_key = form.gemini_api_key.trim()
      await updateDiscoveryAgent(payload)
      setMsg('✅ اتحفظت الإعدادات')
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }, [form, load])

  const runNow = useCallback(async () => {
    setRunning(true); setMsg('')
    try {
      const r = await runDiscoveryAgentNow()
      setMsg(`▶️ ${r.result?.status || 'started'}${r.result?.message ? ' — ' + r.result.message : ''}`)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'فشل التشغيل')
    } finally {
      setRunning(false)
    }
  }, [load])

  if (loading || !form) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
  }

  const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : '—')

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <Bot className="size-4 text-primary" />
          لوحة تحكّم الـ AI Agent
          <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${form.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            <span className={`size-1.5 rounded-full ${form.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {form.enabled ? 'شغّال' : 'متوقّف'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Run control */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-3">
            <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
            <div className="text-sm">
              <div className="font-medium">التشغيل التلقائي</div>
              <div className="text-xs text-muted-foreground">
                آخر فحص: {fmt(status.lastTick)} · التالي: {fmt(status.nextRun)} · دورات: {status.totalRuns}
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => void runNow()} disabled={running}>
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            شغّل دلوقتي
          </Button>
        </div>

        {/* Targeting */}
        <Section icon={Target} title="استهداف الداتا">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="البلد">
              <Select value={form.country} onValueChange={(v) => set('country', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(([code, name]) => <SelectItem key={code} value={code}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="المدن (مفصولة بفاصلة، أو All)">
              <Input value={form.cities} onChange={(e) => set('cities', e.target.value)} placeholder="Riyadh,Jeddah" />
            </Field>
            <Field label="الأقسام (مفصولة بفاصلة، أو All)">
              <Input value={form.categories} onChange={(e) => set('categories', e.target.value)} placeholder="All / Fashion,Food" />
            </Field>
            <Field label="أقل متابعين">
              <Input type="number" value={form.min_followers} onChange={(e) => set('min_followers', num(e.target.value))} />
            </Field>
            <Field label="أقصى متابعين (فاضي = بلا حد)">
              <Input type="number" value={form.max_followers} onChange={(e) => set('max_followers', e.target.value)} placeholder="∞" />
            </Field>
            <Field label="عدد المستهدف لكل دورة">
              <Input type="number" value={form.target_count} onChange={(e) => set('target_count', num(e.target.value))} />
            </Field>
          </div>
          <Field label="تعليمات دقيقة للداتا (إيه اللي بتدوّر عليه بالظبط)">
            <Textarea
              rows={3}
              value={form.custom_instructions}
              onChange={(e) => set('custom_instructions', e.target.value)}
              placeholder="مثال: مؤثرات أزياء سعوديات، ٥٠ألف–٥٠٠ألف متابع، محتوى راقٍ، نسبة تفاعل عالية، يفضّل المعتمدين."
            />
          </Field>
        </Section>

        <Separator />

        {/* AI models / keys */}
        <Section icon={KeyRound} title="موديلات الـ AI ومفاتيح API">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="مزوّد التخطيط">
              <Select value={form.planner_provider} onValueChange={(v) => set('planner_provider', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">تلقائي</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Gemini API Key ${flags.gem ? '(متظبّط ✓)' : ''}`}>
              <Input type="password" value={form.gemini_api_key} onChange={(e) => set('gemini_api_key', e.target.value)} placeholder={flags.gem ? '•••••• (سيبه فاضي للإبقاء)' : 'الصق المفتاح'} />
            </Field>
            <Field label="Gemini Model">
              <Input value={form.gemini_model} onChange={(e) => set('gemini_model', e.target.value)} placeholder="gemini-2.0-flash" />
            </Field>
            <Field label={`OpenRouter API Key ${flags.or ? '(متظبّط ✓)' : ''}`}>
              <Input type="password" value={form.openrouter_api_key} onChange={(e) => set('openrouter_api_key', e.target.value)} placeholder={flags.or ? '•••••• (سيبه فاضي للإبقاء)' : 'الصق المفتاح'} />
            </Field>
            <Field label="OpenRouter Model (تخطيط)">
              <Input value={form.openrouter_model} onChange={(e) => set('openrouter_model', e.target.value)} placeholder="nousresearch/hermes-4-70b" />
            </Field>
            <Field label="OpenRouter Vision Model">
              <Input value={form.openrouter_vision_model} onChange={(e) => set('openrouter_vision_model', e.target.value)} placeholder="google/gemma-4-31b-it:free" />
            </Field>
          </div>
        </Section>

        <Separator />

        {/* Advanced */}
        <Section icon={Settings2} title="إعدادات متقدّمة">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="الفاصل بين الدورات (دقيقة)">
              <Input type="number" value={form.interval_minutes} onChange={(e) => set('interval_minutes', num(e.target.value))} />
            </Field>
            <Field label="أقصى دفعات متزامنة (1–3)">
              <Input type="number" value={form.max_active_batches} onChange={(e) => set('max_active_batches', num(e.target.value))} />
            </Field>
          </div>
        </Section>

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-muted-foreground">{msg || status.lastError || ''}</span>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            حفظ الإعدادات
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" /> {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}