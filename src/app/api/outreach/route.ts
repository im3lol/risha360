// GET /api/outreach - List outreach messages/conversations
// POST /api/outreach - Create or update outreach
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { badRequest, outreachActionSchema, serverError } from '@/lib/api-validation'
import { hasServiceRole, supabaseServer as supabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const { data, error } = await supabase
      .from('conversations')
      .select(`*, influencer:influencers(*), lead:leads(*), messages(*)`)
      .order('created_at', { ascending: false })

    if (error) return serverError(error, 'GET /api/outreach')

    const result = data?.map((c: any) => {
      const inf = c.influencer || {}
      const lead = c.lead || {}
      const sortedMessages = [...(c.messages || [])].sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      const lastMsg = sortedMessages[sortedMessages.length - 1]

      return {
        id: lastMsg?.id || c.id,
        messageId: lastMsg?.id || '',
        conversationId: c.id,
        leadId: c.lead_id || '',
        leadName: inf.display_name || 'Unknown',
        leadHandle: '',
        category: inf.primary_niche || 'Other',
        city: inf.city || 'Unknown',
        score: Math.round(lead.score || 0),
        language: (lastMsg?.body && /[\u0600-\u06FF]/.test(lastMsg.body)) ? 'AR' : 'EN',
        message: lastMsg?.body || c.ai_generated_draft || '',
        complianceChecks: parseComplianceChecks(lastMsg?.compliance_checks),
        status: mapState(c.outreach_state),
        createdAt: formatDate(c.created_at),
        platform: mapChannel(c.channel),
      }
    }) || []

    return NextResponse.json({ data: result })
  } catch (error) {
    return serverError(error, 'GET /api/outreach')
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasServiceRole) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is required for outreach writes.' },
        { status: 503 }
      )
    }
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    const parsed = outreachActionSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return badRequest(parsed.error)
    const body = parsed.data
    const { action, conversationId, messageId, body: msgBody, complianceChecks } = body

    if (['approve', 'send', 'edit', 'reject'].includes(action)) {
      if (!messageId || !conversationId) {
        return NextResponse.json({ error: 'messageId and conversationId are required' }, { status: 400 })
      }
      if (action === 'edit' && !String(msgBody || '').trim()) {
        return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
      }

      const { error } = await supabase.rpc('apply_outreach_action', {
        p_action: action,
        p_conversation_id: conversationId,
        p_message_id: messageId,
        p_message_body: action === 'edit' ? String(msgBody).trim() : null,
        p_feedback: action === 'reject' ? String(body.feedback || '').trim() || null : null,
      })
      if (error) {
        const isClientError =
          error.message.includes('does not belong') || error.message.includes('not found')
        if (isClientError) return NextResponse.json({ error: error.message }, { status: 400 })
        return serverError(error, 'POST /api/outreach (action)')
      }
      return NextResponse.json({ success: true, action: action === 'approve' ? 'approved' : action === 'send' ? 'sent' : action === 'edit' ? 'edited' : 'rejected' })
    }

    if (action === 'create' && conversationId && msgBody) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .maybeSingle()
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 400 })
      }

      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        direction: 'outbound',
        status: 'pending_approval',
        body: msgBody,
        is_ai_generated: true,
        compliance_checks: JSON.stringify(complianceChecks || {}),
      }).select().single()

      if (error) return serverError(error, 'POST /api/outreach (message insert)')
      await supabase.from('conversations').update({ outreach_state: 'pending_approval', state_changed_at: new Date().toISOString() }).eq('id', conversationId)
      return NextResponse.json({ data }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return serverError(error, 'POST /api/outreach')
  }
}

function mapState(s: string): string {
  const map: Record<string, string> = { new: 'Draft', drafting: 'Draft', pending_approval: 'Pending', approved: 'Approved', sent: 'Sent', responded: 'Responded', no_response: 'No Response' }
  return map[s] || 'Draft'
}
function mapChannel(c: string): string {
  const map: Record<string, string> = { dm_instagram: 'Instagram', dm_tiktok: 'TikTok', dm_twitter: 'X (Twitter)', whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS' }
  return map[c] || c || 'Unknown'
}
function formatDate(d?: string): string { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A' }

function parseComplianceChecks(value?: string) {
  const fallback = {
    noIncomePromise: false,
    freeRegistrationMentioned: false,
    under80Words: false,
    arabicLocalization: false,
  }
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return {
      noIncomePromise: parsed?.noIncomePromise === true,
      freeRegistrationMentioned: parsed?.freeRegistrationMentioned === true,
      under80Words: parsed?.under80Words === true,
      arabicLocalization: parsed?.arabicLocalization === true,
    }
  } catch {
    return fallback
  }
}
