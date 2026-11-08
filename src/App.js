import React from 'react';
import CadConfigurator from './components/CadConfigurator';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-lg shadow-lg border border-red-200">
          <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-700 mb-4">An error occurred while rendering the application:</p>
          <pre className="p-3 bg-red-50 text-red-800 text-xs font-mono rounded overflow-auto border border-red-200 mb-4">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <div className="App bg-gray-100 min-h-screen">
        <header className="p-4 bg-blue-900 text-white text-center shadow-md">
          <h1 className="text-2xl font-bold tracking-tight">UG Project: Beam Generator</h1>
        </header>
        <main className="p-4 md:p-8">
          <CadConfigurator />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;