'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Result state is fully derived from the URL — no effect needed.
  const { status, platform, username, error } = useMemo(() => {
    const connected = searchParams.get('connected');
    const usernameParam = searchParams.get('username');
    const errorMsg = searchParams.get('error');

    if (errorMsg) {
      return { status: 'error' as const, platform: null, username: null, error: errorMsg };
    }
    if (connected) {
      return { status: 'success' as const, platform: connected, username: usernameParam, error: null };
    }
    return { status: 'error' as const, platform: null, username: null, error: 'No connection data received' };
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'success' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Platform Connected
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                Connection Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' && (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                <span className="capitalize">{platform}</span>
                {username ? ` (@${username})` : ''} has been connected successfully.
              </p>
            </div>
          )}

          {status === 'error' && (
            <p className="text-muted-foreground">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/settings')}
              className="flex-1"
            >
              Back to Settings
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              className="flex-1"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ZernioCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
