import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createBroadcast,
  deliverBroadcast,
  BroadcastError,
  type BroadcastPlan,
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
      broadcast_id,
      recipients: newRecipients,
      phone_numbers,
      template_name,
      template_language,
      template_params,
    } = body

    if (!template_name) {
      return NextResponse.json({ error: 'template_name is required' }, { status: 400 })
    }

    let plan: BroadcastPlan

    if (typeof broadcast_id === 'string' && broadcast_id) {
      // Reuse an existing broadcast created by the frontend — avoids
      // duplicate broadcasts/recipients rows.
      const { data: existing, error: brErr } = await supabase
        .from('broadcasts')
        .select('id, template_name, template_language')
        .eq('id', broadcast_id)
        .eq('account_id', accountId)
        .single()

      if (brErr || !existing) {
        return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
      }

      const { data: recipients } = await supabase
        .from('broadcast_recipients')
        .select('id, contact_id, contact:contacts(phone)')
        .eq('broadcast_id', broadcast_id)

      if (!recipients?.length) {
        return NextResponse.json({ error: 'Broadcast has no recipients' }, { status: 400 })
      }

      // Build a phone→params lookup from the request body so per-contact
      // variable values computed by the frontend survive the round-trip.
      const paramsByPhone = new Map<string, string[]>()
      if (Array.isArray(newRecipients)) {
        for (const nr of newRecipients) {
          const p = (typeof nr.phone === 'string' ? nr.phone : '').replace(/[^\d]/g, '')
          if (p) {
            paramsByPhone.set(p, Array.isArray(nr.params) ? nr.params.filter((v): v is string => typeof v === 'string') : [])
          }
        }
      }

      const planned: {
        recipientRowId: string
        phone: string
        contactId: string
        params: string[]
      }[] = []

      for (const r of recipients) {
        // PostgREST nested select returns contact as array for to-one joins
        const contact = Array.isArray(r.contact) ? r.contact[0] : r.contact
        const phone = (contact?.phone || '').replace(/[^\d]/g, '')
        if (!phone) continue
        planned.push({
          recipientRowId: r.id as string,
          phone,
          contactId: r.contact_id as string,
          params: paramsByPhone.get(phone) ?? [],
        })
      }

      if (planned.length === 0) {
        return NextResponse.json({ error: 'No valid recipients with phone numbers' }, { status: 400 })
      }

      plan = {
        broadcastId: broadcast_id,
        templateName: existing.template_name,
        templateLanguage: existing.template_language || 'en_US',
        planned,
        rejected: 0,
      }
    } else {
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

      plan = await createBroadcast(supabase, accountId, user.id, {
        name: null,
        templateName: template_name,
        templateLanguage: template_language,
        recipients: recipients.map((r) => ({
          to: typeof r.phone === 'string' ? r.phone : '',
          params: r.params,
        })),
      })
    }

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
