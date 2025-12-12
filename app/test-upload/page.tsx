// app/test-upload/page.tsx
// Simple test page for file upload API (Phase 2, Task 1 & 4)
'use client';

import { useState } from 'react';

export default function TestUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [fileId, setFileId] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // Use the sourceId from seed data
  const sourceId = 'source_art_of_war';

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');
    setResult('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceId', sourceId);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `Upload failed: ${response.status}`);
        return;
      }

      setFileId(data.fileId);
      setResult(
        `✅ Upload successful!\n` +
        `File ID: ${data.fileId}\n` +
        `Status: ${data.status}\n` +
        `Message: ${data.message}\n\n` +
        `Note: Ingestion will start automatically. Check status below.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Test File Upload</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-6">
        <p className="text-sm text-gray-700">
          <strong>Source ID:</strong> {sourceId}
        </p>
        <p className="text-sm text-gray-700 mt-2">
          <strong>Note:</strong> Make sure you&apos;re signed in and the seed script has been run.
        </p>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label htmlFor="file" className="block text-sm font-medium mb-2">
            Select a plain text file:
          </label>
          <input
            id="file"
            type="file"
            accept="text/plain"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
            disabled={uploading}
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!file || uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800 font-semibold">Error:</p>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800 font-semibold">Success:</p>
          <pre className="text-green-700 whitespace-pre-wrap">{result}</pre>
        </div>
      )}

      {fileId && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h2 className="text-lg font-semibold mb-3">Manual Ingestion Trigger</h2>
          <p className="text-sm text-gray-700 mb-3">
            File ID: <code className="bg-gray-100 px-2 py-1 rounded">{fileId}</code>
          </p>
          <button
            onClick={async () => {
              setProcessing(true);
              setError('');
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
                  `Status: ${data.status}\n` +
                  `Text Length: ${data.textLength} characters\n` +
                  `Message: ${data.message}`
                );
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Ingestion failed');
              } finally {
                setProcessing(false);
              }
            }}
            disabled={processing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing...' : 'Trigger Ingestion'}
          </button>
        </div>
      )}
    </div>
  );
}
