'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Share2 } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { GlassCard } from '@/components/Cards';
import { FloatingParticles } from '@/components/Animations';
import { useNotificationStore } from '@/store/notificationStore';
import { apiFetch } from '@/utils/api';
import ReportContentRenderer from '@/components/ReportContentRenderer';
import DatieTrustPanel from '@/components/DatieTrustPanel';

interface ReportDetail {
  id: number;
  title: string;
  report_type: string;
  region: string;
  created_at: string;
  status: string;
  format: string;
  size: string;
  content: string;
}

export default function ReportPreviewPage() {
  const params = useParams<{ reportId: string }>();
  const searchParams = useSearchParams();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const rawReportId = Array.isArray(params.reportId) ? params.reportId[0] : params.reportId;
  const reportId = Number(rawReportId);
  const from = searchParams.get('from');
  const backHref = from === 'data-manager' ? '/data-manager' : '/reports';
  const backLabel = from === 'data-manager' ? 'Back to Data Hub' : 'Back to Reports';

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setIsLoading(true);
        let response = await apiFetch(`/reports/${reportId}`, {
          timeoutMs: 15000,
          retryOnTimeout: false,
          allowLocalFallback: true,
          dedupeGetMs: 2000,
        });

        // Treat not-found as terminal instead of probing legacy routes.
        if (response.status === 404) {
          setReport(null);
          return;
        }

        if (!response.ok) {
          response = await apiFetch(`/_legacy/reports/${reportId}`, {
            timeoutMs: 20000,
            retryOnTimeout: false,
            allowLocalFallback: true,
            dedupeGetMs: 2000,
          });

          if (response.status === 404) {
            setReport(null);
            return;
          }
        }

        if (!response.ok) {
          throw new Error('Unable to load report preview');
        }

        const data = await response.json().catch(() => null);
        setReport(data?.report ?? null);
      } catch (error) {
        addNotification({
          message: error instanceof Error ? error.message : 'Unable to load report',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (!rawReportId || Number.isNaN(reportId)) {
      setReport(null);
      setIsLoading(false);
      return;
    }

    fetchReport();
  }, [rawReportId, reportId, addNotification]);

  const handleDownload = async (format: 'pdf' | 'docx' | 'txt' = 'pdf') => {
    if (!report) return;
    try {
      let response = await apiFetch(`/reports/${report.id}/download?format=${format}`);

      if (!response.ok) {
        response = await apiFetch('/reports/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: report.title,
            content: report.content,
            format,
          }),
          timeoutMs: 25000,
          retryOnTimeout: false,
        });
      }

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${report.title}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to download report',
        type: 'error',
      });
    }
  };

  const handleShare = async () => {
    if (!report) return;
    try {
      const response = await apiFetch(`/reports/${report.id}/share`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Share link generation failed');
      }
      const data = await response.json();
      const shareUrl = data.share_url as string;

      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        } catch {
          copied = false;
        }
      }

      window.open(shareUrl, '_blank', 'noopener,noreferrer');

      addNotification({
        message: copied
          ? 'Share link copied and opened in a new tab.'
          : 'Share link opened in a new tab.',
        type: 'success',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to share report',
        type: 'error',
      });
    }
  };

  return (
    <main className="min-h-screen bg-ocean-gradient pb-20">
      <Navbar />
      <FloatingParticles count={12} />

      <section className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <GlassCard>
              <p className="text-text-secondary">Loading report preview...</p>
            </GlassCard>
          ) : !report ? (
            <GlassCard>
              <p className="text-text-secondary">Report not found.</p>
            </GlassCard>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Link href={backHref} className="btn-secondary inline-flex items-center gap-2 px-4 py-2 mb-4">
                <ArrowLeft size={16} />
                <span>{backLabel}</span>
              </Link>

              <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">{report.title}</h1>
              <p className="text-text-secondary mb-6">
                {report.region} • {report.report_type} • {new Date(report.created_at).toLocaleString()}
              </p>

              <div className="flex flex-wrap gap-3 mb-6">
                <button onClick={() => handleDownload('pdf')} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
                  <Download size={18} />
                  <span>Download PDF</span>
                </button>
                <button onClick={() => handleDownload('docx')} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
                  <Download size={18} />
                  <span>Download Word</span>
                </button>
                <button onClick={handleShare} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
                  <Share2 size={18} />
                  <span>Share</span>
                </button>
              </div>

              <DatieTrustPanel reportId={report.id} compact />

              <GlassCard>
                <ReportContentRenderer content={report.content} />
              </GlassCard>
            </motion.div>
          )}
        </div>
      </section>
    </main>
  );
}
