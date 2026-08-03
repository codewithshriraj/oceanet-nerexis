'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';

export default function ResearchCopilotPage() {
  const [query, setQuery] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [topic, setTopic] = useState('Environmental Intelligence');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const body = {
        query,
        topic,
        dataset_id: datasetId ? Number(datasetId) : undefined,
      };
      const response = await fetch('/api/v1/autonomy/research-copilot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Failed to fetch research copilot');
      }
      setResult(payload);
    } catch (exc: any) {
      setError(exc?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-4xl font-bold tracking-tight text-white">Research Copilot</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          Ask the autonomy layer for dataset-driven environmental recommendations and scientific reasoning.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/20">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-300">Query</span>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
                placeholder="Describe what you want the research assistant to analyze"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300">Topic</span>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-slate-300">Dataset ID (optional)</span>
              <input
                type="number"
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
                placeholder="Enter a dataset ID for dataset-specific context"
              />
            </label>
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            disabled={loading}
          >
            {loading ? 'Generating answer…' : 'Run Research Copilot'}
          </button>
        </form>

        {error ? <div className="mt-6 rounded-2xl bg-red-500/10 border border-red-500/30 p-5 text-sm text-red-200">{error}</div> : null}

        {result ? (
          <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
            <h2 className="text-2xl font-semibold text-white">Response</h2>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words text-sm text-slate-200">{JSON.stringify(result, null, 2)}</pre>
          </section>
        ) : null}
      </main>
    </div>
  );
}
