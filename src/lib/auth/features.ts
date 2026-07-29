import { createClient } from '@supabase/supabase-js';
import { ForbiddenError } from './account';

let _adminClient: ReturnType<typeof createClient> | null = null;

function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _adminClient;
}

export async function requireWorkspaceFeature(
  accountId: string,
  feature: string,
): Promise<void> {
  const db = supabaseAdmin();

  const { data: account, error } = await db
    .from('accounts')
    .select('workspace_features')
    .eq('id', accountId)
    .maybeSingle();

  if (error || !account) {
    throw new ForbiddenError('Account not found');
  }

  const features = account.workspace_features as string[] | null;

  // NULL = all features enabled (default for existing accounts).
  if (features === null) return;

  if (!features.includes(feature)) {
    throw new ForbiddenError(
      `The "${feature}" feature is not enabled for this account`,
    );
  }
}
