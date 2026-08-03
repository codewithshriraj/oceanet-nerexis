'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Bot, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { GlassCard } from '@/components/Cards';
import { FloatingParticles, WaveAnimation } from '@/components/Animations';
import { apiFetch } from '@/utils/api';

type DashboardSummary = {
  generated_at: string;
  overview: {
    reports_total: number;
    active_risk_analyses: number;
  };
  quick: {
    avg_predictive_response_ms: number;
  };
  analytics: {
    users: number;
    average_risk: number;
  };
};

type AnalyticsSummary = {
  generated_at: string;
  totals: {
    reports: number;
    datasets?: number;
    regions: number;
    types: number;
    users: number;
  };
  ecosystem_health: Array<{ region: string; risk: number; status: string }>;
};

type ReportList = {
  reports: Array<{
    id: number;
    title: string;
    report_type: string;
    region: string;
    created_at: string;
    status: string;
  }>;
};

const heroSignals = [
  'Live data pipelines',
  'Predictive risk scoring',
  'AI-generated reporting',
];

const heroCapabilities = [
  'Unified marine and climate monitoring',
  'Operational risk visibility across regions',
  'Readable outputs for technical and non-technical teams',
];

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function formatOptionalNumber(value: number | null | undefined): string {
  return typeof value === 'number' ? formatNumber(value) : 'N/A';
}

function formatLastSync(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString();
}

function riskLabel(risk: number): string {
  if (risk >= 70) return 'High';
  if (risk >= 40) return 'Moderate';
  return 'Stable';
}

