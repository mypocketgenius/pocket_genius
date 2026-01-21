// Debug helper functions
// Call these from the browser console for debugging

/**
 * View the stored loop error
 * Usage in console: window.debugIntake.viewLoopError()
 */
export function viewLoopError() {
  const error = localStorage.getItem('intake-loop-error');
  if (!error) {
    console.log('No loop error stored');
    return null;
  }
  const parsed = JSON.parse(error);
  console.log('🔴 Loop Error:', parsed);
  return parsed;
}

/**
 * Clear the loop error
 * Usage in console: window.debugIntake.clearLoopError()
 */
export function clearLoopError() {
  localStorage.removeItem('intake-loop-error');
  console.log('✅ Loop error cleared');
}

/**
 * View all intake debug logs
 * Usage in console: window.debugIntake.viewLogs()
 */
export function viewDebugLogs() {
  const logs = localStorage.getItem('intake-debug-logs');
  if (!logs) {
    console.log('No debug logs stored');
    return [];
  }
  const parsed = JSON.parse(logs);
  console.table(parsed);
  return parsed;
}

/**
 * Clear all debug logs
 * Usage in console: window.debugIntake.clearLogs()
 */
export function clearDebugLogs() {
  localStorage.removeItem('intake-debug-logs');
  console.log('✅ Debug logs cleared');
}

/**
 * Export logs to download
 * Usage in console: window.debugIntake.exportLogs()
 */
export function exportLogs() {
  const logs = localStorage.getItem('intake-debug-logs') || '[]';
  const loopError = localStorage.getItem('intake-loop-error');

  const exportData = {
    logs: JSON.parse(logs),
    loopError: loopError ? JSON.parse(loopError) : null,
    timestamp: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intake-debug-${Date.now()}.json`;
  a.click();
  console.log('✅ Logs exported');
}

// Attach to window for console access
if (typeof window !== 'undefined') {
  (window as any).debugIntake = {
    viewLoopError,
    clearLoopError,
    viewLogs: viewDebugLogs,
    clearLogs: clearDebugLogs,
    exportLogs,
  };
}
