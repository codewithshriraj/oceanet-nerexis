'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Zap, FileText, MessageSquare, Server, Activity, Cpu, Globe, AlertTriangle, Bell, FolderOpen, Users } from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Navbar from '@/components/Navbar';
import { StatCard, GlassCard, Badge } from '@/components/Cards';
import { FloatingParticles } from '@/components/Animations';
import LatestNewsPreview from '@/components/LatestNewsPreview';
import { apiFetch } from '@/utils/api';

type DashboardSummary = {
  generated_at: string;
  overview: {
    reports_total: number;
    active_risk_analyses: number;
    community_briefs_total: number;
    ai_queries_total: number;
    reports_trend_pct: number;
    risk_trend_pct: number;
    briefs_trend_pct: number;
    ai_trend_pct: number;
  };
  health: {
    ai_services_pct: number;
    data_processing_pct: number;
    api_endpoints_pct: number;
    shared_reports_pct: number;
    shared_reports_count?: number;
    share_eligible_reports_count?: number;
  };
  quick: {
    avg_predictive_response_ms: number;
    coastal_regions_monitored: number;
    marine_data_processed_today_kb: number;
    biodiversity_observations?: number;
    oceanography_observations?: number;
  };
  recent_activity: Array<{
    title: string;
    status: string;
    created_at: string;
  }>;
  analytics: {
    reports: number;
    regions: number;
    types: number;
    users: number;
    average_risk: number;
  };
};

type LiveFeedStatus = {
  name: string;
  status: string;
  source_url?: string;
};

type NewsSummaryLite = {
  external_sources?: LiveFeedStatus[];
};

