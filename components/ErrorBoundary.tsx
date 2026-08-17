import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Catches a render error instead of showing a blank page.
 *
 * The app had none, so any throw below the root unmounted everything and left
 * a white screen — no message, no way back. That is a bad outcome anywhere and
 * a worse one in a packaged mobile app, where there is no address bar to
 * retype and no devtools to look at.
 *
 * The recovery offered is deliberately staged: try re-rendering first, and
 * only clear stored data if that fails, since clearing throws away the user's
 * saved itinerary.
 */

interface Props {
  children: ReactNode;
  /** Shown in the message so the user knows what broke. */
  area?: string;
}

interface State {
  error: Error | null;
  attempted: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = { error: null, attempted: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept as console output rather than shipped anywhere: there is no error
    // reporting service wired up, and pretending otherwise would be worse.
    console.error('[kairosphere] render error', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null, attempted: true });
  };

  private reset = () => {
    try {
      // Only the app's own keys — never the whole origin.
      ['kairos_saved_ids', 'kairos_ai_images', 'kairos_locations',
       'kairos_phenomena_feed', 'kairos_language', 'kairos_theme']
        .forEach(key => localStorage.removeItem(key));
    } catch {
      /* storage may be unavailable; reloading is still worth a try */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="w-full h-full min-h-[320px] flex items-center justify-center p-8 bg-base">
        <div className="max-w-sm text-center">
          <AlertTriangle className="w-8 h-8 text-gold mx-auto mb-4" />
          <h2 className="text-[16px] font-semibold text-ink">
            {this.props.area ? `${this.props.area} stopped responding` : 'Something went wrong'}
          </h2>
          <p className="text-[13px] text-ink-dim mt-2 leading-relaxed">
            {this.state.attempted
              ? 'That did not help. Clearing this app’s stored data usually fixes it — you will lose your saved itinerary.'
              : 'The rest of the app is still running. Try rendering this part again.'}
          </p>

          <div className="flex gap-2 justify-center mt-5">
            {!this.state.attempted && (
              <button
                onClick={this.retry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-on-accent text-[13px] font-semibold hover:bg-accent-hi transition-colors"
              >
                <RotateCw className="w-4 h-4" /> Try again
              </button>
            )}
            <button
              onClick={this.reset}
              className="px-4 py-2 rounded-lg border border-line text-ink-dim text-[13px] font-medium hover:text-ink hover:border-line-hard transition-colors"
            >
              Clear data and reload
            </button>
          </div>

          {import.meta.env.DEV && (
            <pre className="mt-5 text-left text-[11px] text-ink-faint overflow-auto max-h-40 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
