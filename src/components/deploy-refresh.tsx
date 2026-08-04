'use client';

import { useEffect } from 'react';

// After a new deploy, tabs open on the previous build hold stale chunks
// and server-action IDs — client navigation then silently fails and the
// UI looks "frozen". Detect those errors and hard-reload once to pick
// up the current deployment.
const STALE_PATTERNS = [
  /loading chunk [\w-]+ failed/i,
  /failed to fetch dynamically imported module/i,
  /failed to find server action/i,
  /chunkloaderror/i,
];

function isStaleDeployError(message: string | undefined): boolean {
  if (!message) return false;
  return STALE_PATTERNS.some((p) => p.test(message));
}

export function DeployRefresh() {
  useEffect(() => {
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => {
      if (isStaleDeployError(event.message ?? String(event.error))) reload();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
      if (isStaleDeployError(message)) reload();
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
