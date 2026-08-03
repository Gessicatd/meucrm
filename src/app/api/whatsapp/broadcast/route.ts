import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createBroadcast,
  deliverBroadcast,
  BroadcastError,
} from '@/lib/whatsapp/broadcast-core'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'

interface NewRecipient {
  phone: string
  params?: string[]
  messageParams?: unknown
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit(`broadcast:${user.id}`, RATE_LIMITS.broadcast)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const {
      recipients: newRecipients,
      phone_numbers,
      template_name,
      template_language,
      template_params,
    } = body

    let recipients: NewRecipient[]
    if (Array.isArray(newRecipients) && newRecipients.length > 0) {
      recipients = newRecipients
    } else if (Array.isArray(phone_numbers) && phone_numbers.length > 0) {
      const shared: string[] = Array.isArray(template_params) ? template_params : []
      recipients = phone_numbers.map((phone: string) => ({ phone, params: shared }))
    } else {
      return NextResponse.json(
        { error: 'Provide either `recipients` (preferred) or `phone_numbers` — must be a non-empty array' },
        { status: 400 },
      )
    }

    if (!template_name) {
      return NextResponse.json({ error: 'template_name is required' }, { status: 400 })
    }

    const plan = await createBroadcast(supabase, accountId, user.id, {
      name: null,
      templateName: template_name,
      templateLanguage: template_language,
      recipients: recipients.map((r) => ({
        to: typeof r.phone === 'string' ? r.phone : '',
        params: r.params,
      })),
    })

    const outcome = await deliverBroadcast(supabase, accountId, user.id, plan)

    return NextResponse.json({
      success: true,
      broadcast_id: plan.broadcastId,
      total: plan.planned.length + plan.rejected,
      accepted: plan.planned.length,
      rejected: plan.rejected,
      results: outcome.results,
    })
  } catch (error) {
    if (error instanceof BroadcastError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error in broadcast POST:', error)
    return NextResponse.json({ error: 'Failed to process broadcast' }, { status: 500 })
  }
}
