'use client';

import { motion } from 'framer-motion';
import { Download, Eye, Share2, FileText, Calendar } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { GlassCard } from '@/components/Cards';
import { FloatingParticles } from '@/components/Animations';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotificationStore } from '@/store/notificationStore';
import { apiFetch } from '@/utils/api';

const reportTypes = [
  'Coastal Climate Risk Summary',
  'Sea Surface Temperature Trend Brief',
  'Biodiversity Stress Assessment',
  'Community Impact Forecast',
  'Marine Resource Sustainability Plan',
  'Unified Ecosystem Situation Report',
];

const regions = [
  'North Atlantic',
  'Bay of Bengal',
  'Pacific Basin',
  'Mediterranean',
  'Caribbean',
  'South China Sea',
];

interface ReportRecord {
  id: number;
  title: string;
  region: string;
  report_type: string;
  created_at: string;
  format: string;
  size: string;
  status: string;
}

interface ReportSyncStatus {
  is_running: boolean;
  last_success_at: string | null;
  last_error: string | null;
  last_generated_count: number;
  schedule_interval_seconds: number;
  total_generated?: number;
  last_reason?: string | null;
}

interface DashboardSummary {
  overview?: {
    reports_total?: number;
  };
  quick?: {
    biodiversity_observations?: number;
    oceanography_observations?: number;
    coastal_regions_monitored?: number;
    avg_predictive_response_ms?: number;
  };
}

interface LiveFeedStatus {
  name: string;
  status: string;
  source_url?: string;
}

interface NewsSummaryLite {
  external_sources?: LiveFeedStatus[];
}

const formatCompactNumber = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
};

const formatInterval = (seconds: number | undefined) => {
  if (!seconds || seconds <= 0) return 'Not scheduled';
  if (seconds < 60) return `${seconds}s cadence`;
  if (seconds % 60 === 0) return `${seconds / 60}m cadence`;
  return `${Math.round(seconds / 60)}m cadence`;
};

const getStatusTone = (status: string | undefined) => {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('sync')) return 'border-secondary/30 bg-secondary/10 text-secondary';
  if (normalized.includes('generat')) return 'border-bioluminescent/30 bg-bioluminescent/10 text-bioluminescent';
  if (normalized.includes('error') || normalized.includes('fail')) return 'border-neon-coral/30 bg-neon-coral/10 text-neon-coral';
  return 'border-white/20 bg-white/5 text-text-secondary';
};

