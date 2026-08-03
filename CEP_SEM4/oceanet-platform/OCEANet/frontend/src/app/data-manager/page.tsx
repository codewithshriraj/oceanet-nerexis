'use client';

import { motion } from 'framer-motion';
import { Upload, RefreshCw, Search, Filter, Download, Eye, Share2, Database, Trash2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { StatCard, Badge, LoadingSkeleton } from '@/components/Cards';
import { FloatingParticles } from '@/components/Animations';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/store/notificationStore';
import { apiFetch, API_BASE_URL } from '@/utils/api';

const getCookieValue = (name: string) => {
  if (typeof document === 'undefined') return '';
  const encodedName = `${name}=`;
  const value = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(encodedName))
    ?.slice(encodedName.length);
  return value ? decodeURIComponent(value) : '';
};

type ReportRecord = {
  id: number;
  title: string;
  report_type: string;
  region: string;
  status: string;
  format: string;
  size: string;
  created_at: string;
};

type AnalyticsSummary = {
  generated_at: string;
  totals: {
    reports: number;
    regions: number;
    types: number;
    users: number;
  };
};

type DashboardSummary = {
  overview: {
    active_risk_analyses: number;
  };
  quick?: {
    biodiversity_observations?: number;
    oceanography_observations?: number;
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

type StoredDataset = {
  id: number;
  name: string;
  dataset_type: string;
  source: string;
  size: string;
  size_bytes?: number;
  status: string;
  created_at: string;
};

type DatasetRefreshStatus = {
  is_running: boolean;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_ingested_count: number;
  total_runs: number;
  total_ingested: number;
  refresh_interval_seconds: number;
  thread_alive: boolean;
  complete_bootstrap?: {
    is_running?: boolean;
    last_started_at?: string | null;
    last_completed_at?: string | null;
    last_error?: string | null;
    last_reason?: string | null;
    last_job_status?: string | null;
    last_job_id?: string | null;
  };
};

type ReportSyncStatus = {
  is_running: boolean;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_generated_count: number;
  total_runs: number;
  total_generated: number;
  schedule_interval_seconds: number;
  thread_alive: boolean;
};

type BulkIngestResult = {
  executed_at: string;
  inserted_total: number;
  web_attempted: number;
  web_inserted: number;
  web_failed: number;
  live_checked: number;
  live_inserted: number;
  failures: Array<{ name: string; reason: string }>;
};

type DatasetRow = {
  id: string;
  recordId: number;
  kind: 'report' | 'dataset';
  name: string;
  type: string;
  source: string;
  size: string;
  status: string;
  created: string;
  isPreviewable: boolean;
  isShareable: boolean;
  isDownloadable: boolean;
};

type DatasetValidationResult = {
  key: string;
  name: string;
  accepted: boolean;
  reason: string;
  size_bytes: number;
  dataset_type: string;
  duplicate_of_id?: number;
  trust_score: number;
  validation_notes: string[];
};

type RemoteImportJob = {
  id: string;
  status: string;
  phase: string;
  dataset_name: string;
  source: string;
  dataset_type: string;
  download_url: string;
  progress_percent: number;
  downloaded_bytes: number;
  total_bytes: number;
  message: string;
  error?: string | null;
  dataset_id?: number | null;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  result?: {
    ingested_dataset?: StoredDataset | null;
  } | null;
};

type ArchiveSource = {
  id: string;
  name: string;
  source: string;
  dataset_type: string;
  format: string;
  access_mode: 'direct_file' | 'portal';
  download_url: string;
  catalog_url: string;
  description: string;
  import_enabled: boolean;
};

const getStatusBadge = (status: string) => {
  if (status === 'Completed' || status === 'Generated' || status === 'Published') return 'success';
  if (status === 'Stored') return 'success';
  if (status === 'Processing') return 'warning';
  return 'default';
};

const inferDatasetType = (reportType: string) => {
  const normalized = reportType.toLowerCase();
  if (normalized.includes('temperature') || normalized.includes('climate')) return 'Oceanographic';
  if (normalized.includes('biodiversity')) return 'Biodiversity';
  if (normalized.includes('community')) return 'Community';
  if (normalized.includes('resource')) return 'Resource';
  return 'Environmental';
};

const inferSource = (reportType: string) => {
  const normalized = reportType.toLowerCase();
  if (normalized.includes('community')) return 'Community Inputs + Nerexis AI';
  if (normalized.includes('biodiversity')) return 'Biodiversity Stream + Nerexis AI';
  if (normalized.includes('temperature') || normalized.includes('climate')) return 'Climate Sensor Feed + Nerexis AI';
  return 'Integrated Nerexis Pipeline';
};

const formatTotalBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const formatOptionalCount = (value: number | undefined | null) =>
  typeof value === 'number' ? value.toLocaleString() : 'N/A';

const getTrustTone = (score: number) => {
  if (score >= 85) return 'text-secondary border-secondary/30 bg-secondary/10';
  if (score >= 65) return 'text-cyan border-cyan/30 bg-cyan/10';
  if (score >= 40) return 'text-yellow-300 border-yellow-300/30 bg-yellow-300/10';
  return 'text-neon-coral border-neon-coral/30 bg-neon-coral/10';
};

export default function DataManager() {
  const router = useRouter();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [liveFeeds, setLiveFeeds] = useState<LiveFeedStatus[]>([]);
  const [storedDatasets, setStoredDatasets] = useState<StoredDataset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploadingDataSource, setIsUploadingDataSource] = useState(false);
  const [isValidatingDataSource, setIsValidatingDataSource] = useState(false);
  const [uploadSource, setUploadSource] = useState('manual');
  const [kaggleName, setKaggleName] = useState('');
  const [kaggleUrl, setKaggleUrl] = useState('');
  const [kaggleType, setKaggleType] = useState('Oceanographic');
  const [isKaggleIngesting, setIsKaggleIngesting] = useState(false);
  const [isBulkPresetIngesting, setIsBulkPresetIngesting] = useState(false);
  const [isResettingLiveData, setIsResettingLiveData] = useState(false);
  const [lastBulkIngestResult, setLastBulkIngestResult] = useState<BulkIngestResult | null>(null);
  const [isTriggeringRefresh, setIsTriggeringRefresh] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<DatasetRefreshStatus | null>(null);
  const [reportSyncStatus, setReportSyncStatus] = useState<ReportSyncStatus | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'general'>('general');
  const [pendingUploadFiles, setPendingUploadFiles] = useState<Array<{ key: string; file: File }>>([]);
  const [validationResults, setValidationResults] = useState<DatasetValidationResult[]>([]);
  const [remoteImportJob, setRemoteImportJob] = useState<RemoteImportJob | null>(null);
  const [archiveSources, setArchiveSources] = useState<ArchiveSource[]>([]);
  const [activeArchiveImportId, setActiveArchiveImportId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const completedRemoteJobRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const lastPartialWarningKeyRef = useRef<string | null>(null);
  const hasActivePartialWarningRef = useRef(false);
  const lastFetchErrorKeyRef = useRef<string | null>(null);
  const hasActiveFetchErrorRef = useRef(false);

  useEffect(() => {
    const role = getCookieValue('nerexis_user_role').toLowerCase();
    setUserRole(role === 'admin' ? 'admin' : 'general');
  }, []);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      const token = getCookieValue('nerexis_auth_token');
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [reportsRes, analyticsRes, dashboardRes, datasetsRes, newsSummaryRes, refreshRes, reportSyncRes, remoteJobRes, archiveSourcesRes] = await Promise.allSettled([
        apiFetch('/reports?limit=500', { cache: 'no-store', allowLocalFallback: false, timeoutMs: 9000, retryOnTimeout: false }),
        apiFetch('/_legacy/analytics/summary', { cache: 'no-store', allowLocalFallback: false, timeoutMs: 9000, retryOnTimeout: false }),
        apiFetch('/_legacy/dashboard/summary', { cache: 'no-store', allowLocalFallback: false, timeoutMs: 9000, retryOnTimeout: false }),
        apiFetch('/datasets?limit=500', { cache: 'no-store', allowLocalFallback: false, timeoutMs: 9000, retryOnTimeout: false }),
        apiFetch('/news/summary', { cache: 'no-store', allowLocalFallback: false, timeoutMs: 7000, retryOnTimeout: false }),
        apiFetch('/datasets/refresh/status', { cache: 'no-store', allowLocalFallback: false, timeoutMs: 7000, retryOnTimeout: false }),
        apiFetch('/reports/sync/status', { cache: 'no-store', allowLocalFallback: false, timeoutMs: 7000, retryOnTimeout: false }),
        apiFetch('/datasets/ingest/jobs/latest', { cache: 'no-store', allowLocalFallback: false, timeoutMs: 9000, retryOnTimeout: false, headers: authHeaders }),
        apiFetch('/datasets/archive-sources', { cache: 'no-store', allowLocalFallback: false, timeoutMs: 9000, retryOnTimeout: false, headers: authHeaders }),
      ]);

      const failures: string[] = [];

      if (reportsRes.status === 'fulfilled' && reportsRes.value.ok) {
        const reportsPayload = await reportsRes.value.json();
        setReports(reportsPayload.reports || []);
      } else {
        failures.push('reports');
      }

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
        const analyticsPayload: AnalyticsSummary = await analyticsRes.value.json();
        setAnalytics(analyticsPayload);
      } else {
        failures.push('analytics');
      }

      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
        const dashboardPayload: DashboardSummary = await dashboardRes.value.json();
        setDashboard(dashboardPayload);
      } else {
        failures.push('dashboard');
      }

      if (datasetsRes.status === 'fulfilled' && datasetsRes.value.ok) {
        const datasetsPayload: { datasets?: StoredDataset[] } = await datasetsRes.value.json();
        setStoredDatasets(datasetsPayload.datasets || []);
      } else {
        failures.push('datasets');
      }

      if (newsSummaryRes.status === 'fulfilled' && newsSummaryRes.value.ok) {
        const newsSummaryPayload: NewsSummaryLite = await newsSummaryRes.value.json();
        setLiveFeeds((newsSummaryPayload.external_sources || []).slice(0, 6));
      } else {
        setLiveFeeds([]);
        failures.push('news');
      }

      if (refreshRes.status === 'fulfilled' && refreshRes.value.ok) {
        const refreshPayload: DatasetRefreshStatus = await refreshRes.value.json();
        setRefreshStatus(refreshPayload);
      } else {
        setRefreshStatus(null);
        failures.push('refresh-status');
      }

      if (reportSyncRes.status === 'fulfilled' && reportSyncRes.value.ok) {
        const reportSyncPayload: ReportSyncStatus = await reportSyncRes.value.json();
        setReportSyncStatus(reportSyncPayload);
      } else {
        setReportSyncStatus(null);
        failures.push('report-sync-status');
      }

      if (remoteJobRes.status === 'fulfilled' && remoteJobRes.value.ok) {
        const remoteJobPayload = await remoteJobRes.value.json();
        setRemoteImportJob(remoteJobPayload?.job || null);
      }

      if (archiveSourcesRes.status === 'fulfilled' && archiveSourcesRes.value.ok) {
        const archiveSourcesPayload = await archiveSourcesRes.value.json();
        setArchiveSources(Array.isArray(archiveSourcesPayload?.sources) ? archiveSourcesPayload.sources : []);
      }

      if (failures.length === 7) {
        throw new Error('Unable to sync Data Hub. Backend is currently unavailable.');
      }

      if (failures.length > 0) {
        const warningKey = [...failures].sort().join('|');
        const canNotify =
          !hasActivePartialWarningRef.current || warningKey !== lastPartialWarningKeyRef.current;

        if (canNotify) {
          addNotification({
            message: `Partial sync completed. Delayed: ${failures.join(', ')}.`,
            type: 'warning',
          });
        }
        lastPartialWarningKeyRef.current = warningKey;
        hasActivePartialWarningRef.current = true;
      } else {
        lastPartialWarningKeyRef.current = null;
        hasActivePartialWarningRef.current = false;
      }

      lastFetchErrorKeyRef.current = null;
      hasActiveFetchErrorRef.current = false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to fetch datasets';
      const canNotify =
        !hasActiveFetchErrorRef.current || errorMessage !== lastFetchErrorKeyRef.current;

      if (canNotify) {
        addNotification({
          message: errorMessage,
          type: 'error',
        });
      }
      lastFetchErrorKeyRef.current = errorMessage;
      hasActiveFetchErrorRef.current = true;
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, 30000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!remoteImportJob?.id || !['queued', 'running'].includes(remoteImportJob.status)) return;

    const token = getCookieValue('nerexis_auth_token');
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await apiFetch(`/datasets/ingest/jobs/${remoteImportJob.id}`, {
          cache: 'no-store',
          allowLocalFallback: false,
          timeoutMs: 9000,
          retryOnTimeout: false,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) return;

        const payload = await response.json().catch(() => ({}));
        const nextJob: RemoteImportJob | null = payload?.job || null;
        setRemoteImportJob(nextJob);

        if (nextJob?.id && ['completed', 'failed'].includes(nextJob.status) && completedRemoteJobRef.current !== nextJob.id) {
          completedRemoteJobRef.current = nextJob.id;
          setActiveArchiveImportId(null);
          if (nextJob.status === 'completed') {
            await fetchData();
            addNotification({
              message: `${nextJob.dataset_name || 'Remote dataset'} import completed.`,
              type: 'success',
            });
          } else {
            addNotification({
              message: String(nextJob.error || 'Remote import failed'),
              type: 'error',
            });
          }
        }
      } catch {
        return;
      }
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [addNotification, fetchData, remoteImportJob]);

  const datasets: DatasetRow[] = useMemo(
    () => [
      ...storedDatasets.map((dataset) => ({
        id: `dataset-${dataset.id}`,
        recordId: dataset.id,
        kind: 'dataset' as const,
        name: dataset.name,
        type: dataset.dataset_type,
        source: dataset.source,
        size: dataset.size,
        status: dataset.status,
        created: dataset.created_at,
        isPreviewable: false,
        isShareable: false,
        isDownloadable: true,
      })),
      ...reports.map((report) => ({
        id: `report-${report.id}`,
        recordId: report.id,
        kind: 'report' as const,
        name: report.title,
        type: inferDatasetType(report.report_type),
        source: inferSource(report.report_type),
        size: report.size,
        status: report.status,
        created: report.created_at,
        isPreviewable: true,
        isShareable: true,
        isDownloadable: true,
      })),
    ],
    [storedDatasets, reports]
  );

  const filteredDatasets = useMemo(() => {
    return datasets.filter((dataset) => {
      const matchesFilter = selectedFilter === 'all' || dataset.type.toLowerCase() === selectedFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        dataset.name.toLowerCase().includes(query) ||
        dataset.source.toLowerCase().includes(query) ||
        dataset.type.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [datasets, searchQuery, selectedFilter]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredDatasets.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDatasets = filteredDatasets.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilter]);

  const summaryStats = useMemo(() => {
    const totalDatasetBytes = storedDatasets.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
    const standardizedFeeds = liveFeeds.length;
    const liveSyncJobs =
      Number(Boolean(refreshStatus?.is_running)) +
      Number(Boolean(reportSyncStatus?.is_running)) +
      Number(Boolean(refreshStatus?.complete_bootstrap?.is_running)) +
      Number(Boolean(remoteImportJob && ['queued', 'running'].includes(remoteImportJob.status)));
    const refreshedCount = storedDatasets.filter((dataset) => String(dataset.status).toLowerCase() === 'refreshed').length;
    const integratedDatasetsLabel = refreshedCount > 0
      ? `${storedDatasets.length.toLocaleString()} (${refreshedCount.toLocaleString()} refreshed)`
      : storedDatasets.length.toLocaleString();

    return [
      { icon: Upload, label: 'Integrated Datasets', value: integratedDatasetsLabel },
      { icon: RefreshCw, label: 'Live Sync Jobs', value: liveSyncJobs.toLocaleString() },
      { icon: Database, label: 'Oceanography Live', value: formatOptionalCount(dashboard?.quick?.oceanography_observations) },
      { icon: Database, label: 'Biodiversity Live', value: formatOptionalCount(dashboard?.quick?.biodiversity_observations) },
      { icon: Download, label: 'Standardized Feeds', value: standardizedFeeds.toLocaleString() },
      { icon: Database, label: 'Marine Data Volume', value: formatTotalBytes(totalDatasetBytes) },
    ];
  }, [dashboard, liveFeeds.length, refreshStatus?.is_running, refreshStatus?.complete_bootstrap?.is_running, reportSyncStatus?.is_running, remoteImportJob, storedDatasets]);

  const handlePreview = (datasetId: number) => {
    router.push(`/reports/${datasetId}?from=data-manager`);
  };

  const handleAddDataSourceClick = () => {
    if (userRole !== 'admin') {
      addNotification({
        message: 'Only admin users can upload datasets.',
        type: 'error',
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (userRole !== 'admin') {
      addNotification({
        message: 'Only admin users can upload datasets.',
        type: 'error',
      });
      event.target.value = '';
      return;
    }

    const token = getCookieValue('nerexis_auth_token');

    try {
      setIsValidatingDataSource(true);
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('source', uploadSource);

      const response = await apiFetch('/datasets/validate', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
        allowLocalFallback: false,
        timeoutMs: 90000,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Dataset validation failed');
      }

      const payload = await response.json();
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const indexedFiles = files.map((file, index) => ({
        key: `${file.name}__${file.size}__${file.lastModified}__${index}`,
        file,
      }));
      const normalizedResults: DatasetValidationResult[] = indexedFiles.map((entry, index) => {
        const result = results[index] || {};
        return {
          key: entry.key,
          name: String(result.name || entry.file.name),
          accepted: Boolean(result.accepted),
          reason: String(result.reason || 'Validation result unavailable'),
          size_bytes: Number(result.size_bytes || entry.file.size || 0),
          dataset_type: String(result.dataset_type || _inferDatasetTypeFromName(entry.file.name)),
          duplicate_of_id: typeof result.duplicate_of_id === 'number' ? result.duplicate_of_id : undefined,
          trust_score: Number(result.trust_score || 0),
          validation_notes: Array.isArray(result.validation_notes) ? result.validation_notes.map((item: unknown) => String(item)) : [],
        };
      });

      setPendingUploadFiles(indexedFiles);
      setValidationResults(normalizedResults);

      const acceptedCount = normalizedResults.filter((item) => item.accepted).length;
      const rejectedCount = normalizedResults.length - acceptedCount;
      addNotification({
        message: `Validation complete: ${acceptedCount} accepted, ${rejectedCount} rejected. Review and commit accepted files.`,
        type: acceptedCount > 0 ? 'success' : 'warning',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to validate data source',
        type: 'error',
      });
    } finally {
      setIsValidatingDataSource(false);
      event.target.value = '';
    }
  };

  const handleCommitValidatedUpload = async () => {
    if (userRole !== 'admin') {
      addNotification({
        message: 'Only admin users can upload datasets.',
        type: 'error',
      });
      return;
    }

    const acceptedKeys = new Set(validationResults.filter((result) => result.accepted).map((result) => result.key));
    const acceptedFiles = pendingUploadFiles.filter((entry) => acceptedKeys.has(entry.key)).map((entry) => entry.file);
    if (!acceptedFiles.length) {
      addNotification({
        message: 'No accepted files to upload. Validate files first.',
        type: 'warning',
      });
      return;
    }

    const token = getCookieValue('nerexis_auth_token');

    try {
      setIsUploadingDataSource(true);
      const formData = new FormData();
      acceptedFiles.forEach((file) => formData.append('files', file));
      formData.append('source', uploadSource);

      const response = await apiFetch('/datasets/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
        allowLocalFallback: false,
        timeoutMs: 120000,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Dataset upload failed');
      }

      const payload = await response.json();
      await fetchData();
      const storedCount = Number(payload?.stored_count || acceptedFiles.length);
      addNotification({
        message: `${storedCount} validated data source${storedCount > 1 ? 's' : ''} uploaded successfully.`,
        type: 'success',
      });
      setPendingUploadFiles([]);
      setValidationResults([]);
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to upload validated data source',
        type: 'error',
      });
    } finally {
      setIsUploadingDataSource(false);
    }
  };

  const clearValidationQueue = () => {
    setPendingUploadFiles([]);
    setValidationResults([]);
  };

  const _inferDatasetTypeFromName = (filename: string) => {
    const lower = filename.toLowerCase();
    if (lower.includes('biodiversity') || lower.includes('species') || lower.includes('obis') || lower.includes('gbif')) return 'Biodiversity';
    if (lower.includes('ocean') || lower.includes('wave') || lower.includes('tide') || lower.includes('sst') || lower.includes('salinity')) return 'Oceanographic';
    if (lower.includes('community')) return 'Community';
    return 'Environmental';
  };

  const handleTriggerLiveRefresh = async () => {
    if (userRole !== 'admin') {
      addNotification({
        message: 'Only admin users can trigger live refresh.',
        type: 'error',
      });
      return;
    }

    const token = getCookieValue('oceanet_auth_token');
    try {
      setIsTriggeringRefresh(true);
      const response = await apiFetch('/datasets/refresh/trigger', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        allowLocalFallback: false,
        timeoutMs: 180000,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Unable to refresh live datasets');
      }

      await fetchData();
      addNotification({
        message: `${Number(payload.inserted || 0)} live feed refresh files ingested.`,
        type: 'success',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to refresh datasets',
        type: 'error',
      });
    } finally {
      setIsTriggeringRefresh(false);
    }
  };

  const handleKaggleIngest = async () => {
    if (userRole !== 'admin') {
      addNotification({
        message: 'Only admin users can ingest Kaggle datasets.',
        type: 'error',
      });
      return;
    }

    if (!kaggleName.trim() || !kaggleUrl.trim()) {
      addNotification({
        message: 'Kaggle dataset name and a direct file/archive URL are required.',
        type: 'error',
      });
      return;
    }

    const token = getCookieValue('oceanet_auth_token');
    try {
      setIsKaggleIngesting(true);
      const response = await apiFetch('/datasets/ingest/kaggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          dataset_name: kaggleName.trim(),
          download_url: kaggleUrl.trim(),
          dataset_type: kaggleType,
          source: 'kaggle',
        }),
        allowLocalFallback: false,
        timeoutMs: 180000,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Kaggle ingestion failed');
      }

      if (payload?.job) {
        setRemoteImportJob(payload.job);
        completedRemoteJobRef.current = null;
      }
      setKaggleName('');
      setKaggleUrl('');
      addNotification({
        message: 'Remote dataset import started in the background.',
        type: 'success',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to ingest Kaggle dataset',
        type: 'error',
      });
    } finally {
      setIsKaggleIngesting(false);
    }
  };

  const handleArchiveSourceImport = async (source: ArchiveSource) => {
    if (userRole !== 'admin') {
      addNotification({
        message: 'Only admin users can run archive imports.',
        type: 'error',
      });
      return;
    }

    if (!source.import_enabled) {
      window.open(source.download_url, '_blank', 'noopener,noreferrer');
      return;
    }

    const token = getCookieValue('oceanet_auth_token');
    try {
      setActiveArchiveImportId(source.id);
      const response = await apiFetch('/datasets/ingest/archive-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ source_id: source.id }),
        allowLocalFallback: false,
        timeoutMs: 60000,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Archive import failed to start');
      }

      if (payload?.job) {
        setRemoteImportJob(payload.job);
        completedRemoteJobRef.current = null;
      }
      addNotification({
        message: `${source.name} import queued in the background.`,
        type: 'success',
      });
    } catch (error) {
      setActiveArchiveImportId(null);
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to start archive import',
        type: 'error',
      });
    }
  };

  const acceptedValidationResults = validationResults.filter((item) => item.accepted);
  const topValidationCandidate = [...acceptedValidationResults].sort((left, right) => right.trust_score - left.trust_score)[0] || validationResults[0] || null;
  const averageTrustScore = validationResults.length
    ? Math.round(validationResults.reduce((sum, item) => sum + item.trust_score, 0) / validationResults.length)
    : 0;

  const handleBulkPresetIngest = async () => {
    if (userRole !== 'admin') {
      addNotification({
        message: 'Only admin users can run preset bulk ingestion.',
        type: 'error',
      });
      return;
    }

    const token = getCookieValue('oceanet_auth_token');
    try {
      setIsBulkPresetIngesting(true);
      const response = await apiFetch('/datasets/ingest/presets', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        allowLocalFallback: false,
        timeoutMs: 240000,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Bulk ingest failed');
      }

      await fetchData();
      const inserted = Number(payload?.inserted_total || 0);
      const failed = Number(payload?.web_presets?.failed || 0);
      setLastBulkIngestResult({
        executed_at: String(payload?.executed_at || new Date().toISOString()),
        inserted_total: inserted,
        web_attempted: Number(payload?.web_presets?.attempted || 0),
        web_inserted: Number(payload?.web_presets?.inserted || 0),
        web_failed: failed,
        live_checked: Number(payload?.live_sources?.checked || 0),
        live_inserted: Number(payload?.live_sources?.inserted || 0),
        failures: Array.isArray(payload?.web_presets?.failures)
          ? payload.web_presets.failures.map((item: { name?: string; reason?: string }) => ({
              name: String(item?.name || 'unknown'),
              reason: String(item?.reason || 'unknown error'),
            }))
          : [],
      });
      addNotification({
        message: `Bulk ingest complete: ${inserted} datasets added${failed ? `, ${failed} web presets failed` : ''}.`,
        type: inserted > 0 ? 'success' : 'warning',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to run bulk ingest',
        type: 'error',
      });
    } finally {
      setIsBulkPresetIngesting(false);
    }
  };

  const handleResetReportsAndRefreshLiveData = async () => {
    if (userRole !== 'admin') {
      addNotification({
        message: 'Only admin users can reset reports and refresh live data.',
        type: 'error',
      });
      return;
    }

    const token = getCookieValue('oceanet_auth_token');
    try {
      setIsResettingLiveData(true);
      const response = await apiFetch('/admin/reset-live-data', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        allowLocalFallback: false,
        timeoutMs: 240000,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Unable to reset reports and refresh live data');
      }

      await fetchData();
      addNotification({
        message: `Reset complete: ${Number(payload?.deleted_reports || 0)} old reports removed, ${Array.isArray(payload?.generated_reports) ? payload.generated_reports.length : 0} fresh reports generated.`,
        type: 'success',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to reset reports and refresh live data',
        type: 'error',
      });
    } finally {
      setIsResettingLiveData(false);
    }
  };

  const handleDownload = async (dataset: DatasetRow) => {
    try {
      const response = await apiFetch(
        dataset.kind === 'report'
          ? `${API_BASE_URL}/reports/${dataset.recordId}/download`
          : `${API_BASE_URL}/datasets/${dataset.recordId}/download`
      );
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = dataset.kind === 'report' ? `${dataset.name}.txt` : dataset.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to download dataset report',
        type: 'error',
      });
    }
  };

  const handleShare = async (datasetId: number) => {
    try {
      const response = await apiFetch(`/reports/${datasetId}/share`, { method: 'POST', allowLocalFallback: false });
      if (!response.ok) throw new Error('Share link generation failed');
      const payload = await response.json();
      const shareUrl = payload.share_url as string;

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      }

      window.open(shareUrl, '_blank', 'noopener,noreferrer');
      addNotification({
        message: 'Share link opened in a new tab.',
        type: 'success',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to share dataset report',
        type: 'error',
      });
    }
  };

  const handleDeleteDataset = async (dataset: DatasetRow) => {
    if (dataset.kind !== 'dataset') return;
    if (userRole !== 'admin') {
      addNotification({
        message: 'Only admin users can delete datasets.',
        type: 'error',
      });
      return;
    }

    const token = getCookieValue('oceanet_auth_token');

    try {
      const response = await apiFetch(`/datasets/${dataset.recordId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        allowLocalFallback: false,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Delete dataset failed');
      }

      await fetchData();
      addNotification({
        message: 'Dataset removed successfully.',
        type: 'success',
      });
    } catch (error) {
      addNotification({
        message: error instanceof Error ? error.message : 'Unable to delete dataset',
        type: 'error',
      });
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const liveFeedsUp = liveFeeds.filter((feed) => feed.status === 'ok').length;
  const feedHealthPct = liveFeeds.length ? Math.round((liveFeedsUp / liveFeeds.length) * 100) : null;

  return (
    <main className="min-h-screen bg-ocean-gradient pb-20 overflow-x-hidden">
      <Navbar />
      <FloatingParticles count={15} />

      {/* Header */}
      <section className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan">Global Data Operations</p>
              <h1 className="text-4xl md:text-5xl font-bold text-text-primary mt-3 mb-2">
                Nerexis Unified Data Hub
              </h1>
              <p className="text-text-secondary max-w-3xl">
                Operational command surface for ingesting, validating, and governing marine, climate, and biodiversity datasets at production scale.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-200">Real-Time Ingestion</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-200">Governed Pipelines</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-200">Audit-Ready Outputs</span>
              </div>

              <div className="mt-4 rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Live Feed Health</p>
                  <p className="text-[11px] text-text-secondary">UP {liveFeedsUp}/{liveFeeds.length || 0}{feedHealthPct !== null ? ` (${feedHealthPct}%)` : ''}</p>
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
            </div>

            <div className="glass rounded-xl p-5 border border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Operational Snapshot</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs text-text-secondary uppercase tracking-widest">Regions Monitored</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">{formatOptionalCount(analytics?.totals.regions)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs text-text-secondary uppercase tracking-widest">Active Platform Users</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">{formatOptionalCount(analytics?.totals.users)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs text-text-secondary uppercase tracking-widest">Last Analytics Sync</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{analytics?.generated_at ? formatDateTime(analytics.generated_at) : 'N/A'}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Summary Stats */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {summaryStats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <StatCard {...stat} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Governance Notice</p>
            <p className="mt-2 text-sm text-text-secondary leading-6">
              Ingestion actions write directly to operational storage and influence downstream analytics/reporting. Run refresh and reset operations only during controlled admin workflows.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".csv,.json,.geojson,.xlsx,.xls,.txt,.md,.zip,.parquet,.nc,.nc4,.h5,.hdf5,.tar,.gz,.bz2,.xz,.7z"
            onChange={handleFilesSelected}
          />
          <div className="flex flex-col lg:flex-row gap-4 min-w-0">
            <div className="glass rounded-lg p-4 flex-1 space-y-3 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Full Dataset Ingestion Workspace</p>
              <p className="text-xs text-text-secondary">Upload complete archives and scientific files for permanent storage. Live refresh remains a separate feed-snapshot workflow.</p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 min-w-0">
                <select
                  value={uploadSource}
                  onChange={(e) => setUploadSource(e.target.value)}
                  className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-cyan focus:border-opacity-50"
                >
                  <option value="manual">Manual Upload</option>
                  <option value="kaggle">Kaggle</option>
                  <option value="noaa">NOAA</option>
                  <option value="nasa">NASA EONET</option>
                  <option value="open-meteo">Open-Meteo</option>
                </select>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="btn-primary inline-flex items-center justify-center space-x-2 w-full sm:w-auto max-w-full"
                  onClick={handleAddDataSourceClick}
                  disabled={isValidatingDataSource || isUploadingDataSource || userRole !== 'admin'}
                  title={userRole === 'admin' ? 'Upload datasets' : 'Only admin users can upload datasets'}
                >
                  <Upload size={20} />
                  <span className="whitespace-normal break-words text-center">
                    {isValidatingDataSource
                      ? 'Validating...'
                      : userRole === 'admin'
                        ? 'Validate Data Source'
                        : 'Validate Data Source (Admin)'}
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="btn-primary inline-flex items-center justify-center space-x-2 w-full sm:w-auto max-w-full"
                  onClick={handleCommitValidatedUpload}
                  disabled={isUploadingDataSource || validationResults.filter((item) => item.accepted).length === 0 || userRole !== 'admin'}
                  title={userRole === 'admin' ? 'Commit accepted files' : 'Only admin users can upload datasets'}
                >
                  <Upload size={20} />
                  <span className="whitespace-normal break-words text-center">
                    {isUploadingDataSource ? 'Uploading Accepted...' : 'Commit Accepted Files'}
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="btn-secondary inline-flex items-center justify-center space-x-2 w-full sm:w-auto max-w-full"
                  onClick={fetchData}
                >
                  <RefreshCw size={20} />
                  <span className="whitespace-normal break-words text-center">Run Controlled Feed Sync</span>
                </motion.button>
              </div>
              {validationResults.length > 0 && (
                <div className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg p-3 text-xs text-text-secondary space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-text-primary font-medium">Pre-Upload Validation Report</p>
                    <button
                      type="button"
                      onClick={clearValidationQueue}
                      className="text-xs text-text-secondary hover:text-text-primary"
                    >
                      Clear Queue
                    </button>
                  </div>
                  <p>
                    Accepted: <span className="text-secondary font-semibold">{validationResults.filter((item) => item.accepted).length}</span> · Rejected: <span className="text-neon-coral font-semibold">{validationResults.filter((item) => !item.accepted).length}</span>
                  </p>
                  {topValidationCandidate && (
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-text-primary font-medium">Trust score assessment</p>
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getTrustTone(topValidationCandidate.trust_score)}`}>
                          {topValidationCandidate.trust_score}/100 confidence
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary">
                        Batch average: <span className="text-text-primary font-medium">{averageTrustScore}/100</span> · Highest-confidence file: <span className="text-text-primary font-medium">{topValidationCandidate.name}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {topValidationCandidate.validation_notes.slice(0, 4).map((note) => (
                          <span key={note} className="rounded-full border border-cyan/20 bg-cyan/10 px-2 py-1 text-[10px] text-cyan">
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {validationResults.map((result) => (
                      <div key={result.key} className="rounded-md border border-white/10 bg-white/5 p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-text-primary text-xs font-medium break-all">{result.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${result.accepted ? 'bg-secondary/15 text-secondary border border-secondary/30' : 'bg-neon-coral/15 text-neon-coral border border-neon-coral/30'}`}>
                            {result.accepted ? 'Accepted' : 'Rejected'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-text-secondary">{result.dataset_type} · {formatBytes(result.size_bytes)} · Trust {result.trust_score}/100</p>
                        <p className={`mt-1 text-[11px] ${result.accepted ? 'text-text-secondary' : 'text-neon-coral'}`}>{result.reason}</p>
                        {result.validation_notes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {result.validation_notes.slice(0, 3).map((note) => (
                              <span key={`${result.key}-${note}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-text-secondary">
                                {note}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-text-secondary">Supported full-dataset formats: CSV, JSON, GeoJSON, XLSX, ZIP, Parquet, NetCDF, HDF5, TAR, GZip, BZip2, XZ, and 7z.</p>
                </div>
              )}
            </div>

            <div className="glass rounded-lg p-4 flex-1 space-y-3 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Archive Import + Live Feed Command Center</p>
              <p className="text-xs text-text-secondary">Use Kaggle/manual archive ingestion for whole datasets. Use live refresh only for operational feed updates.</p>
              {remoteImportJob && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-text-secondary space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-text-primary font-medium">Remote import job</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${remoteImportJob.status === 'completed' ? 'bg-secondary/15 text-secondary border border-secondary/30' : remoteImportJob.status === 'failed' ? 'bg-neon-coral/15 text-neon-coral border border-neon-coral/30' : 'bg-cyan/15 text-cyan border border-cyan/30'}`}>
                      {remoteImportJob.status}
                    </span>
                  </div>
                  <p>{remoteImportJob.dataset_name} · {remoteImportJob.dataset_type} · {remoteImportJob.source}</p>
                  <p>{remoteImportJob.message || remoteImportJob.phase}</p>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${Math.max(4, remoteImportJob.progress_percent || 0)}%` }} />
                  </div>
                  <p>
                    Progress: {remoteImportJob.progress_percent}%
                    {remoteImportJob.total_bytes > 0 ? ` · ${formatBytes(remoteImportJob.downloaded_bytes)} / ${formatBytes(remoteImportJob.total_bytes)}` : ''}
                  </p>
                  {remoteImportJob.error && <p className="text-neon-coral">{remoteImportJob.error}</p>}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={kaggleName}
                  onChange={(e) => setKaggleName(e.target.value)}
                  placeholder="Dataset name"
                  className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg px-4 py-2 text-text-primary placeholder-gray-500 focus:outline-none focus:border-cyan focus:border-opacity-50"
                />
                <input
                  type="text"
                  value={kaggleUrl}
                  onChange={(e) => setKaggleUrl(e.target.value)}
                  placeholder="https://.../archive.zip or file.parquet"
                  className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg px-4 py-2 text-text-primary placeholder-gray-500 focus:outline-none focus:border-cyan focus:border-opacity-50"
                />
                <select
                  value={kaggleType}
                  onChange={(e) => setKaggleType(e.target.value)}
                  className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-cyan focus:border-opacity-50"
                >
                  <option value="Oceanographic">Oceanographic</option>
                  <option value="Environmental">Environmental</option>
                  <option value="Biodiversity">Biodiversity</option>
                  <option value="Community">Community</option>
                </select>
              </div>
              <p className="text-xs text-text-secondary">
                Use a direct file or archive link. Kaggle dataset page URLs return HTML and will be rejected.
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 min-w-0">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="btn-primary inline-flex items-center justify-center space-x-2 w-full sm:w-auto max-w-full"
                  onClick={handleKaggleIngest}
                  disabled={isKaggleIngesting || userRole !== 'admin'}
                >
                  <Download size={18} />
                  <span className="whitespace-normal break-words text-center">{isKaggleIngesting ? 'Importing...' : 'Ingest Kaggle Dataset'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="btn-secondary inline-flex items-center justify-center space-x-2 w-full sm:w-auto max-w-full"
                  onClick={handleTriggerLiveRefresh}
                  disabled={isTriggeringRefresh || userRole !== 'admin'}
                >
                  <RefreshCw size={18} />
                  <span className="whitespace-normal break-words text-center">{isTriggeringRefresh ? 'Refreshing...' : 'Trigger Live Dataset Refresh'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="btn-secondary inline-flex items-center justify-center space-x-2 w-full sm:w-auto max-w-full"
                  onClick={handleBulkPresetIngest}
                  disabled={isBulkPresetIngesting || userRole !== 'admin'}
                >
                  <Database size={18} />
                  <span className="whitespace-normal break-words text-center">{isBulkPresetIngesting ? 'Seeding...' : 'Run Preset Bulk Ingestion'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="btn-secondary inline-flex items-center justify-center space-x-2 w-full sm:w-auto max-w-full"
                  onClick={handleResetReportsAndRefreshLiveData}
                  disabled={isResettingLiveData || userRole !== 'admin'}
                  title={userRole === 'admin' ? 'Delete all reports and regenerate from fresh live data' : 'Only admin users can perform this action'}
                >
                  <RefreshCw size={18} />
                  <span className="whitespace-normal break-words text-center">{isResettingLiveData ? 'Resetting...' : 'Execute Reset + Live Refresh'}</span>
                </motion.button>
              </div>
              <p className="text-xs text-text-secondary">
                Scheduler: {refreshStatus ? (refreshStatus.thread_alive ? 'Active' : 'Inactive') : 'Unknown'} · Every {refreshStatus ? `${Math.max(1, Math.round(refreshStatus.refresh_interval_seconds / 3600))}h` : 'N/A'} · Last run: {refreshStatus?.last_completed_at ? formatDate(refreshStatus.last_completed_at) : 'N/A'} · Total ingested: {refreshStatus ? refreshStatus.total_ingested : 'N/A'}
              </p>
              {lastBulkIngestResult && (
                <div className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg p-3 text-xs text-text-secondary space-y-1">
                  <p className="text-text-primary font-medium">Last bulk run</p>
                  <p>
                    Added: {lastBulkIngestResult.inserted_total} · Web: {lastBulkIngestResult.web_inserted}/{lastBulkIngestResult.web_attempted} · Live: {lastBulkIngestResult.live_inserted}/{lastBulkIngestResult.live_checked}
                  </p>
                  <p>
                    Failed: {lastBulkIngestResult.web_failed} · Executed: {formatDate(lastBulkIngestResult.executed_at)}
                  </p>
                  {lastBulkIngestResult.failures.slice(0, 3).map((failure, index) => (
                    <p key={`${failure.name}-${index}`} className="text-neon-coral">
                      {failure.name}: {failure.reason}
                    </p>
                  ))}
                </div>
              )}
              {archiveSources.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary">Full archive source registry</p>
                    <p className="text-[11px] text-text-secondary">Direct files queue imports here. Portal-only sources open the official provider archive.</p>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {archiveSources.map((source) => (
                      <div key={source.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-text-secondary space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-text-primary font-medium">{source.name}</p>
                            <p>{source.dataset_type} · {source.format} · {source.source.toUpperCase()}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${source.import_enabled ? 'bg-secondary/15 text-secondary border border-secondary/30' : 'bg-white/10 text-text-secondary border border-white/10'}`}>
                            {source.import_enabled ? 'Direct import' : 'Portal access'}
                          </span>
                        </div>
                        <p>{source.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            className="btn-secondary inline-flex items-center justify-center space-x-2"
                            onClick={() => handleArchiveSourceImport(source)}
                            disabled={(Boolean(activeArchiveImportId) && activeArchiveImportId !== source.id) || userRole !== 'admin'}
                          >
                            <Download size={16} />
                            <span>
                              {source.import_enabled
                                ? activeArchiveImportId === source.id
                                  ? 'Starting...'
                                  : 'Queue Archive Import'
                                : 'Open Official Portal'}
                            </span>
                          </motion.button>
                          <a
                            href={source.catalog_url || source.download_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-[11px] text-text-secondary hover:text-text-primary"
                          >
                            View source catalog
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Data Table */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-lg p-6 overflow-hidden"
          >
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-text-secondary" size={20} />
                <input
                  type="text"
                  placeholder="Search datasets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg pl-10 pr-4 py-2 text-text-primary placeholder-gray-500 focus:outline-none focus:border-cyan focus:border-opacity-50"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-cyan focus:border-opacity-50"
                >
                  <option value="all">All Types</option>
                  <option value="oceanographic">Oceanographic</option>
                  <option value="biodiversity">Biodiversity</option>
                  <option value="community">Community</option>
                  <option value="resource">Resource</option>
                  <option value="environmental">Environmental</option>
                </select>
                <button className="btn-secondary px-4 py-2 inline-flex items-center space-x-2">
                  <Filter size={18} />
                </button>
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white border-opacity-10">
                      <th className="text-left py-4 px-4 font-semibold text-text-secondary text-sm">Dataset Name</th>
                      <th className="text-left py-4 px-4 font-semibold text-text-secondary text-sm">Type</th>
                      <th className="text-left py-4 px-4 font-semibold text-text-secondary text-sm">Source</th>
                      <th className="text-left py-4 px-4 font-semibold text-text-secondary text-sm">Size</th>
                      <th className="text-left py-4 px-4 font-semibold text-text-secondary text-sm">Status</th>
                      <th className="text-left py-4 px-4 font-semibold text-text-secondary text-sm">Created</th>
                      <th className="text-left py-4 px-4 font-semibold text-text-secondary text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDatasets.map((dataset, i) => (
                      <motion.tr
                        key={dataset.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.05 }}
                        className="border-b border-white border-opacity-5 hover:bg-white hover:bg-opacity-5"
                      >
                        <td className="py-4 px-4 font-medium text-text-primary">{dataset.name}</td>
                        <td className="py-4 px-4 text-text-secondary">{dataset.type}</td>
                        <td className="py-4 px-4 text-text-secondary">{dataset.source}</td>
                        <td className="py-4 px-4 text-text-secondary">{dataset.size}</td>
                        <td className="py-4 px-4">
                          <Badge variant={getStatusBadge(dataset.status)}>{dataset.status}</Badge>
                        </td>
                        <td className="py-4 px-4 text-text-secondary text-sm">{formatDate(dataset.created)}</td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button
                              className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handlePreview(dataset.recordId)}
                              disabled={!dataset.isPreviewable}
                              title={dataset.isPreviewable ? 'Preview report' : 'Preview available after report generation'}
                            >
                              <Eye size={18} className="text-cyan" />
                            </button>
                            <button
                              className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handleDownload(dataset)}
                              disabled={!dataset.isDownloadable}
                              title={dataset.isDownloadable ? 'Download file' : 'Download unavailable'}
                            >
                              <Download size={18} className="text-teal" />
                            </button>
                            <button
                              className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handleShare(dataset.recordId)}
                              disabled={!dataset.isShareable}
                              title={dataset.isShareable ? 'Share report' : 'Share available for generated reports only'}
                            >
                              <Share2 size={18} className="text-emerald" />
                            </button>
                            <button
                              className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handleDeleteDataset(dataset)}
                              disabled={dataset.kind !== 'dataset' || userRole !== 'admin'}
                              title={
                                dataset.kind !== 'dataset'
                                  ? 'Delete available for uploaded datasets only'
                                  : userRole === 'admin'
                                    ? 'Delete dataset'
                                    : 'Only admin users can delete datasets'
                              }
                            >
                              <Trash2 size={18} className="text-neon-coral" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {paginatedDatasets.length === 0 && (
                  <p className="text-sm text-text-secondary py-6 text-center">No datasets match the current filters.</p>
                )}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white border-opacity-10">
              <p className="text-sm text-text-secondary">
                Showing {filteredDatasets.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, filteredDatasets.length)} of {filteredDatasets.length} datasets
              </p>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg text-text-primary hover:bg-opacity-10 disabled:opacity-50"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button
                  className="px-4 py-2 bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg text-text-primary hover:bg-opacity-10 disabled:opacity-50"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
