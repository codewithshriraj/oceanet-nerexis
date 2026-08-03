'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileText, Gauge, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/utils/api';

type DatieEntity = {
  entity_type: 'dataset' | 'report';
  entity_id: number;
  title: string;
  region: string;
  source: string;
  score_band: string;
  source_trust_score: number;
  content_quality_score: number;
  duplicate_probability_score: number;
  freshness_score: number;
  metadata_reliability_score: number;
  explainability_score: number;
  final_authenticity_score: number;
  explanations: string[];
  feature_importance: Record<string, Array<{ feature: string; weight: number; value: unknown; delta: number }>>;
  formulas: Record<string, string>;
  research?: {
    methodology?: { description?: string };
  };
};

type DatieSummary = {
  total_datasets: number;
  average_authenticity_score: number;
  band_counts: { high: number; moderate: number; low: number };
  latest_dataset?: DatieEntity | null;
  model_registry?: Array<{ model_id: string; name: string; version: string; status: string; evaluation?: Record<string, unknown> }>;
  research?: { methodology?: { description?: string } };
};

type DatiePanelProps = {
  datasetId?: number;
  reportId?: number;
  compact?: boolean;
};

const SCORE_FIELDS: Array<{ key: keyof Pick<DatieEntity,
  'source_trust_score' | 'content_quality_score' | 'duplicate_probability_score' | 'freshness_score' | 'metadata_reliability_score' | 'explainability_score'>;
  label: string;
}> = [
  { key: 'source_trust_score', label: 'Source Trust' },
  { key: 'content_quality_score', label: 'Content Quality' },
  { key: 'duplicate_probability_score', label: 'Duplicate Risk' },
  { key: 'freshness_score', label: 'Freshness' },
  { key: 'metadata_reliability_score', label: 'Metadata Reliability' },
  { key: 'explainability_score', label: 'Explainability' },
];

const scoreTint = (score: number) => {
  if (score >= 80) return 'from-emerald-400 to-cyan-400';
  if (score >= 60) return 'from-amber-400 to-orange-400';
  return 'from-rose-400 to-red-500';
};

const toneClass = (score: number) => {
  if (score >= 80) return 'text-emerald-300';
  if (score >= 60) return 'text-amber-300';
  return 'text-rose-300';
};

