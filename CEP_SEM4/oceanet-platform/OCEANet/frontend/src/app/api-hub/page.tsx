'use client';

import { motion } from 'framer-motion';
import { Code, BookOpen, Lock, Zap, Database, BarChart3, Copy, ExternalLink, RefreshCw, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { GlassCard, Badge } from '@/components/Cards';
import { FloatingParticles } from '@/components/Animations';
import { API_BASE_URL, apiFetch } from '@/utils/api';
import { useEffect, useMemo, useState } from 'react';

type EndpointInfo = {
  path: string;
  method: string;
  summary: string;
  category: string;
};

type LiveSnapshot = {
  backendStatus: 'online' | 'offline' | 'degraded';
  datasetsCount: number;
  reportsCount: number;
  newsArticles: number;
  activeRegions: number;
  riskIndex: number;
  lastUpdated: string;
};

type ProbeState = {
  loading: boolean;
  ok: boolean | null;
  code?: number;
  latencyMs?: number;
  error?: string;
};

type OpenApiMeta = {
  title: string;
  version: string;
  totalPaths: number;
  totalOperations: number;
  schemaCount: number;
  maxMessageLength: number | null;
  maxHistoryItems: number | null;
};

const inferCategory = (path: string): string => {
  if (path.startsWith('/auth/')) return 'Authentication';
  if (path.startsWith('/ai/')) return 'AI';
  if (path.startsWith('/analytics/')) return 'Analytics';
  if (path.startsWith('/dashboard/')) return 'Analytics';
  if (path.startsWith('/platform/')) return 'Platform';
  if (path.startsWith('/reports/')) return 'Reports';
  if (path.startsWith('/reports')) return 'Reports';
  if (path.startsWith('/datasets/')) return 'Datasets';
  if (path.startsWith('/datasets')) return 'Datasets';
  if (path.startsWith('/news/')) return 'News';
  if (path.startsWith('/admin/')) return 'Admin';
  return 'System';
};

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Unknown';
  }
};

const exampleCode = `// Example: Send a marine insight query
const response = await fetch('${API_BASE_URL}/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Summarize sea temperature rise risk for coastal communities',
    history: [],
  }),
});

const data = await response.json();
console.log(data.reply, data.provider);`;

