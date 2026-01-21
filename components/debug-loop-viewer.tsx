'use client';

// Debug component to view loop detection errors
// Add this to your page temporarily to see loop errors

import { useEffect, useState } from 'react';

export function DebugLoopViewer() {
  const [loopError, setLoopError] = useState<any>(null);

  useEffect(() => {
    // Check for stored loop error
    const stored = localStorage.getItem('intake-loop-error');
    if (stored) {
      setLoopError(JSON.parse(stored));
    }

    // Listen for new loop errors
    const interval = setInterval(() => {
      const stored = localStorage.getItem('intake-loop-error');
      if (stored) {
        setLoopError(JSON.parse(stored));
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  if (!loopError) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        backgroundColor: '#fee',
        border: '2px solid #f00',
        padding: 20,
        borderRadius: 8,
        maxWidth: 500,
        maxHeight: 400,
        overflow: 'auto',
        zIndex: 9999,
      }}
    >
      <h3 style={{ color: '#f00', marginTop: 0 }}>🔴 Loop Detected!</h3>
      <pre style={{ fontSize: 12, overflow: 'auto' }}>
        {JSON.stringify(loopError, null, 2)}
      </pre>
      <button
        onClick={() => {
          localStorage.removeItem('intake-loop-error');
          setLoopError(null);
        }}
        style={{
          marginTop: 10,
          padding: '5px 10px',
          backgroundColor: '#f00',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        Clear
      </button>
    </div>
  );
}