function inferReportPipeline(report: ReportList['reports'][number]): string {
  const title = `${report.title} ${report.report_type}`.toLowerCase();
  if (title.includes('temperature') || title.includes('sst')) return 'Open-Meteo + analytics pipeline';
  if (title.includes('climate') || title.includes('coastal')) return 'NOAA + analytics pipeline';
  if (title.includes('biodiversity')) return 'GBIF / iNaturalist pipeline';
  return 'Integrated reporting pipeline';
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [reports, setReports] = useState<ReportList['reports']>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchHomeData = async () => {
      const results = await Promise.allSettled([
        apiFetch('/_legacy/dashboard/summary', { cache: 'no-store', timeoutMs: 15000, retryOnTimeout: false, allowLocalFallback: false }),
        apiFetch('/_legacy/analytics/summary', { cache: 'no-store', timeoutMs: 15000, retryOnTimeout: false, allowLocalFallback: false }),
        apiFetch('/reports?limit=3', { cache: 'no-store', timeoutMs: 15000, retryOnTimeout: false, allowLocalFallback: false }),
      ]);

      if (cancelled) return;

      const [dashboardResult, analyticsResult, reportsResult] = results;
      const failures: string[] = [];

      if (dashboardResult.status === 'fulfilled' && dashboardResult.value.ok) {
        const payload: DashboardSummary = await dashboardResult.value.json();
        if (!cancelled) setDashboardSummary(payload);
      } else {
        failures.push('dashboard');
      }

      if (analyticsResult.status === 'fulfilled' && analyticsResult.value.ok) {
        const payload: AnalyticsSummary = await analyticsResult.value.json();
        if (!cancelled) setAnalyticsSummary(payload);
      } else {
        failures.push('analytics');
      }

      if (reportsResult.status === 'fulfilled' && reportsResult.value.ok) {
        const payload: ReportList = await reportsResult.value.json();
        if (!cancelled) setReports(payload.reports || []);
      } else {
        failures.push('reports');
      }

      if (!cancelled) {
        if (failures.length === 0) {
          setError(null);
        } else if (failures.length === 3) {
          setError('Unable to load live homepage data.');
        } else {
          setError(`Live sync delayed for: ${failures.join(', ')}.`);
        }
      }
    };

    fetchHomeData();
    const interval = window.setInterval(fetchHomeData, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const metrics = useMemo(() => {
    const datasets = analyticsSummary?.totals.datasets;
    const regions = analyticsSummary?.totals.regions;
    const reportsTotal = analyticsSummary?.totals.reports ?? dashboardSummary?.overview.reports_total;
    const modelConfidence = typeof dashboardSummary?.analytics.average_risk === 'number'
      ? `${Math.max(0, 100 - Math.round(dashboardSummary.analytics.average_risk))}%`
      : 'N/A';

    return [
      { label: 'Live Datasets', value: formatOptionalNumber(datasets) },
      { label: 'Regions Monitored', value: formatOptionalNumber(regions) },
      { label: 'AI Reports Generated', value: formatOptionalNumber(reportsTotal) },
      { label: 'Average Model Confidence', value: modelConfidence },
    ];
  }, [analyticsSummary, dashboardSummary]);

  const proofPoints = useMemo(() => {
    const reportsTotal = analyticsSummary?.totals.reports ?? dashboardSummary?.overview.reports_total;
    const reportModels = analyticsSummary?.totals.types;
    const highRiskZones =
      (analyticsSummary?.ecosystem_health || []).filter((entry) => entry.risk >= 70).length ||
      dashboardSummary?.overview.active_risk_analyses;
    const collaborators = analyticsSummary?.totals.users ?? dashboardSummary?.analytics.users;
    const latencyMs = dashboardSummary?.quick.avg_predictive_response_ms;

    return [
      typeof reportsTotal === 'number' && typeof reportModels === 'number'
        ? `${formatNumber(reportsTotal)} live reports generated across ${reportModels} analytical workflows`
        : 'Live report volume will appear once analytics aggregation is complete.',
      typeof highRiskZones === 'number'
        ? `${highRiskZones} high-risk marine zone${highRiskZones === 1 ? '' : 's'} currently flagged for monitoring`
        : 'High-risk zone counts are unavailable until risk feeds finish syncing.',
      typeof collaborators === 'number'
        ? `${collaborators} active platform users with access to live insights`
        : 'Active collaborator count is unavailable right now.',
      typeof latencyMs === 'number'
        ? `${(latencyMs / 1000).toFixed(1)}s average response time on predictive endpoints`
        : 'Predictive endpoint latency is unavailable right now.',
    ];
  }, [analyticsSummary, dashboardSummary]);

  const snapshot = useMemo(() => {
    const averageRisk = typeof dashboardSummary?.analytics.average_risk === 'number'
      ? Math.round(dashboardSummary.analytics.average_risk)
      : null;
    const highestRisk = (analyticsSummary?.ecosystem_health || []).reduce<{ region: string; risk: number } | null>(
      (current, item) => {
        if (!current || item.risk > current.risk) {
          return { region: item.region, risk: item.risk };
        }
        return current;
      },
      null
    );
    const biodiversityIndex = typeof averageRisk === 'number'
      ? Math.max(0, Math.min(100, 100 - averageRisk))
      : null;
    return {
      globalRisk: averageRisk,
      highestRisk,
      biodiversityIndex,
      climateStress: typeof averageRisk === 'number' ? riskLabel(averageRisk) : 'Unavailable',
    };
  }, [analyticsSummary, dashboardSummary]);

  const snapshotNarrative = useMemo(() => {
    if (typeof snapshot.globalRisk !== 'number') {
      return 'Snapshot narrative will appear after the first full analytics sync.';
    }

    const stressContext = snapshot.highestRisk
      ? ` Highest regional pressure is currently in ${snapshot.highestRisk.region} at ${snapshot.highestRisk.risk}%.`
      : '';

    return `Current global marine risk is ${snapshot.globalRisk}% with climate stress classified as ${snapshot.climateStress}.${stressContext}`;
  }, [snapshot]);

  const lastSyncLine = useMemo(() => {
    const timestamp = dashboardSummary?.generated_at || analyticsSummary?.generated_at;
    const syncStatus = error ? 'Sync Delayed' : timestamp ? 'Live' : 'Awaiting First Sync';
    return `${formatLastSync(timestamp, 'Not available')} | ${syncStatus}`;
  }, [analyticsSummary, dashboardSummary, error]);

  const heroPanel = useMemo(() => {
    const reportsTotal = analyticsSummary?.totals.reports ?? dashboardSummary?.overview.reports_total;
    const riskZones =
      (analyticsSummary?.ecosystem_health || []).filter((entry) => entry.risk >= 70).length ||
      dashboardSummary?.overview.active_risk_analyses;
    const avgLatency = dashboardSummary?.quick.avg_predictive_response_ms;

    return {
      reportsTotal,
      riskZones,
      avgLatency,
      coverage: analyticsSummary?.totals.regions,
      datasets: analyticsSummary?.totals.datasets,
    };
  }, [analyticsSummary, dashboardSummary]);

  const openAIWorkspace = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('nerexis:open-ai-workspace'));
  };

  if (!isMounted) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ocean-gradient pb-20">
        <p className="text-text-secondary">Loading platform...</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-ocean-gradient pb-20">
      <Navbar />
      <FloatingParticles count={10} />

      <section className="relative z-10 px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
          <div className="max-w-3xl pt-2">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan"
            >
              Environmental Intelligence Platform
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-5 max-w-4xl text-4xl font-bold leading-[1.02] text-text-primary md:text-6xl"
            >
              Nerexis
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 max-w-3xl text-xl text-text-secondary md:text-[2rem] md:leading-tight"
            >
              Enterprise-grade intelligence for marine, climate, and ecosystem operations.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-6 max-w-2xl text-base leading-7 text-text-secondary"
            >
              Nerexis transforms fragmented environmental signals into governed monitoring, risk intelligence, and decision-ready reporting for global teams.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-6 space-y-3"
            >
              {heroCapabilities.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-cyan" />
                  <span className="leading-6">{item}</span>
                </div>
              ))}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link href="/dashboard" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3">
                <LayoutDashboard size={18} />
                <span>Open Executive Dashboard</span>
              </Link>
              <Link href="/analytics" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3">
                <BarChart3 size={18} />
                <span>Open Analytics Command Center</span>
              </Link>
              <button
                onClick={openAIWorkspace}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-medium text-text-primary transition-colors hover:bg-white/15"
              >
                <Bot size={18} />
                <span>Launch AI Workspace</span>
              </button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-7 flex flex-wrap gap-3"
            >
              {heroSignals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-text-secondary"
                >
                  {signal}
                </span>
              ))}
            </motion.div>
            <p className="mt-6 text-sm text-text-secondary">Last Sync: {lastSyncLine}</p>
            {error ? <p className="mt-2 text-sm text-neon-coral">{error}</p> : null}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:pl-4"
          >
            <GlassCard className="border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan">Platform Overview</p>
                  <h2 className="mt-3 text-2xl font-semibold text-text-primary">Live operating picture for environmental monitoring</h2>
                </div>
                <div className="rounded-full border border-emerald/20 bg-emerald/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald">
                  {error ? 'Degraded' : 'Operational'}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-white/10 bg-black/15 p-5">
                  <p className="text-sm text-text-secondary">Coverage footprint</p>
                  <p className="mt-2 text-4xl font-bold text-text-primary">{formatOptionalNumber(heroPanel.coverage)}</p>
                  <p className="mt-2 text-sm text-text-secondary">regions monitored through live datasets, analytics workflows, and reporting pipelines.</p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Risk zones</p>
                      <p className="mt-2 text-2xl font-semibold text-text-primary">{formatOptionalNumber(heroPanel.riskZones)}</p>
                      <p className="mt-1 text-sm text-text-secondary">currently escalated for review</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">API latency</p>
                      <p className="mt-2 text-2xl font-semibold text-text-primary">{typeof heroPanel.avgLatency === 'number' ? `${(heroPanel.avgLatency / 1000).toFixed(1)}s` : 'N/A'}</p>
                      <p className="mt-1 text-sm text-text-secondary">average predictive response time</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/6 px-5 py-4">
                      <p className="text-2xl font-bold text-text-primary">{metric.value}</p>
                      <p className="mt-1 text-sm text-text-secondary">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Pipeline health</p>
                  <p className="mt-1 text-sm text-text-primary">{formatOptionalNumber(heroPanel.datasets)} datasets feeding live analysis and reporting surfaces.</p>
                </div>
                <p className="text-sm text-text-secondary">Last sync: {lastSyncLine}</p>
              </div>
            </GlassCard>
          </motion.div>
        </div>
        <WaveAnimation />
      </section>

      <section className="relative z-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-text-primary md:text-4xl">Built for Operational Decisions</h2>
          <p className="mt-4 max-w-4xl text-base leading-7 text-text-secondary">
            Environmental signals are usually spread across disconnected tools, datasets, and reporting formats. Nerexis brings them into one platform so teams can monitor change, identify risk, and act from a shared intelligence layer.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {proofPoints.map((item) => (
              <GlassCard key={item} className="border border-white/10 bg-white/10 p-5">
                <p className="text-sm font-medium leading-6 text-text-primary">{item}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-text-primary md:text-4xl">Live Operational Snapshot</h2>
          <GlassCard className="mt-8 border border-white/10 bg-white/10 p-6">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-sm text-text-secondary">Global Marine Risk</p>
                <p className="mt-2 text-xl font-semibold text-text-primary">
                  {typeof snapshot.globalRisk === 'number' ? `${snapshot.globalRisk}% (${riskLabel(snapshot.globalRisk)})` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Highest Risk Region</p>
                <p className="mt-2 text-xl font-semibold text-text-primary">
                  {snapshot.highestRisk ? `${snapshot.highestRisk.region} - ${snapshot.highestRisk.risk}%` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Biodiversity Health Index</p>
                <p className="mt-2 text-xl font-semibold text-text-primary">
                  {typeof snapshot.biodiversityIndex === 'number' ? `${snapshot.biodiversityIndex} / 100` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Climate Stress Level</p>
                <p className="mt-2 text-xl font-semibold text-text-primary">{snapshot.climateStress}</p>
              </div>
            </div>
          </GlassCard>
          <p className="mt-5 max-w-4xl text-base leading-7 text-text-secondary">
            {snapshotNarrative}
          </p>
        </div>
      </section>

      <section className="relative z-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-text-primary md:text-4xl">Recent Intelligence Outputs</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-text-secondary">
                Latest outputs produced by the live monitoring and reporting pipeline.
              </p>
            </div>
            <Link href="/news" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan transition-colors hover:text-text-primary">
              <span>View Newsroom</span>
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-8 space-y-4">
            {reports.length > 0 ? (
              reports.map((report) => (
                <GlassCard key={report.id} className="border border-white/10 bg-white/10 p-5">
                  <p className="text-lg font-semibold text-text-primary">{report.region} - {report.title}</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Generated from {inferReportPipeline(report)} | {report.status}
                  </p>
                </GlassCard>
              ))
            ) : (
              <GlassCard className="border border-white/10 bg-white/10 p-5 text-sm text-text-secondary">
                Live reports will appear here once the reporting pipeline publishes new summaries.
              </GlassCard>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
