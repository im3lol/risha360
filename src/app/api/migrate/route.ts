import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Remote migrations are disabled. Run supabase-migration.sql in the Supabase SQL Editor.',
    },
    { status: 410 }
  )
}