export default function DatieTrustPanel({ datasetId, reportId, compact = false }: DatiePanelProps) {
  const [summary, setSummary] = useState<DatieSummary | null>(null);
  const [entity, setEntity] = useState<DatieEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let summaryPayload: DatieSummary | null = null;
        const [summaryResponse, entityResponse, registryResponse] = await Promise.allSettled([
          apiFetch('/datie/summary', { cache: 'no-store', timeoutMs: 9000, retryOnTimeout: false }),
          datasetId
            ? apiFetch(`/datie/datasets/${datasetId}`, { cache: 'no-store', timeoutMs: 9000, retryOnTimeout: false })
            : reportId
              ? apiFetch(`/datie/reports/${reportId}`, { cache: 'no-store', timeoutMs: 9000, retryOnTimeout: false })
              : Promise.resolve(null),
          apiFetch('/datie/model-registry', { cache: 'no-store', timeoutMs: 9000, retryOnTimeout: false }),
        ]);

        if (summaryResponse.status === 'fulfilled' && summaryResponse.value && summaryResponse.value.ok) {
          summaryPayload = await summaryResponse.value.json();
          setSummary(summaryPayload);
        }

        if (entityResponse.status === 'fulfilled' && entityResponse.value && entityResponse.value.ok) {
          setEntity(await entityResponse.value.json());
        }

        if (registryResponse.status === 'fulfilled' && registryResponse.value && registryResponse.value.ok) {
          const payload = await registryResponse.value.json();
          setSummary((prev) => ({ ...(prev || {}), model_registry: payload.models || [] } as DatieSummary));
        }

        if (!datasetId && !reportId && summaryPayload?.latest_dataset) {
          setEntity(summaryPayload.latest_dataset);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load DATIE panel');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [datasetId, reportId]);

  const activeEntity = entity || summary?.latest_dataset || null;
  const exportBase = activeEntity?.entity_type && activeEntity?.entity_id
    ? `/datie/export/${activeEntity.entity_type}/${activeEntity.entity_id}`
    : null;

  const shortMethodology = useMemo(() => {
    return summary?.research?.methodology?.description || activeEntity?.research?.methodology?.description || 'DATIE combines provenance, quality, duplication, freshness, metadata reliability, and explainability into a transparent authenticity score.';
  }, [activeEntity?.research?.methodology?.description, summary?.research?.methodology?.description]);

  const downloadExport = (format: 'json' | 'md') => {
    if (!exportBase || typeof window === 'undefined') return;
    window.open(`${exportBase}?format=${format}`, '_blank', 'noopener,noreferrer');
  };

  const registry = summary?.model_registry || [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`rounded-2xl border border-white/10 bg-white/10 p-5 shadow-glow ${compact ? '' : 'mt-5'}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-cyan">
            <ShieldCheck size={16} />
            <p className="text-xs font-semibold uppercase tracking-[0.22em]">DATIE</p>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-text-primary">Dataset Authenticity & Trust Intelligence Engine</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{shortMethodology}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {exportBase ? (
            <>
              <button onClick={() => downloadExport('json')} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
                <Download size={16} />
                <span>Export JSON</span>
              </button>
              <button onClick={() => downloadExport('md')} className="btn-secondary inline-flex items-center gap-2 px-4 py-2">
                <FileText size={16} />
                <span>Export Markdown</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-text-secondary">Loading DATIE trust model...</div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">{error}</div>
      ) : activeEntity ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-gray-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Active Record</p>
                  <h3 className="mt-1 text-xl font-semibold text-text-primary">{activeEntity.title}</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {activeEntity.entity_type} #{activeEntity.entity_id} · {activeEntity.region} · {activeEntity.source}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                  <p className={`text-xs uppercase tracking-[0.18em] ${toneClass(activeEntity.final_authenticity_score)}`}>Final Authenticity</p>
                  <p className={`mt-1 text-3xl font-bold ${toneClass(activeEntity.final_authenticity_score)}`}>{activeEntity.final_authenticity_score}%</p>
                  <p className="mt-1 text-xs text-text-secondary">{activeEntity.score_band}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {SCORE_FIELDS.map((field) => {
                const score = activeEntity[field.key] || 0;
                return (
                  <div key={field.key} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-text-primary">{field.label}</p>
                      <p className={`text-sm font-bold ${toneClass(score)}`}>{score}%</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full bg-gradient-to-r ${scoreTint(score)}`} style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-text-secondary">{activeEntity.formulas?.[field.key.replace('_score', '')] || activeEntity.formulas?.final_authenticity}</p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Explainability Trace</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                {activeEntity.explanations.slice(0, 6).map((line) => (
                  <li key={line} className="rounded-lg border border-white/10 bg-gray-950/30 px-3 py-2">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-cyan">
                <Gauge size={16} />
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">Research Metrics</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-white/10 bg-gray-950/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Source</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{activeEntity.source_trust_score}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-gray-950/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Quality</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{activeEntity.content_quality_score}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-gray-950/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Duplicate Risk</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{activeEntity.duplicate_probability_score}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-gray-950/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Freshness</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{activeEntity.freshness_score}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-gray-950/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Metadata</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{activeEntity.metadata_reliability_score}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-gray-950/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Explainability</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{activeEntity.explainability_score}%</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Model Versioning</p>
              <div className="mt-3 space-y-3">
                {registry.slice(0, 3).map((model) => (
                  <div key={model.model_id} className="rounded-lg border border-white/10 bg-gray-950/30 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-text-primary">{model.name}</p>
                      <span className="text-xs text-cyan">{model.version}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">{model.status}</p>
                    <p className="mt-2 text-xs leading-5 text-text-secondary">
                      {String(model.evaluation?.confidence_score || 'Versioned trust output with confidence score.')} 
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Ablation-Friendly Design</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                DATIE is intentionally modular so source, quality, duplication, freshness, metadata, and explainability can be evaluated independently in future ablation studies.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-text-secondary">
          No dataset or report is available yet, but the DATIE service is active.
        </div>
      )}
    </motion.section>
  );
}