export default function Reports() {
  const router = useRouter();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [reportType, setReportType] = useState('Coastal Climate Risk Summary');
  const [selectedRegion, setSelectedRegion] = useState('North Atlantic');
  const [customTitle, setCustomTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [generatedReports, setGeneratedReports] = useState<ReportRecord[]>([]);
  const [showAllReports, setShowAllReports] = useState(false);
  const [reportSyncStatus, setReportSyncStatus] = useState<ReportSyncStatus | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [liveFeeds, setLiveFeeds] = useState<LiveFeedStatus[]>([]);

  const fetchReports = async (options?: { keepCurrentList?: boolean; silentError?: boolean }) => {
    try {
      if (!options?.keepCurrentList) {
        setIsLoadingReports(true);
      }
      const query = showAllReports
        ? ''
        : `?region=${encodeURIComponent(selectedRegion)}&report_type=${encodeURIComponent(reportType)}`;

      const response = await apiFetch(`/reports${query}`, {
        timeoutMs: 25000,
        retryOnTimeout: false,
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to load reports');
      }
      const data = await response.json();
      setGeneratedReports(data.reports || []);
    } catch (error) {
      if (!options?.silentError && !isGenerating) {
        addNotification({
          message: error instanceof Error ? error.message : 'Unable to load reports',
          type: 'error',
        });
      }
    } finally {
      setIsLoadingReports(false);
    }
  };

  const fetchReportSyncStatus = async () => {
    try {
      const response = await apiFetch('/reports/sync/status', { timeoutMs: 8000, retryOnTimeout: false, cache: 'no-store' });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setReportSyncStatus({
        is_running: Boolean(data.is_running),
        last_success_at: data.last_success_at || null,
        last_error: data.last_error || null,
        last_generated_count: Number(data.last_generated_count || 0),
        schedule_interval_seconds: Number(data.schedule_interval_seconds || 0),
        total_generated: Number(data.total_generated || 0),
        last_reason: data.last_reason || null,
      });
    } catch {
      // keep reports page usable even if status endpoint is temporarily unavailable
    }
  };

  const fetchDashboardSummary = async () => {
    try {
      const response = await apiFetch('/_legacy/dashboard/summary', {
        timeoutMs: 15000,
        cache: 'no-store',
        retryOnTimeout: false,
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setDashboardSummary(data as DashboardSummary);
    } catch {
      // keep reports page usable even if dashboard endpoint is temporarily unavailable
    }
  };

  const fetchLiveFeedStatus = async () => {
    try {
      const response = await apiFetch('/news/summary', {
        timeoutMs: 12000,
        cache: 'no-store',
        retryOnTimeout: false,
      });
      if (!response.ok) {
        return;
      }
      const data: NewsSummaryLite = await response.json();
      setLiveFeeds((data.external_sources || []).slice(0, 6));
    } catch {
      // keep reports page usable even if news endpoint is temporarily unavailable
    }
  };

  useEffect(() => {
    fetchReports();
  }, [showAllReports, selectedRegion, reportType]);

  useEffect(() => {
    fetchReportSyncStatus();
    fetchDashboardSummary();
    fetchLiveFeedStatus();
    fetchReports({ keepCurrentList: true, silentError: true });
    
    // Set refresh intervals to 5-10 minutes for better UX
    const syncInterval = window.setInterval(fetchReportSyncStatus, 5 * 60 * 1000); // 5 min
    const dashboardInterval = window.setInterval(fetchDashboardSummary, 10 * 60 * 1000); // 10 min
    const feedInterval = window.setInterval(fetchLiveFeedStatus, 5 * 60 * 1000); // 5 min
    const reportsInterval = window.setInterval(() => fetchReports({ keepCurrentList: true, silentError: true }), 5 * 60 * 1000); // 5 min
    
    return () => {
      window.clearInterval(syncInterval);
      window.clearInterval(dashboardInterval);
      window.clearInterval(feedInterval);
      window.clearInterval(reportsInterval);
    };
  }, []);

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      const response = await apiFetch('/reports/generate', {
        method: 'POST',
        timeoutMs: 60000,
        retryOnTimeout: false,
        allowLocalFallback: false,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_type: reportType,
          region: selectedRegion,
          custom_title: customTitle.trim() || null,
          include_ai_insights: true,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Report generation failed');
      }

      const data = await response.json();
      if (data.report) {
        await fetchReports({ keepCurrentList: true });
      }
      setCustomTitle('');
      addNotification({
        message: 'Report generated successfully.',
        type: 'success',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to generate report',
        type: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = (reportId: number) => {
    router.push(`/reports/${reportId}`);
  };

  const handleDownload = async (reportId: number, title: string, format: 'pdf' | 'docx' | 'txt' = 'pdf') => {
    try {
      const response = await apiFetch(`/reports/${reportId}/download?format=${format}`);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${title}.${format}`;
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

  const handleShare = async (reportId: number) => {
    try {
      const response = await apiFetch(`/reports/${reportId}/share`, {
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

      addNotification({
        message: 'Shared links can expose report contents. Share only with intended recipients.',
        type: 'info',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to share report',
        type: 'error',
      });
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return 'Not synced yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const liveFeedsUp = liveFeeds.filter((feed) => feed.status === 'ok').length;
  const reportsTotal = dashboardSummary?.overview?.reports_total ?? generatedReports.length;
  const monitoredRegions = dashboardSummary?.quick?.coastal_regions_monitored ?? 0;
  const avgResponseMs = dashboardSummary?.quick?.avg_predictive_response_ms ?? 0;
  const totalGenerated = reportSyncStatus?.total_generated ?? reportSyncStatus?.last_generated_count ?? 0;

  return (
    <main className="min-h-screen bg-ocean-gradient pb-20">
      <Navbar />
      <FloatingParticles count={15} />

      {/* Header */}
      <section className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-2">
              Executive Reports Center
            </h1>
            <p className="text-text-secondary">Create, review, distribute, and monitor stakeholder-ready environmental intelligence reports backed by live platform data.</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-4 shadow-glow">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Report Inventory</p>
                <p className="mt-2 text-3xl font-bold text-text-primary">{formatCompactNumber(reportsTotal)}</p>
                <p className="mt-1 text-sm text-text-secondary">Reports currently indexed by the backend.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-4 shadow-glow">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Coverage</p>
                <p className="mt-2 text-3xl font-bold text-text-primary">{formatCompactNumber(monitoredRegions)}</p>
                <p className="mt-1 text-sm text-text-secondary">Coastal regions actively monitored for reporting.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-4 shadow-glow">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Sync Throughput</p>
                <p className="mt-2 text-3xl font-bold text-text-primary">{formatCompactNumber(totalGenerated)}</p>
                <p className="mt-1 text-sm text-text-secondary">Total reports generated by automated sync workflows.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-4 shadow-glow">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Response SLA</p>
                <p className="mt-2 text-3xl font-bold text-text-primary">{avgResponseMs ? `${Math.round(avgResponseMs)} ms` : 'Unavailable'}</p>
                <p className="mt-1 text-sm text-text-secondary">Average predictive response from current dashboard telemetry.</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-widest text-text-secondary">Live Feed Health</p>
                <p className="text-[11px] text-text-secondary">UP {liveFeedsUp}/{liveFeeds.length || 0}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {liveFeeds.length === 0 ? (
                  <span className="text-xs text-text-secondary">No source status available yet.</span>
                ) : (
                  liveFeeds.map((feed) => {
                    const isUp = feed.status === 'ok';
                    const chipClass = `rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isUp ? 'border-secondary/30 text-secondary bg-secondary/10' : 'border-white/20 text-text-secondary bg-white/5'}`;
                    if (!feed.source_url) {
                      return (
                        <span key={`${feed.name}-${feed.status}`} className={chipClass}>
                          {feed.name}: {isUp ? 'UP' : 'DOWN'}
                        </span>
                      );
                    }
                    return (
                      <a key={`${feed.name}-${feed.source_url}`} href={feed.source_url} target="_blank" rel="noreferrer" className={chipClass}>
                        {feed.name}: {isUp ? 'UP' : 'DOWN'}
                      </a>
                    );
                  })
                )}
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Report Trust Notice</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Generated reports may include AI-assisted analysis. Review before external publication, and share links only with intended recipients. For legal or privacy requests, use <Link href="/contact" className="font-semibold text-cyan hover:text-text-primary">Contact</Link>.
              </p>
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Operations Briefing</p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Automated report sync is {reportSyncStatus?.is_running ? 'currently active' : 'standing by'} with {formatInterval(reportSyncStatus?.schedule_interval_seconds)}. Last successful synchronization completed {formatDateTime(reportSyncStatus?.last_success_at)}.
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">Last sync reason:</span>{' '}
                  {reportSyncStatus?.last_reason || 'Unavailable'}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Report Generation Form */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12 relative z-10">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass rounded-lg p-5 mb-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-4">
                <p className="text-text-secondary text-sm">Oceanography Observations</p>
                <p className="text-2xl font-bold text-bioluminescent mt-1">
                  {(dashboardSummary?.quick?.oceanography_observations ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-4">
                <p className="text-text-secondary text-sm">Biodiversity Observations</p>
                <p className="text-2xl font-bold text-electric-violet mt-1">
                  {(dashboardSummary?.quick?.biodiversity_observations ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-4">
                <p className="text-text-secondary text-sm">Last Sync Batch</p>
                <p className="text-2xl font-bold text-text-primary mt-1">
                  {formatCompactNumber(reportSyncStatus?.last_generated_count ?? 0)}
                </p>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-lg p-8"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary">Create New Report</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Launch a new stakeholder report using the selected region, report template, and optional executive title.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
                AI insights are enabled for report generation.
              </div>
            </div>

            <div className="space-y-6">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-3">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-cyan focus:border-opacity-50"
                >
                  {reportTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-3">Region</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-cyan focus:border-opacity-50"
                >
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Title */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-3">Custom Report Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Coastal Warming & Biodiversity Risk Brief - Q1 2026"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg px-4 py-3 text-text-primary placeholder-gray-500 focus:outline-none focus:border-cyan focus:border-opacity-50"
                />
              </div>

              {/* Advanced Options */}
              <div className="p-4 bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 accent-cyan"
                  />
                  <span className="text-text-primary font-medium">Include AI Insights & Recommendations</span>
                </label>
              </div>

              {/* Generate Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="btn-orange w-full disabled:opacity-75"
              >
                {isGenerating ? 'Generating Executive Report...' : 'Generate Executive Report'}
              </motion.button>

              <p className="text-xs leading-5 text-text-secondary">
                By generating a report, you confirm you are authorized to process the selected data and to distribute resulting outputs under your organization's policy requirements.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Generated Reports Section */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className="text-2xl font-bold text-text-primary">
                {showAllReports ? 'Report Inventory' : 'Filtered Report Inventory'}
              </h2>
              <div className="flex flex-col items-start sm:items-end gap-2">
                {reportSyncStatus && (
                  <p className="text-xs text-text-secondary inline-flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        reportSyncStatus.is_running
                          ? 'bg-ocean-orange'
                          : reportSyncStatus.last_error
                            ? 'bg-neon-coral'
                            : 'bg-bioluminescent'
                      }`}
                    />
                    <span>
                      Last report sync: {formatDateTime(reportSyncStatus.last_success_at)}
                      {reportSyncStatus.is_running ? ' (syncing now...)' : ''}
                      {reportSyncStatus.last_error ? ' (last run had an error)' : ''}
                    </span>
                  </p>
                )}
                <button
                  onClick={() => setShowAllReports((prev) => !prev)}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  {showAllReports ? 'Show Filtered Inventory' : 'Show Full Inventory'}
                </button>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Current Filter</p>
                <p className="mt-2 text-base font-semibold text-text-primary">{reportType}</p>
                <p className="mt-1 text-sm text-text-secondary">Region: {selectedRegion}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Sync Health</p>
                <p className="mt-2 text-base font-semibold text-text-primary">
                  {reportSyncStatus?.last_error ? 'Attention required' : reportSyncStatus?.is_running ? 'Sync in progress' : 'Healthy'}
                </p>
                <p className="mt-1 text-sm text-text-secondary">{formatInterval(reportSyncStatus?.schedule_interval_seconds)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Visible Results</p>
                <p className="mt-2 text-base font-semibold text-text-primary">{generatedReports.length.toLocaleString()}</p>
                <p className="mt-1 text-sm text-text-secondary">Records currently loaded in this view.</p>
              </div>
            </div>

            {isLoadingReports ? (
              <div className="glass rounded-lg p-6">
                <p className="text-text-secondary">Loading report inventory...</p>
              </div>
            ) : generatedReports.length === 0 ? (
              <div className="glass rounded-lg p-6">
                <p className="text-text-secondary">
                  {showAllReports
                    ? 'No reports are currently indexed. Generate a report above to initialize the inventory.'
                    : 'No reports match the current filter. Generate a new report or switch to the full inventory view.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {generatedReports.map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="glass rounded-lg p-6 hover:shadow-glow transition-all"
                >
                  <div className="flex items-start space-x-4 mb-6">
                    <div className="p-3 bg-ocean-orange bg-opacity-20 rounded-lg flex-shrink-0">
                      <FileText size={24} className="text-ocean-orange" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-text-primary truncate">{report.title}</h3>
                      <p className="text-sm text-text-secondary flex items-center space-x-2 mt-2">
                        <Calendar size={14} />
                        <span>{formatDate(report.created_at)}</span>
                      </p>
                      <div className="mt-3 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                        {report.format} delivery
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6 p-4 bg-white bg-opacity-5 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-text-secondary text-sm">Region:</span>
                      <span className="text-text-primary font-medium">{report.region}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary text-sm">Type:</span>
                      <span className="text-text-primary font-medium text-right max-w-[60%] truncate">{report.report_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary text-sm">Format:</span>
                      <span className="text-text-primary font-medium">{report.format}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary text-sm">Size:</span>
                      <span className="text-text-primary font-medium">{report.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary text-sm">Status:</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(report.status)}`}>{report.status}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreview(report.id)}
                      className="flex-1 btn-secondary py-2 inline-flex items-center justify-center space-x-2"
                    >
                      <Eye size={18} />
                      <span>Preview</span>
                    </button>
                    <button onClick={() => handleDownload(report.id, report.title, 'pdf')} className="p-2 btn-secondary" title="Download PDF">
                      <Download size={18} />
                    </button>
                    <button onClick={() => handleShare(report.id)} className="p-2 btn-secondary">
                      <Share2 size={18} />
                    </button>
                  </div>
                </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </main>
  );
}
