// ============================================================
// GET /api/instagram/posts — fetch recent posts for post selector
//
// Returns the most recent media posts from the account's linked
// Instagram account so the automation / flow builder can offer a
// "pick which posts trigger this" dropdown.
//
// Priority: Meta instagram_config → Zernio zernio_connections.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { fetchInstagramPosts } from '@/lib/instagram/meta-api'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { getInstagramPosts } from '@/lib/zernio/client'
import { getConnection } from '@/lib/zernio/store'

let _adminClient: ReturnType<typeof createClient> | null = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

interface IgConfig {
  access_token: string
  instagram_business_account_id: string
}

export async function GET(request: Request) {
  try {
    const ctx = await getCurrentAccount()
    const accountId = ctx.accountId

    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor') || undefined

    // ── Meta direct path ──────────────────────────────────
    const { data: metaData, error: metaError } = await supabaseAdmin()
      .from('instagram_config')
      .select('access_token, instagram_business_account_id')
      .eq('account_id', accountId)
      .maybeSingle()

    const metaConfig = metaData as IgConfig | null

    if (!metaError && metaConfig?.access_token && metaConfig?.instagram_business_account_id) {
      const result = await fetchInstagramPosts(
        metaConfig.instagram_business_account_id,
        decrypt(metaConfig.access_token),
        12,
        cursor,
      )
      return NextResponse.json(result)
    }

    // ── Zernio fallback ───────────────────────────────────
    const zernioConn = await getConnection(accountId)
    if (zernioConn?.connected_accounts?.length) {
      const igAccount = zernioConn.connected_accounts.find(
        (a) => a.platform === 'instagram' && a.isActive !== false,
      )
      if (igAccount) {
        const result = await getInstagramPosts({
          limit: 12,
          cursor,
        })
        return NextResponse.json(result)
      }
    }

    return NextResponse.json(
      { error: 'Instagram not configured for this account' },
      { status: 400 },
    )
  } catch (err) {
    return toErrorResponse(err)
  }
}
