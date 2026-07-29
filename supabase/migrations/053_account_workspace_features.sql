-- Migration 053: Per-account workspace feature toggles.
-- Super admins control which Settings → Workspace sections each tenant
-- can access. NULL = all features enabled (default for existing accounts);
-- empty array = no workspace features visible.
-- Features map to the workspace-group items in settings-sections.ts.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS workspace_features text[] DEFAULT NULL;

COMMENT ON COLUMN accounts.workspace_features IS
  'Workspace settings sections visible to this account. NULL = all enabled (default); empty array = none. Managed by super admins via /api/admin/accounts/[id]/features.';
