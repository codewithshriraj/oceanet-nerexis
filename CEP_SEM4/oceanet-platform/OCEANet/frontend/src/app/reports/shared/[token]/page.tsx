'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { GlassCard } from '@/components/Cards';
import { apiFetch } from '@/utils/api';
import ReportContentRenderer from '@/components/ReportContentRenderer';

interface ReportDetail {
  title: string;
  report_type: string;
  region: string;
  created_at: string;
  content: string;
}

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await apiFetch(`/reports/shared/${params.token}`);
        if (!response.ok) {
          throw new Error('Shared report not found');
        }
        const data = await response.json();
        setReport(data.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load shared report');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.token) {
      fetchReport();
    }
  }, [params.token]);

  return (
    <main className="min-h-screen bg-ocean-gradient px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-4xl mx-auto">
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-4xl font-bold text-text-primary mb-3">
          Shared Nerexis Report
        </motion.h1>

        <Link href="/reports" className="btn-secondary inline-flex items-center gap-2 px-4 py-2 mb-4">
          <ArrowLeft size={16} />
          <span>Back to Reports</span>
        </Link>

        {isLoading ? (
          <GlassCard>
            <p className="text-text-secondary">Loading shared report...</p>
          </GlassCard>
        ) : error ? (
          <GlassCard>
            <p className="text-red-400">{error}</p>
          </GlassCard>
        ) : report ? (
          <GlassCard>
            <h2 className="text-2xl font-bold text-text-primary mb-1">{report.title}</h2>
            <p className="text-text-secondary mb-4">
              {report.region} • {report.report_type} • {new Date(report.created_at).toLocaleString()}
            </p>
            <div className="mb-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-text-secondary">
              This shared report may include AI-generated analysis and should be reviewed before redistribution, publication, or use in formal decision-making.
            </div>
            <ReportContentRenderer content={report.content} />
          </GlassCard>
        ) : null}
      </div>
    </main>
  );
}
