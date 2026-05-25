import { getSupabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// Keep-alive endpoint — hit this every few days to prevent Supabase from
// pausing the project due to inactivity on the free tier.
export async function GET() {
  const supabase = getSupabase()
  const { error } = await supabase.from('events').select('id').limit(1)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
