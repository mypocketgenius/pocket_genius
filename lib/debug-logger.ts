// Debug logger that writes to file system
import fs from 'fs';
import path from 'path';

const logFile = path.join(process.cwd(), 'intake-debug.log');

export function debugLog(component: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${component}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}\n`;

  // Write to file (in browser, this won't work - see client version below)
  if (typeof window === 'undefined') {
    fs.appendFileSync(logFile, logEntry);
  }
}

// Client-side version - writes to localStorage
export function clientDebugLog(component: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    component,
    message,
    data,
  };

  // Store in localStorage
  const logs = JSON.parse(localStorage.getItem('intake-debug-logs') || '[]');
  logs.push(logEntry);

  // Keep only last 100 logs
  if (logs.length > 100) {
    logs.shift();
  }

  localStorage.setItem('intake-debug-logs', JSON.stringify(logs));
}

// Client-side: Export logs to download
export function exportDebugLogs() {
  const logs = localStorage.getItem('intake-debug-logs') || '[]';
  const blob = new Blob([logs], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intake-debug-${Date.now()}.json`;
  a.click();
}

// Client-side: Clear logs
export function clearDebugLogs() {
  localStorage.removeItem('intake-debug-logs');
}
