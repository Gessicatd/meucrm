import { useAuth } from './use-auth';
import { WORKSPACE_FEATURES } from '@/lib/features';

export function useWorkspaceFeatures(): Set<string> {
  const { account } = useAuth();
  const raw = account?.workspace_features;

  if (raw === null || raw === undefined) {
    return new Set(WORKSPACE_FEATURES);
  }

  return new Set(raw);
}
