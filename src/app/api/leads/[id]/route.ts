// DELETE /api/leads/:id — permanently remove a lead and its underlying
// influencer + social profiles (manual cleanup of unsuitable accounts).
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { serverError } from '@/lib/api-validation'
import { supabaseServer as supabase } from '@/lib/supabase-server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuthenticatedUser(request)
  if (authError) return authError

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Lead id is required' }, { status: 400 })

  try {
    // Find the influencer behind this lead so we remove the whole record.
    const { data: lead, error: findErr } = await supabase
      .from('leads')
      .select('id, influencer_id')
      .eq('id', id)
      .maybeSingle()
    if (findErr) return serverError(findErr, 'DELETE /api/leads/:id')
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const influencerId = lead.influencer_id

    // Delete children first (no reliance on FK cascade).
    await supabase.from('leads').delete().eq('id', id)
    if (influencerId) {
      await supabase.from('leads').delete().eq('influencer_id', influencerId)
      await supabase.from('social_profiles').delete().eq('influencer_id', influencerId)
      await supabase.from('influencers').delete().eq('id', influencerId)
    }

    return NextResponse.json({ deleted: true, id, influencerId })
  } catch (error) {
    return serverError(error, 'DELETE /api/leads/:id')
  }
}