const toRelativeTime = (iso: string) => {
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) return iso;
  const diffSeconds = Math.max(0, Math.floor((Date.now() - ts.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatDataSizeFromKb = (kb: number) => {
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(0)} KB`;
};

const getBadgeVariant = (status: string) => {
  if (status === 'Completed' || status === 'Generated') return 'success';
  if (status === 'Published') return 'info';
  return 'warning';
};

type ChartInsight = { type: string; title: string; body: string; severity?: number; created_at?: string };
type ChartData = {
  generated_at: string;
  sst_trend: Array<{ label: string; temp: number }>;
  species_distribution: Array<{ region: string; count: number }>;
  insights: ChartInsight[];
  sst_observation_count: number;
  regions_monitored: number;
};

const INSIGHT_STYLE: Record<string, { icon: typeof AlertTriangle; colorClass: string; bgClass: string }> = {
  alert:   { icon: AlertTriangle, colorClass: 'text-error',           bgClass: 'bg-red-50 border-red-200' },
  dataset: { icon: FolderOpen,    colorClass: 'text-seafoam',         bgClass: 'bg-green-50 border-green-200' },
  report:  { icon: FileText,      colorClass: 'text-bioluminescent',  bgClass: 'bg-blue-50 border-blue-200' },
  ai:      { icon: Cpu,           colorClass: 'text-electric-violet', bgClass: 'bg-purple-50 border-purple-200' },
};
const INSIGHT_STYLE_DEFAULT = INSIGHT_STYLE['report'];


// Example region options, update as needed
const REGION_OPTIONS = [
  { label: 'North Atlantic', value: 'north-atlantic' },
  { label: 'Bay of Bengal', value: 'bay-of-bengal' },
  { label: 'Pacific Basin', value: 'pacific-basin' },
  { label: 'Mediterranean', value: 'mediterranean' },
  { label: 'Caribbean Sea', value: 'caribbean-sea' },
  { label: 'South China Sea', value: 'south-china-sea' },
  { label: 'Arabian Sea', value: 'arabian-sea' },
  { label: 'Southern Ocean', value: 'southern-ocean' },
  { label: 'Coral Triangle', value: 'coral-triangle' },
  { label: 'Gulf of Mexico', value: 'gulf-of-mexico' },
  { label: 'Black Sea', value: 'black-sea' },
  { label: 'Baltic Sea', value: 'baltic-sea' },
  { label: 'North Sea', value: 'north-sea' },
  { label: 'Sea of Japan', value: 'sea-of-japan' },
  { label: 'Tasman Sea', value: 'tasman-sea' },
  { label: 'Bering Sea', value: 'bering-sea' },
  { label: 'Weddell Sea', value: 'weddell-sea' },
  { label: 'Red Sea', value: 'red-sea' },
  { label: 'Norwegian Sea', value: 'norwegian-sea' },
  { label: 'South Pacific', value: 'south-pacific' },
];
const WINDOW_OPTIONS = [
  { label: '3 Months', value: 3 },
  { label: '6 Months', value: 6 },
  { label: '12 Months', value: 12 },
];

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [liveFeeds, setLiveFeeds] = useState<LiveFeedStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [windowMonths, setWindowMonths] = useState<number>(6);
  const [region, setRegion] = useState<string>('global-coastal-waters-marine');

  useEffect(() => {
    let cancelled = false;

    const fetchSummary = async () => {
      try {
        const response = await apiFetch('/_legacy/dashboard/summary', { cache: 'no-store', timeoutMs: 9000, retryOnTimeout: false, allowLocalFallback: false });
        if (!response.ok) throw new Error(`Failed to load dashboard (${response.status})`);
        const payload: DashboardSummary = await response.json();
        if (!cancelled) {
          setSummary(payload);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load dashboard');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSummary();
    const interval = window.setInterval(fetchSummary, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // Fetch real-time chart data (SST, species distribution, insights) — refetches on window/region change
  useEffect(() => {
    let cancelled = false;

    const fetchCharts = async () => {
      try {
        const params = new URLSearchParams({
          window: String(windowMonths),
          region,
        });
        const response = await apiFetch(`/dashboard/charts?${params.toString()}`, { cache: 'no-store', timeoutMs: 9000, retryOnTimeout: false, allowLocalFallback: false });
        if (!response.ok) return;
        const payload: ChartData = await response.json();
        if (!cancelled) setChartData(payload);
      } catch {
        // silently fall back to empty state
      }
    };

    fetchCharts();
    // Optionally, you can refresh every 6 hours if you want auto-refresh:
    // const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    // const interval = window.setInterval(fetchCharts, SIX_HOURS_MS);

    return () => {
      cancelled = true;
      // window.clearInterval(interval);
    };
  }, [windowMonths, region]);

  useEffect(() => {
    let cancelled = false;

    const fetchFeedStatus = async () => {
      try {
        const response = await apiFetch('/news/summary', { cache: 'no-store', timeoutMs: 7000, retryOnTimeout: false, allowLocalFallback: false });
        if (!response.ok) return;
        const payload: NewsSummaryLite = await response.json();
        if (!cancelled) {
          setLiveFeeds((payload.external_sources || []).slice(0, 6));
        }
      } catch {
      }
    };

    fetchFeedStatus();
    const interval = window.setInterval(fetchFeedStatus, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const statsData = useMemo(
    () => [
      {
        icon: Database,
        label: 'Reports Generated',
        value: (summary?.overview.reports_total ?? 0).toLocaleString(),
        trend: summary?.overview.reports_trend_pct ?? 0,
      },
      {
        icon: Zap,
        label: 'Active Risk Assessments',
        value: (summary?.overview.active_risk_analyses ?? 0).toLocaleString(),
        trend: summary?.overview.risk_trend_pct ?? 0,
      },
      {
        icon: FileText,
        label: 'Community Briefs Published',
        value: (summary?.overview.community_briefs_total ?? 0).toLocaleString(),
        trend: summary?.overview.briefs_trend_pct ?? 0,
      },
      {
        icon: MessageSquare,
        label: 'AI Workspace Queries',
        value: (summary?.overview.ai_queries_total ?? 0).toLocaleString(),
        trend: summary?.overview.ai_trend_pct ?? 0,
      },
    ],
    [summary]
  );

  const healthMetrics = useMemo(
    () => [
      { label: 'AI Services', percentage: summary?.health.ai_services_pct ?? 0 },
      { label: 'Data Processing', percentage: summary?.health.data_processing_pct ?? 0 },
      { label: 'Operational Readiness', percentage: summary?.health.api_endpoints_pct ?? 0 },
    ],
    [summary]
  );

  const recentActivity = summary?.recent_activity ?? [];
  const liveFeedsUp = liveFeeds.filter((feed) => feed.status === 'ok').length;
  const healthScore = useMemo(() => {
    if (!summary) return null;
    const values = [
      summary.health.ai_services_pct,
      summary.health.data_processing_pct,
      summary.health.api_endpoints_pct,
    ].filter((value) => Number.isFinite(value));
    if (values.length === 0) return null;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }, [summary]);

  const sourceAvailabilityPct = useMemo(() => {
    if (liveFeeds.length === 0) return null;
    return (liveFeedsUp / liveFeeds.length) * 100;
  }, [liveFeeds.length, liveFeedsUp]);

  const systemStatus = useMemo(() => {
    if (!summary) return 'Awaiting Data';
    if (healthScore === null) return 'Awaiting Data';
    const feedGate = sourceAvailabilityPct === null || sourceAvailabilityPct >= 60;
    if (healthScore >= 85 && feedGate) return 'Operational';
    if (healthScore >= 60) return 'Monitoring';
    return 'Degraded';
  }, [summary, healthScore, sourceAvailabilityPct]);

  const systemStatusClass =
    systemStatus === 'Operational'
      ? 'text-emerald'
      : systemStatus === 'Monitoring'
      ? 'text-amber-300'
      : systemStatus === 'Degraded'
      ? 'text-neon-coral'
      : 'text-text-secondary';

  return (
    <main className="min-h-screen bg-gradient-dark pb-20 relative">
      <Navbar />
      <FloatingParticles count={20} />

      {/* Header */}
      <section className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-2">
              Nerexis Operational Intelligence Dashboard
            </h1>
            <p className="text-text-secondary">Executive command surface for marine and climate intelligence, built for rapid decisions, accountable workflows, and transparent reporting.</p>
            <p className="text-sm text-text-secondary mt-2">
              {summary?.generated_at
                ? `Last sync: ${new Date(summary.generated_at).toLocaleString()}`
                : 'Awaiting first dashboard sync...'}
            </p>
            <p className="text-xs text-text-secondary mt-1">
              System status: <span className={systemStatusClass}>{systemStatus}</span>
              {healthScore !== null ? ` • Health score ${healthScore.toFixed(1)}%` : ''}
              {sourceAvailabilityPct !== null ? ` • Source availability ${sourceAvailabilityPct.toFixed(0)}%` : ''}
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Governance Notice</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Dashboard indicators support monitoring and prioritization. For formal policy, legal, or safety-critical decisions, validate results with source datasets and domain review.
                Need clarification on data handling or compliance? Visit <Link href="/contact" className="font-semibold text-cyan hover:text-text-primary">Contact</Link>.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/reports" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">Open Reporting Workspace</Link>
              <Link href="/analytics" className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5">Open Analytics Command Center</Link>
            </div>
          </motion.div>
        </div>
      </section>

      {loading && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <GlassCard>
              <p className="text-text-secondary">Loading live dashboard data...</p>
            </GlassCard>
          </div>
        </section>
      )}

      {error && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <GlassCard>
              <p className="text-neon-coral">{error}</p>
            </GlassCard>
          </div>
        </section>
      )}

      {/* Stats Cards */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsData.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
              >
                <StatCard {...stat} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Charts Row: SST + Species Distribution */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto mb-4 flex flex-wrap gap-4 items-center">
          {/* Window Selector */}
          <div>
            <label className="text-xs font-semibold text-text-secondary mr-2">Window:</label>
            <select
              value={windowMonths}
              onChange={e => setWindowMonths(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              {WINDOW_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {/* Region Selector */}
          <div>
            <label className="text-xs font-semibold text-text-secondary mr-2">Region:</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {REGION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SST Area Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-2"
          >
            <GlassCard>
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-lg font-bold text-text-primary">Sea Surface Temperature Trend</h2>
                {chartData && (
                  <span className="text-[11px] text-text-secondary bg-slate-100 rounded px-2 py-0.5 whitespace-nowrap">
                    {chartData.sst_observation_count} obs · {chartData.regions_monitored} regions
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary mb-4">
                {chartData ? 'Live signal from Open-Meteo hourly ocean feeds.' : 'Loading live SST data...'}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData?.sst_trend ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sstGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={(v) => `${v}°`} />
                  <Tooltip
                    formatter={(value: number) => [`${value}°C`, 'SST']}
                    contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="temp" stroke="#2563EB" strokeWidth={2} fill="url(#sstGradient)" dot={{ r: 3, fill: '#2563EB' }} />
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>
          </motion.div>

          {/* Species Distribution horizontal bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <GlassCard>
              <h2 className="text-lg font-bold text-text-primary mb-1">Regional Observation Distribution</h2>
              <p className="text-xs text-text-secondary mb-4">
                {chartData ? 'Derived from live report and observation datasets.' : 'Loading...'}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData?.species_distribution ?? []} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <YAxis type="category" dataKey="region" tick={{ fontSize: 11 }} stroke="#6B7280" width={80} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Count']}
                    contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* Actionable Insights */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <GlassCard>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <Bell size={20} className="text-bioluminescent" />
                  Operational Insights
                  {chartData && (
                    <span className="text-xs font-normal text-text-secondary ml-2">
                      (live, refreshes every 6h)
                    </span>
                  )}
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(chartData?.insights ?? []).length > 0 ? (
                  (chartData!.insights).map((insight, i) => {
                    const style = INSIGHT_STYLE[insight.type] ?? INSIGHT_STYLE_DEFAULT;
                    const IconComp = style.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.07 }}
                        className={`rounded-lg border p-4 ${style.bgClass}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <IconComp size={16} className={style.colorClass} />
                          <span className={`text-sm font-semibold ${style.colorClass}`}>{insight.title}</span>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">{insight.body}</p>
                      </motion.div>
                    );
                  })
                ) : (
                  <p className="text-sm text-text-secondary col-span-4">
                    {chartData ? 'No live insights available yet; dataset ingestion is still in progress.' : 'Loading live insights...'}
                  </p>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Health Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-1"
          >
            <GlassCard>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary mb-2">System Health</h2>
                <p className="text-xs text-text-secondary mb-3">Service stability, data pipelines, and source availability.</p>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald rounded-full animate-pulse shadow-glow" />
                  <span className={`text-sm font-semibold ${systemStatusClass}`}>{systemStatus}</span>
                </div>
              </div>

              <div className="space-y-6">
                {healthMetrics.map((metric, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-text-secondary">{metric.label}</span>
                      <span className="text-sm font-semibold text-cyan">{metric.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-white bg-opacity-10 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(0, Math.min(metric.percentage, 100))}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 1 }}
                        className="h-full bg-gradient-to-r from-cyan to-teal"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-cyan bg-opacity-10 rounded-lg border border-cyan border-opacity-20">
                <div className="flex items-center space-x-2 mb-3">
                  <Server size={18} className="text-cyan" />
                  <span className="text-sm font-semibold text-cyan">Shared Reports Coverage: {(summary?.health.shared_reports_pct ?? 0).toFixed(2)}%</span>
                </div>
                <p className="text-xs text-text-secondary">
                  {(summary?.health.shared_reports_count ?? 0).toLocaleString()} / {(summary?.health.share_eligible_reports_count ?? 0).toLocaleString()} reports currently have secured share links.
                </p>
              </div>

              <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">External Feed Availability</p>
                  <p className="text-xs text-text-secondary">UP {liveFeedsUp}/{liveFeeds.length || 0}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {liveFeeds.length === 0 ? (
                    <span className="text-xs text-text-secondary">Source status will appear after feed sync.</span>
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
            </GlassCard>
          </motion.div>

          {/* Recent Activity Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <GlassCard>
              <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center space-x-2">
                <Activity size={20} className="text-cyan" />
                <span>Recent Platform Activity</span>
              </h2>

              <div className="space-y-4">
                {recentActivity.length === 0 && (
                  <p className="text-sm text-text-secondary">No activity has been recorded yet. Generate reports or run AI workflows to populate this feed.</p>
                )}
                {recentActivity.map((activity, i) => (
                  <motion.div
                    key={`${activity.title}-${activity.created_at}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className="flex items-start space-x-4 p-3 rounded-lg hover:bg-white hover:bg-opacity-5 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary font-medium truncate">{activity.title}</p>
                      <p className="text-sm text-text-secondary">{toRelativeTime(activity.created_at)}</p>
                    </div>
                    <Badge variant={getBadgeVariant(activity.status)}>
                      {activity.status}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* Quick Stats Bottom */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <LatestNewsPreview title="Latest Ocean + Biodiversity Headlines" />
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <GlassCard className="text-center">
              <Cpu className="w-8 h-8 mx-auto mb-3 text-teal" />
              <p className="text-3xl font-bold text-text-primary mb-1">
                {`${Math.round(summary?.quick.avg_predictive_response_ms ?? 0)}ms`}
              </p>
              <p className="text-sm text-text-secondary">Average Predictive API Response</p>
            </GlassCard>
            <GlassCard className="text-center">
              <Globe className="w-8 h-8 mx-auto mb-3 text-cyan" />
              <p className="text-3xl font-bold text-text-primary mb-1">{summary?.quick.coastal_regions_monitored ?? 0}</p>
              <p className="text-sm text-text-secondary">Coastal Regions Monitored</p>
            </GlassCard>
            <GlassCard className="text-center">
              <Zap className="w-8 h-8 mx-auto mb-3 text-emerald" />
              <p className="text-3xl font-bold text-text-primary mb-1">
                {formatDataSizeFromKb(summary?.quick.marine_data_processed_today_kb ?? 0)}
              </p>
              <p className="text-sm text-text-secondary">Marine Data Processed (Today)</p>
            </GlassCard>
            <GlassCard className="text-center">
              <Database className="w-8 h-8 mx-auto mb-3 text-electric-violet" />
              <p className="text-3xl font-bold text-text-primary mb-1">
                {(summary?.quick.oceanography_observations ?? 0).toLocaleString()} / {(summary?.quick.biodiversity_observations ?? 0).toLocaleString()}
              </p>
              <p className="text-sm text-text-secondary">Oceanography / Biodiversity Observations</p>
            </GlassCard>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