export default function APIHub() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [endpoints, setEndpoints] = useState<EndpointInfo[]>([]);
  const [openApiLoaded, setOpenApiLoaded] = useState(false);
  const [openApiMeta, setOpenApiMeta] = useState<OpenApiMeta>({
    title: 'Nerexis Backend',
    version: 'Unknown',
    totalPaths: 0,
    totalOperations: 0,
    schemaCount: 0,
    maxMessageLength: null,
    maxHistoryItems: null,
  });
  const [snapshot, setSnapshot] = useState<LiveSnapshot>({
    backendStatus: 'offline',
    datasetsCount: 0,
    reportsCount: 0,
    newsArticles: 0,
    activeRegions: 0,
    riskIndex: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [probeMap, setProbeMap] = useState<Record<string, ProbeState>>({});

  const handleCopyCode = () => {
    navigator.clipboard.writeText(exampleCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleOpenDocs = () => {
    window.open(`${API_BASE_URL}/docs`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenRedoc = () => {
    window.open(`${API_BASE_URL}/redoc`, '_blank', 'noopener,noreferrer');
  };

  const groupedEndpoints = useMemo(() => {
    const groups = new Map<string, EndpointInfo[]>();
    endpoints.forEach((endpoint) => {
      const category = endpoint.category || inferCategory(endpoint.path);
      const list = groups.get(category) || [];
      list.push(endpoint);
      groups.set(category, list);
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, list]) => ({
        category,
        endpoints: list.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method)),
      }));
  }, [endpoints]);

  useEffect(() => {
    let cancelled = false;

    const verifyAdminSession = async () => {
      const tokenMatch = document.cookie
        .split('; ')
        .find((row) => row.startsWith('nerexis_auth_token='));
      const token = tokenMatch ? tokenMatch.split('=')[1] : '';

      if (!token) {
        if (!cancelled) {
          setAuthResolved(true);
          router.replace('/sign-in');
        }
        return;
      }

      try {
        const response = await apiFetch('/auth/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Unauthorized');
        }

        const data = await response.json();
        const role = data?.user?.role;

        if (!cancelled) {
          if (role === 'admin') {
            setIsAuthorized(true);
          } else {
            router.replace('/');
          }
        }
      } catch {
        if (!cancelled) {
          router.replace('/sign-in');
        }
      } finally {
        if (!cancelled) {
          setAuthResolved(true);
        }
      }
    };

    verifyAdminSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadOpenApi = async () => {
    try {
      const response = await apiFetch('/openapi.json', { cache: 'no-store', timeoutMs: 20000 });
      if (!response.ok) {
        setOpenApiLoaded(false);
        setEndpoints([]);
        return;
      }
      const schema = await response.json();
      const paths = schema?.paths || {};
      const info = schema?.info || {};
      const schemas = schema?.components?.schemas || {};
      const chatRequest = schemas?.ChatRequest?.properties || {};
      const chatMessage = schemas?.ChatMessage?.properties || {};

      const maxMessageLength =
        typeof chatRequest?.message?.maxLength === 'number'
          ? chatRequest.message.maxLength
          : typeof chatMessage?.content?.maxLength === 'number'
            ? chatMessage.content.maxLength
            : null;

      const maxHistoryItems =
        typeof chatRequest?.history?.maxItems === 'number' ? chatRequest.history.maxItems : null;

      const discovered: EndpointInfo[] = [];

      Object.entries(paths).forEach(([path, methods]) => {
        Object.entries((methods as Record<string, unknown>) || {}).forEach(([method, detail]) => {
          const normalizedMethod = method.toUpperCase();
          if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) return;
          const info = (detail || {}) as { summary?: string; description?: string };
          discovered.push({
            method: normalizedMethod,
            path,
            summary: info.summary || info.description || 'No description provided',
            category: inferCategory(path),
          });
        });
      });

      setEndpoints(discovered);
      setOpenApiMeta({
        title: typeof info.title === 'string' ? info.title : 'Nerexis Backend',
        version: typeof info.version === 'string' ? info.version : 'Unknown',
        totalPaths: Object.keys(paths).length,
        totalOperations: discovered.length,
        schemaCount: Object.keys(schemas).length,
        maxMessageLength,
        maxHistoryItems,
      });
      setOpenApiLoaded(true);
    } catch {
      setOpenApiLoaded(false);
      setEndpoints([]);
    }
  };

  const loadLiveSnapshot = async () => {
    const settled = await Promise.allSettled([
      apiFetch('/', { cache: 'no-store', timeoutMs: 5000, retryOnTimeout: false }),
      apiFetch('/_legacy/dashboard/summary', { cache: 'no-store', timeoutMs: 9000, retryOnTimeout: false }),
      apiFetch('/_legacy/analytics/summary', { cache: 'no-store', timeoutMs: 9000, retryOnTimeout: false }),
      apiFetch('/news/summary', { cache: 'no-store', timeoutMs: 7000, retryOnTimeout: false }),
      apiFetch('/reports', { cache: 'no-store', timeoutMs: 7000, retryOnTimeout: false }),
      apiFetch('/datasets', { cache: 'no-store', timeoutMs: 7000, retryOnTimeout: false }),
    ]);

    const [healthRes, dashboardRes, analyticsRes, newsRes, reportsRes, datasetsRes] = settled;

    const readJson = async (result: PromiseSettledResult<Response>) => {
      if (result.status !== 'fulfilled') return null;
      if (!result.value.ok) return null;
      try {
        return await result.value.json();
      } catch {
        return null;
      }
    };

    const [dashboardData, analyticsData, newsData, reportsData, datasetsData] = await Promise.all([
      readJson(dashboardRes),
      readJson(analyticsRes),
      readJson(newsRes),
      readJson(reportsRes),
      readJson(datasetsRes),
    ]);

    const backendStatus: LiveSnapshot['backendStatus'] =
      healthRes.status === 'fulfilled'
        ? (dashboardData && analyticsData ? 'online' : 'degraded')
        : 'offline';

    const reportsCount =
      Array.isArray(reportsData?.reports)
        ? reportsData.reports.length
        : Number(reportsData?.total_reports || reportsData?.count || 0);
    const datasetsCount =
      Array.isArray(datasetsData?.datasets)
        ? datasetsData.datasets.length
        : Number(datasetsData?.total_datasets || datasetsData?.count || 0);
    const newsArticles =
      Array.isArray(newsData?.articles)
        ? newsData.articles.length
        : Number(newsData?.total_articles || newsData?.article_count || 0);
    const activeRegions = Number(
      analyticsData?.totals?.regions ||
        analyticsData?.regions?.length ||
        analyticsData?.region_count ||
        0,
    );
    const riskIndex = Number(
      analyticsData?.risk?.overall ?? analyticsData?.overall_risk ?? dashboardData?.risk_score ?? 0,
    );

    setSnapshot({
      backendStatus,
      datasetsCount,
      reportsCount,
      newsArticles,
      activeRegions,
      riskIndex,
      lastUpdated: new Date().toISOString(),
    });
  };

  const refreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadOpenApi(), loadLiveSnapshot()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const probeEndpoint = async (method: string, path: string) => {
    const key = `${method} ${path}`;

    if (method !== 'GET' || path.includes('{')) {
      setProbeMap((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          ok: false,
          error: 'Probe disabled for non-GET or parameterized endpoints',
        },
      }));
      return;
    }

    setProbeMap((prev) => ({ ...prev, [key]: { loading: true, ok: null } }));
    const started = performance.now();
    try {
      const response = await apiFetch(path, { cache: 'no-store', timeoutMs: 25000 });
      const latencyMs = Math.round(performance.now() - started);
      setProbeMap((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          ok: response.ok,
          code: response.status,
          latencyMs,
          error: response.ok ? undefined : `HTTP ${response.status}`,
        },
      }));
    } catch (error) {
      const latencyMs = Math.round(performance.now() - started);
      setProbeMap((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          ok: false,
          latencyMs,
          error: error instanceof Error ? error.message : 'Probe failed',
        },
      }));
    }
  };

  useEffect(() => {
    if (!authResolved || !isAuthorized) return;

    refreshAll();
    const interval = window.setInterval(refreshAll, 30000);
    return () => window.clearInterval(interval);
  }, [authResolved, isAuthorized]);

  if (!authResolved || !isAuthorized) {
    return (
      <main className="min-h-screen bg-gradient-dark flex items-center justify-center px-4">
        <p className="text-text-secondary text-sm">Verifying access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ocean-gradient pb-20">
      <Navbar />
      <FloatingParticles count={15} />

      {/* Header */}
      <section className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-2">
              {openApiMeta.title} API Hub
            </h1>
            <p className="text-text-secondary">Live API console powered by real backend data and OpenAPI v{openApiMeta.version}</p>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Admin Compliance Notice</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                This console is restricted to admin users. Use only authorized credentials, avoid exposing session tokens, and do not test endpoints with restricted or personal data outside approved workflows.
                For policy or legal handling questions, see <Link href="/privacy" className="font-semibold text-cyan hover:text-text-primary">Privacy Notice</Link> and <Link href="/terms" className="font-semibold text-cyan hover:text-text-primary">Terms of Use</Link>.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Badges */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-3">
          <Badge variant="info">REST API v1.0</Badge>
          <Badge variant={snapshot.backendStatus === 'online' ? 'success' : 'warning'}>
            Backend {snapshot.backendStatus}
          </Badge>
          <Badge variant={openApiLoaded ? 'success' : 'warning'}>{openApiLoaded ? 'OpenAPI Synced' : 'OpenAPI Unavailable'}</Badge>
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white bg-opacity-10 border border-white border-opacity-20 text-text-secondary hover:text-cyan"
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2 bg-white bg-opacity-5 p-2 rounded-lg border border-white border-opacity-10 w-fit">
          {['Overview', 'Endpoints', 'Examples', 'Authentication'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.toLowerCase()
                  ? 'bg-cyan text-ocean-900'
                  : 'text-text-secondary hover:text-cyan'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Database,
                title: 'Live Dataset Count',
                desc: `${snapshot.datasetsCount} datasets currently available`,
              },
              {
                icon: Zap,
                title: 'Live Report Count',
                desc: `${snapshot.reportsCount} reports indexed from backend`,
              },
              {
                icon: BarChart3,
                title: 'OpenAPI Operations',
                desc: `${openApiMeta.totalOperations} operations across ${openApiMeta.totalPaths} paths`,
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass rounded-lg p-6"
                >
                  <Icon size={32} className="text-cyan mb-4" />
                  <h3 className="text-xl font-bold text-text-primary mb-3">{item.title}</h3>
                  <p className="text-text-secondary">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-7xl mx-auto mt-6"
          >
            <GlassCard>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                    <Activity size={20} className="text-cyan" />
                    Real-Time Platform Snapshot
                  </h2>
                  <p className="text-text-secondary text-sm mt-1">Updated at {formatTime(snapshot.lastUpdated)}</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <span>Regions: {snapshot.activeRegions}</span>
                  <span>News Articles: {snapshot.newsArticles}</span>
                  <span>Schemas: {openApiMeta.schemaCount}</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Quick Start */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-7xl mx-auto mt-8"
          >
            <GlassCard>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Quick Start Guide</h2>
              <div className="space-y-4">
                <div className="p-4 bg-white bg-opacity-5 rounded-lg">
                  <p className="text-cyan font-semibold mb-2">1. Start Backend Service</p>
                  <p className="text-text-secondary">
                    Run the FastAPI backend at http://localhost:8000 and verify health on GET /.
                  </p>
                </div>
                <div className="p-4 bg-white bg-opacity-5 rounded-lg">
                  <p className="text-teal font-semibold mb-2">2. Authenticate User Flows</p>
                  <p className="text-text-secondary">
                    Use /auth/signup and /auth/signin to issue bearer tokens for protected routes.
                  </p>
                </div>
                <div className="p-4 bg-white bg-opacity-5 rounded-lg">
                  <p className="text-emerald font-semibold mb-2">3. Explore Live Contract</p>
                  <p className="text-text-secondary">
                    Open /docs or /redoc to inspect the same OpenAPI contract rendered in this page.
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </section>
      )}

      {/* Endpoints Tab */}
      {activeTab === 'endpoints' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto space-y-8">
            {groupedEndpoints.length === 0 && (
              <GlassCard>
                <p className="text-text-secondary">
                  OpenAPI endpoint discovery is currently unavailable. Start the backend and refresh to load the live API contract.
                </p>
              </GlassCard>
            )}
            {groupedEndpoints.map((section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <h2 className="text-2xl font-bold text-text-primary mb-4">{section.category}</h2>
                <div className="space-y-4">
                  {section.endpoints.map((endpoint, j) => (
                    <GlassCard key={j}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="info">{endpoint.method}</Badge>
                            <code className="text-cyan font-mono">{endpoint.path}</code>
                          </div>
                          <p className="text-text-secondary">{endpoint.summary}</p>
                          {probeMap[`${endpoint.method} ${endpoint.path}`] && (
                            <p className="text-xs mt-2 text-text-secondary">
                              {probeMap[`${endpoint.method} ${endpoint.path}`].loading
                                ? 'Probing...'
                                : probeMap[`${endpoint.method} ${endpoint.path}`].ok
                                  ? `Healthy (${probeMap[`${endpoint.method} ${endpoint.path}`].code}) in ${probeMap[`${endpoint.method} ${endpoint.path}`].latencyMs} ms`
                                  : `Probe failed: ${probeMap[`${endpoint.method} ${endpoint.path}`].error || 'Unknown error'}`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigator.clipboard.writeText(`${endpoint.method} ${endpoint.path}`)}
                            className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg"
                            title="Copy endpoint"
                          >
                            <Copy size={18} className="text-text-secondary hover:text-cyan" />
                          </button>
                          <button
                            onClick={() => probeEndpoint(endpoint.method, endpoint.path)}
                            className="px-3 py-1.5 rounded-lg text-xs bg-white bg-opacity-10 border border-white border-opacity-20 text-text-secondary hover:text-cyan"
                            title="Probe endpoint"
                          >
                            Probe
                          </button>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Examples Tab */}
      {activeTab === 'examples' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-lg p-6"
            >
              <h2 className="text-2xl font-bold text-text-primary mb-6 flex items-center space-x-2">
                <Code size={28} />
                <span>JavaScript Example</span>
              </h2>
              <div className="bg-ocean-900 rounded-lg p-4 overflow-x-auto mb-4">
                <pre className="text-text-primary font-mono text-sm">{exampleCode}</pre>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleCopyCode}
                className="btn-secondary px-4 py-2 inline-flex items-center space-x-2"
              >
                <Copy size={18} />
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </motion.button>
            </motion.div>
          </div>
        </section>
      )}

      {/* Authentication Tab */}
      {activeTab === 'authentication' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-4xl mx-auto space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-lg p-6"
            >
              <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center space-x-2">
                <Lock size={28} />
                <span>API Authentication</span>
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-cyan font-semibold mb-2">Bearer Token</p>
                  <p className="text-text-secondary mb-3">
                    Protected requests require an Authorization header with your session token:
                  </p>
                  <div className="bg-ocean-900 rounded-lg p-4 font-mono text-sm text-text-primary">
                    Authorization: Bearer your_session_token
                  </div>
                </div>
                <div className="p-4 bg-emerald bg-opacity-10 border border-emerald border-opacity-30 rounded-lg">
                  <p className="text-emerald font-semibold mb-2">Security Best Practices</p>
                  <ul className="text-text-secondary text-sm space-y-2">
                    <li>• Keep session tokens secret and never commit them to version control</li>
                    <li>• Use HTTPS for all API requests</li>
                    <li>• Expire inactive sessions and require re-authentication</li>
                    <li>• Validate user input before sending to /ai/chat</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-lg p-6"
            >
              <h2 className="text-2xl font-bold text-text-primary mb-4">Rate Limits</h2>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-white bg-opacity-5 rounded-lg">
                  <span className="text-text-secondary">Auth requests:</span>
                  <span className="text-cyan font-semibold">Bearer token via Authorization header</span>
                </div>
                <div className="flex justify-between p-3 bg-white bg-opacity-5 rounded-lg">
                  <span className="text-text-secondary">OpenAPI operations:</span>
                  <span className="text-cyan font-semibold">{openApiMeta.totalOperations}</span>
                </div>
                <div className="flex justify-between p-3 bg-white bg-opacity-5 rounded-lg">
                  <span className="text-text-secondary">Max message length:</span>
                  <span className="text-cyan font-semibold">
                    {openApiMeta.maxMessageLength ? `${openApiMeta.maxMessageLength} chars` : 'Not declared in OpenAPI'}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-white bg-opacity-5 rounded-lg">
                  <span className="text-text-secondary">Max chat history items:</span>
                  <span className="text-cyan font-semibold">
                    {openApiMeta.maxHistoryItems ?? 'Not declared in OpenAPI'}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Documentation Button */}
      <section className="px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={handleOpenDocs}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <BookOpen size={20} />
            <span>Open Swagger Docs</span>
            <ExternalLink size={18} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={handleOpenRedoc}
            className="btn-secondary inline-flex items-center space-x-2"
          >
            <BookOpen size={20} />
            <span>Open ReDoc</span>
            <ExternalLink size={18} />
          </motion.button>
        </div>
      </section>
    </main>
  );
}
