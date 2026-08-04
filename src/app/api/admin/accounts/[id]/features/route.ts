import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/admin';
import { toErrorResponse } from '@/lib/auth/account';
import { WORKSPACE_FEATURES } from '@/lib/features';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireSuperAdmin();
    const { id: accountId } = await params;

    const { data: account, error } = await ctx.supabase
      .from('accounts')
      .select('workspace_features')
      .eq('id', accountId)
      .maybeSingle();

    if (error || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 },
      );
    }

    const features: readonly string[] =
      account.workspace_features ?? WORKSPACE_FEATURES;

    return NextResponse.json({ features });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireSuperAdmin();
    const { id: accountId } = await params;

    let body: { features?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.features)) {
      return NextResponse.json(
        { error: '"features" must be an array of strings' },
        { status: 400 },
      );
    }

    // Validate all keys are known features.
    const unknown = body.features.filter(
      (f: string) => !(WORKSPACE_FEATURES as readonly string[]).includes(f),
    );
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Unknown features: ${unknown.join(', ')}` },
        { status: 400 },
      );
    }

    const { error } = await ctx.supabase
      .from('accounts')
      .update({
        workspace_features: body.features,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    if (error) {
      console.error('[PATCH /api/admin/accounts/[id]/features] error:', error);
      return NextResponse.json(
        { error: 'Failed to update features' },
        { status: 500 },
      );
    }

    return NextResponse.json({ features: body.features });
  } catch (err) {
    return toErrorResponse(err);
  }
}
