'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// A crash in one settings panel must not wedge the whole page (rail
// included) — show a recoverable fallback instead.
export class SettingsErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[settings] panel crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-md border border-border">
          <p className="text-sm text-muted-foreground">
            This panel failed to load.
          </p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
