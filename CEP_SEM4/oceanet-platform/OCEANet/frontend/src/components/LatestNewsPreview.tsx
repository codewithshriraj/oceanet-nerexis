'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GlassCard, Badge } from '@/components/Cards';
import { apiFetch } from '@/utils/api';

type NewsPreviewPayload = {
  generated_at: string;
  headline: string;
  articles: Array<{
    id: number;
    title: string;
    summary: string;
    published_at: string;
    risk: number;
  }>;
};

const toRelativeTime = (iso: string) => {
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
};

const riskVariant = (risk: number) => {
  if (risk >= 70) return 'error';
  if (risk >= 40) return 'warning';
  return 'success';
};

export default function LatestNewsPreview({ title = 'Latest News' }: { title?: string }) {
  const [payload, setPayload] = useState<NewsPreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchNews = async () => {
      try {
        const response = await apiFetch('/news/summary', {
          cache: 'no-store',
          timeoutMs: 7000,
          retryOnTimeout: false,
        });
        if (!response.ok) throw new Error(`News feed unavailable (${response.status})`);
        const data: NewsPreviewPayload = await response.json();
        if (!cancelled) {
          setPayload(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'News feed unavailable');
        }
      }
    };

    fetchNews();
    const interval = window.setInterval(fetchNews, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-text-primary">{title}</h3>
          <p className="text-sm text-text-secondary">
            {payload?.generated_at ? `Updated ${new Date(payload.generated_at).toLocaleTimeString()}` : 'Waiting for newsroom sync...'}
          </p>
        </div>
        <Link href="/news" className="btn-secondary px-4 py-2 text-sm">
          Open Newsroom
        </Link>
      </div>

      {error && <p className="text-sm text-neon-coral">{error}</p>}

      {!error && payload && (
        <>
          <p className="text-text-primary font-semibold">{payload.headline}</p>
          <div className="space-y-3">
            {payload.articles.slice(0, 3).map((article, idx) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-3"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-text-primary line-clamp-1">{article.title}</p>
                  <Badge variant={riskVariant(article.risk)}>{article.risk}%</Badge>
                </div>
                <p className="text-xs text-text-secondary line-clamp-2">{article.summary}</p>
                <p className="text-xs text-text-secondary mt-2">{toRelativeTime(article.published_at)}</p>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
}
