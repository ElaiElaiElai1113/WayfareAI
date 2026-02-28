import { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log error to external service in production
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Send to monitoring service (e.g., Sentry) if configured
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: { react: { componentStack: errorInfo.componentStack } }
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
              <p className="text-sm text-slate-600">
                We encountered an unexpected error. Please try again or contact support if the problem persists.
              </p>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mt-2 text-left">
                  <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                    Error details (development)
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-800">
                    {this.state.error.stack || this.state.error.message}
                  </pre>
                </details>
              )}
            </div>

            <Button onClick={this.handleReset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
