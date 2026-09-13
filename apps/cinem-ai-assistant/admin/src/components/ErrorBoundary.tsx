import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Catches render-time crashes so the app shows a themed error panel instead
 * of a blank white/black screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[Cinem AI Assistant ADMIN] render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen items-center justify-center p-8">
          <div className="glass max-w-lg p-6">
            <h2 className="neon-text font-display text-sm tracking-[0.2em]">SYSTEM FAULT</h2>
            <p className="mt-3 text-sm text-rose-300">{this.state.error.message}</p>
            <button
              onClick={() => { this.setState({ error: null }); location.reload(); }}
              className="mt-4 border border-neon/50 bg-neon/15 px-4 py-2 font-display text-[0.7rem] tracking-[0.2em] text-neon hover:bg-neon/25"
            >
              RELOAD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
