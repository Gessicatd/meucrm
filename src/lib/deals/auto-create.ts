import type { SupabaseClient } from '@supabase/supabase-js';

export async function autoCreateDealForContact(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  contactId: string,
  contactName?: string | null,
): Promise<void> {
  try {
    const { data: pipeline } = await db
      .from('pipelines')
      .select('id')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!pipeline) return;

    const { data: firstStage } = await db
      .from('pipeline_stages')
      .select('id')
      .eq('pipeline_id', pipeline.id)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!firstStage) return;

    const title = contactName?.trim() || 'New Lead';

    await db.from('deals').insert({
      account_id: accountId,
      user_id: userId,
      pipeline_id: pipeline.id,
      stage_id: firstStage.id,
      contact_id: contactId,
      title,
      value: 0,
      status: 'open',
    });
  } catch (err) {
    console.error(
      '[auto-create-deal] failed to create deal for contact:',
      contactId,
      err instanceof Error ? err.message : err,
    );
  }
}
