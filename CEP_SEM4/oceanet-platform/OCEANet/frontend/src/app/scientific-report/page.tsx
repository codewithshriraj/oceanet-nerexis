'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';

export default function ScientificReportPage() {
  const [title, setTitle] = useState('Environmental Intelligence Brief');
  const [region, setRegion] = useState('Global');
  const [datasetId, setDatasetId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/v1/autonomy/reports/scientific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          region,
          dataset_id: datasetId ? Number(datasetId) : undefined,
          report_type: 'Environmental Intelligence',
          context: { dataset_count: 0, regional_report_count: 0 },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Scientific report generation failed');
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
        <h1 className="text-4xl font-bold tracking-tight text-white">Scientific Report Generator</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          Create a research-style report summary using existing dataset and AI intelligence outputs.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/20">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-300">Report Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300">Region</span>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
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
                placeholder="Leave blank for platform-level synthesis"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            disabled={loading}
          >
            {loading ? 'Generating report…' : 'Generate Report'}
          </button>
        </form>

        {error ? <div className="mt-6 rounded-2xl bg-red-500/10 border border-red-500/30 p-5 text-sm text-red-200">{error}</div> : null}

        {result ? (
          <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
            <h2 className="text-2xl font-semibold text-white">Report Output</h2>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words text-sm text-slate-200">{JSON.stringify(result, null, 2)}</pre>
          </section>
        ) : null}
      </main>
    </div>
  );
}
