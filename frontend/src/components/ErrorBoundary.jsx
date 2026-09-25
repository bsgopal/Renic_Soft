import React from 'react';
import { Icon } from './icons.jsx';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof console !== 'undefined') {
      console.error('[Renic ErrorBoundary Caught]:', error, errorInfo);
    }
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="bg-slate-800/95 border border-slate-700/80 rounded-2xl p-8 max-w-xl w-full shadow-2xl backdrop-blur-sm">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-6">
              <Icon name="x" className="w-7 h-7" />
            </div>
            
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-400 mb-6">
              An unexpected error occurred in this view. The application caught the error to prevent a complete crash.
            </p>

            {this.state.error && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 font-mono text-xs text-rose-300 mb-6 overflow-auto max-h-48 whitespace-pre-wrap">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
