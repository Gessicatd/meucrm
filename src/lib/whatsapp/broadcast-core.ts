import type { SupabaseClient } from '@supabase/supabase-js'

import { sendMessageToConversation } from '@/lib/whatsapp/send-message'
import { findOrCreateContact } from '@/lib/api/v1/contacts'

export class BroadcastError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'BroadcastError'
    this.code = code
    this.status = status
  }
}

export interface BroadcastRecipientInput {
  to: string
  params?: string[]
}

export interface CreateBroadcastParams {
  name?: string | null
  templateName: string
  templateLanguage?: string | null
  recipients: BroadcastRecipientInput[]
}

interface PlannedRecipient {
  recipientRowId: string
  phone: string
  contactId: string
  params: string[]
}

export interface BroadcastDeliveryResult {
  phone: string
  status: 'sent' | 'failed'
  whatsapp_message_id?: string
  error?: string
}

export interface BroadcastDeliveryOutcome {
  results: BroadcastDeliveryResult[]
}

export interface BroadcastPlan {
  broadcastId: string
  templateName: string
  templateLanguage: string
  planned: PlannedRecipient[]
  rejected: number
}

const MAX_RECIPIENTS = 1000

export async function createBroadcast(
  db: SupabaseClient,
  accountId: string,
  auditUserId: string,
  params: CreateBroadcastParams,
): Promise<BroadcastPlan> {
  const { name, templateName, recipients } = params
  const templateLanguage = params.templateLanguage || 'en_US'

  if (!templateName) {
    throw new BroadcastError('bad_request', "'template_name' is required", 400)
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new BroadcastError('bad_request', "'recipients' must be a non-empty array", 400)
  }
  if (recipients.length > MAX_RECIPIENTS) {
    throw new BroadcastError('bad_request', `A broadcast is capped at ${MAX_RECIPIENTS} recipients per request`, 400)
  }

  const resolved: { contactId: string; phone: string; params: string[] }[] = []
  let rejected = 0

  for (const r of recipients) {
    const phone = (typeof r.to === 'string' ? r.to : '').replace(/[^\d]/g, '')
    if (!phone || phone.length < 7) {
      rejected++
      continue
    }
    const { id } = await findOrCreateContact(db, accountId, auditUserId, { phone })
    resolved.push({
      contactId: id,
      phone,
      params: Array.isArray(r.params) ? r.params.filter((p): p is string => typeof p === 'string') : [],
    })
  }

  const seenContact = new Set<string>()
  const deduped = resolved.filter((r) => {
    if (seenContact.has(r.contactId)) return false
    seenContact.add(r.contactId)
    return true
  })

  if (deduped.length === 0) {
    throw new BroadcastError('bad_request', 'No recipients had a valid phone number', 400)
  }

  const { data: broadcast, error: bErr } = await db
    .from('broadcasts')
    .insert({
      account_id: accountId,
      user_id: auditUserId,
      name: name || `API broadcast (${templateName})`,
      template_name: templateName,
      template_language: templateLanguage,
      status: 'sending',
      total_recipients: deduped.length,
    })
    .select('id')
    .single()
  if (bErr || !broadcast) {
    console.error('[broadcast-core] create broadcast error:', bErr)
    throw new BroadcastError('internal', 'Failed to create broadcast', 500)
  }

  const { data: recipientRows, error: rErr } = await db
    .from('broadcast_recipients')
    .insert(
      deduped.map((r) => ({
        broadcast_id: broadcast.id,
        contact_id: r.contactId,
        status: 'pending' as const,
      })),
    )
    .select('id, contact_id')
  if (rErr || !recipientRows) {
    console.error('[broadcast-core] create recipients error:', rErr)
    throw new BroadcastError('internal', 'Failed to create broadcast', 500)
  }

  const byContact = new Map(deduped.map((r) => [r.contactId, r]))
  const planned: PlannedRecipient[] = recipientRows.map((row) => {
    const r = byContact.get(row.contact_id as string)!
    return { recipientRowId: row.id as string, phone: r.phone, contactId: r.contactId, params: r.params }
  })

  return { broadcastId: broadcast.id, templateName, templateLanguage, planned, rejected }
}

/**
 * Deliver a broadcast by sending template messages to each recipient
 * via Zernio (or RyzeAPI). The `sendMessageToConversation` function
 * routes through the configured provider.
 *
 * Returns per-recipient results so the caller can update statuses.
 */
export async function deliverBroadcast(
  db: SupabaseClient,
  accountId: string,
  auditUserId: string,
  plan: BroadcastPlan,
): Promise<BroadcastDeliveryOutcome> {
  const results: BroadcastDeliveryResult[] = []

  for (const recipient of plan.planned) {
    let convId: string | null = null

    const { data: existingConv } = await db
      .from('conversations')
      .select('id')
      .eq('account_id', accountId)
      .eq('contact_id', recipient.contactId)
      .maybeSingle()

    if (existingConv) {
      convId = existingConv.id
    } else {
      const { data: newConv, error: convErr } = await db
        .from('conversations')
        .insert({
          account_id: accountId,
          user_id: auditUserId,
          contact_id: recipient.contactId,
          channel: 'whatsapp',
        })
        .select('id')
        .single()

      if (!convErr && newConv) {
        convId = newConv.id
      }
    }

    if (!convId) {
      results.push({ phone: recipient.phone, status: 'failed', error: 'Failed to create conversation' })
      continue
    }

    try {
      const result = await sendMessageToConversation(db, accountId, {
        conversationId: convId,
        messageType: 'template',
        templateName: plan.templateName,
        templateLanguage: plan.templateLanguage,
        templateParams: recipient.params.length > 0 ? recipient.params : undefined,
        senderType: 'bot',
      })

      results.push({
        phone: recipient.phone,
        status: 'sent',
        whatsapp_message_id: result.whatsappMessageId,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ phone: recipient.phone, status: 'failed', error: msg })
    }
  }

  return { results }
}
