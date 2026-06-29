// GET /api/setup - Check database setup status and get migration SQL
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { hasServiceRole, supabaseServer as supabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser(request)
    if (authError) return authError

    // Try to query the influencers table - this will fail if it doesn't exist
    const { data, error, count } = await supabase
      .from('influencers')
      .select('id', { count: 'exact' })
      .limit(1)

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('Could not find')) {
        // Tables don't exist
        return NextResponse.json({
          dbReady: false,
          message: 'Database tables not created yet. Run the SQL migration in Supabase SQL Editor.',
          sqlEditorUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
            ? `https://supabase.com/dashboard/project/${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}/sql`
            : undefined,
        })
      }
      // Some other error
      return NextResponse.json({
        dbReady: false,
        message: error.message,
      })
    }

    // Tables exist
    return NextResponse.json({
      dbReady: true,
      influencerCount: count || 0,
      writeReady: hasServiceRole,
    })
  } catch (error: any) {
    return NextResponse.json({
      dbReady: false,
      message: error.message,
    })
  }
}
