import { Component } from "react";
import { AlertOctagon } from "lucide-react";

// Catches any render-time crash in the tree below it and shows a
// recoverable screen instead of a blank white page — critical for a
// daily-use business tool where a white screen means "the app is broken"
// with no way back except knowing to hard-refresh.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Amihem CRM crashed:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-6">
        <div className="max-w-sm w-full bg-panel border border-line rounded-2xl p-6 text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-rust/10 text-rust flex items-center justify-center">
            <AlertOctagon size={22} />
          </div>
          <h1 className="font-display font-bold text-lg">Something went wrong</h1>
          <p className="text-sm text-muted">
            The app hit an unexpected error. Your data is safe — it's saved as you go, not lost when this happens.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
