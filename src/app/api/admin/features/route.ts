import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/admin';
import { toErrorResponse } from '@/lib/auth/account';
import {
  WORKSPACE_FEATURE_META,
  type WorkspaceFeature,
} from '@/lib/features';

export async function GET() {
  try {
    await requireSuperAdmin();

    const features = Object.values(WORKSPACE_FEATURE_META).map(
      (meta: (typeof WORKSPACE_FEATURE_META)[WorkspaceFeature]) => ({
        key: meta.key,
        label: meta.label,
        description: meta.description,
      }),
    );

    return NextResponse.json({ features });
  } catch (err) {
    return toErrorResponse(err);
  }
}
