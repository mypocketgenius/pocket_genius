// app/test-files/page.tsx
// Page to view and trigger ingestion for existing files
'use client';

import { useState, useEffect } from 'react';

interface FileRecord {
  id: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
  sourceId: string;
}

export default function TestFilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<string>('');

  const sourceId = 'source_art_of_war';

  useEffect(() => {
    fetchFiles();
  }, []);

  async function fetchFiles() {
    try {
      // We'll need to create an API route to list files
      // For now, let's use a simple approach - you can manually enter fileId
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      setLoading(false);
    }
  }

  async function triggerIngestion(fileId: string) {
    setProcessing(fileId);
    setError('');
    setResult('');

    try {
      const response = await fetch('/api/ingestion/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Ingestion failed');
        return;
      }

      setResult(
        `✅ Ingestion successful!\n` +
        `File ID: ${data.fileId}\n` +
        `Status: ${data.status}\n` +
        `Text Length: ${data.textLength} characters\n` +
        `Message: ${data.message}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">File Management & Ingestion</h1>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">Quick Trigger</h2>
        <p className="text-sm text-gray-700 mb-3">
          If you know your file ID from the database, enter it below to trigger ingestion:
        </p>
        <ManualTriggerForm onSuccess={(msg) => setResult(msg)} onError={(err) => setError(err)} />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800 font-semibold">Error:</p>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800 font-semibold">Success:</p>
          <pre className="text-green-700 whitespace-pre-wrap">{result}</pre>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded p-4">
        <h2 className="font-semibold mb-2">How to find your File ID:</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Go to your Neon database dashboard</li>
          <li>Run query: <code className="bg-gray-100 px-2 py-1 rounded">SELECT id, "fileName", status FROM "File" WHERE "sourceId" = 'source_art_of_war';</code></li>
          <li>Copy the file ID and use it in the form above</li>
        </ol>
      </div>
    </div>
  );
}

function ManualTriggerForm({ onSuccess, onError }: { onSuccess: (msg: string) => void; onError: (err: string) => void }) {
  const [fileId, setFileId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileId.trim()) {
      onError('Please enter a file ID');
      return;
    }

    setLoading(true);
    onError('');

    try {
      const response = await fetch('/api/ingestion/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fileId.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        onError(data.error || 'Ingestion failed');
        return;
      }

      onSuccess(
        `✅ Ingestion successful!\n` +
        `File ID: ${data.fileId}\n` +
        `Status: ${data.status}\n` +
        `Text Length: ${data.textLength} characters\n` +
        `Message: ${data.message}`
      );
      setFileId(''); // Clear form
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={fileId}
        onChange={(e) => setFileId(e.target.value)}
        placeholder="Enter file ID (e.g., clx123...)"
        className="flex-1 px-3 py-2 border border-gray-300 rounded"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !fileId.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : 'Trigger Ingestion'}
      </button>
    </form>
  );
}
