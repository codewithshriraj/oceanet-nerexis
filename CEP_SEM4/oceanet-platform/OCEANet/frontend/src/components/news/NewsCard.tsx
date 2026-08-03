import { useMemo, useState } from 'react';
import type { NewsArticle } from './types';

type Props = {
  article: NewsArticle;
  bookmarked: boolean;
  onToggleBookmark: (id: number) => void;
  variant?: 'default' | 'lead' | 'compact';
};

const formatUtc = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};

const normalizeExcerpt = (content: string) => {
  const words = content.split(/\s+/).filter(Boolean);
  if (words.length <= 150) return content;
  return `${words.slice(0, 150).join(' ')}...`;
};

const readableSource = (value: 'live' | 'estimated' | 'unavailable') => {
  if (value === 'live') return 'Live';
  if (value === 'estimated') return 'Estimated';
  return 'Unavailable';
};

const formatMetric = (value: number | null, digits: number) => {
  if (typeof value !== 'number') return 'N/A';
  return value.toFixed(digits);
};

const formatCoordinate = (value: number | null) => {
  if (typeof value !== 'number') return 'N/A';
  return value.toFixed(4);
};

const sourceBadgeLabel = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes('open-meteo')) return 'Open-Meteo';
  if (normalized.includes('noaa')) return 'NOAA';
  if (normalized.includes('nasa')) return 'NASA EONET';
  if (normalized.includes('gbif')) return 'GBIF';
  if (normalized.includes('inaturalist')) return 'iNaturalist';
  if (normalized.includes('obis')) return 'OBIS';

  try {
    const host = new URL(value).hostname.replace(/^www\./, '');
    return host || 'Live Feed';
  } catch {
    return value || 'Live Feed';
  }
};

const dataAgeMeta = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      age: 'N/A',
      label: 'Unknown',
      className: 'bg-text-secondary/10 text-text-secondary border border-text-secondary/20',
    };
  }

  const minutes = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60000));
  if (minutes < 30) {
    return {
      age: `${minutes}`,
      label: 'Fresh',
      className: 'bg-green-100 text-green-700 border border-green-200',
    };
  }
  if (minutes <= 180) {
    return {
      age: `${minutes}`,
      label: 'Moderate',
      className: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    };
  }
  return {
    age: `${minutes}`,
    label: 'Stale',
    className: 'bg-red-100 text-red-700 border border-red-200',
  };
};

export default function NewsCard({ article, bookmarked, onToggleBookmark, variant = 'default' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const description = useMemo(() => normalizeExcerpt(article.content), [article.content]);
  const verifiedSources = useMemo(
    () => Array.from(new Set((article.verifiedSources || []).filter((source) => source && source.trim()))),
    [article.verifiedSources]
  );
  const gallery = article.images.slice(0, 4);
  const primaryImage = gallery[0] || null;
  const isLead = variant === 'lead';
  const isCompact = variant === 'compact';
  const ageMeta = dataAgeMeta(article.liveData.observedAt);
  const sourceBadge = sourceBadgeLabel(article.externalSource);
  const hasAnyLiveMetric =
    article.liveData.temperature !== null ||
    article.liveData.waveHeight !== null ||
    article.liveData.salinity !== null ||
    article.liveData.tideHeight !== null;

  return (
    <article className="glass rounded-xl border border-primary/10 overflow-hidden h-full flex flex-col">
      {primaryImage ? (
        <a href={primaryImage} target="_blank" rel="noreferrer" className="block">
          <img
            src={primaryImage}
            alt={article.title}
            className={`${isLead ? 'h-72 md:h-80' : isCompact ? 'h-44' : 'h-52'} w-full object-cover cursor-zoom-in`}
            loading="lazy"
            decoding="async"
          />
        </a>
      ) : (
        <div className={`${isLead ? 'h-72 md:h-80' : isCompact ? 'h-44' : 'h-52'} w-full bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.26),transparent_45%),linear-gradient(135deg,rgba(8,47,73,0.92),rgba(3,7,18,0.98))] flex items-end p-4`}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/80">Editorial image unavailable</p>
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          <span className="badge badge-info">{article.category}</span>
          <span className="rounded-full border border-secondary/25 bg-secondary/10 px-2 py-1 text-secondary font-semibold">{sourceBadge}</span>
          <span className="rounded-full border border-primary/20 px-2 py-1 text-text-secondary">{article.location}</span>
          <span className="rounded-full border border-primary/20 px-2 py-1 text-text-secondary">{formatUtc(article.publishDate)}</span>
        </div>

        <h3 className={`${isLead ? 'text-2xl md:text-3xl' : isCompact ? 'text-base' : 'text-lg'} font-bold text-text-primary leading-snug`}>
          {article.title}
        </h3>
        <p className="mt-2 text-sm text-text-secondary">By {article.author}</p>
        <p className="mt-3 text-sm text-text-secondary leading-6">
          {isLead ? description : isCompact ? `${description.split(' ').slice(0, 110).join(' ')}...` : description}
        </p>

        {!isCompact && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {gallery.slice(1, 4).filter(Boolean).map((image, index) => (
              <a key={`${article.id}-${index}`} href={image} target="_blank" rel="noreferrer" className="block">
                <img
                  src={image}
                  alt={`${article.title} supporting ${index + 1}`}
                  className="h-20 w-full rounded-lg object-cover cursor-zoom-in"
                  loading="lazy"
                  decoding="async"
                />
              </a>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-primary/15 bg-white/70 p-3 text-xs text-text-secondary">
          <p className="font-semibold text-text-primary mb-2">Live Marine Stats</p>
          <div className="grid grid-cols-2 gap-2">
            <p>Temperature: {formatMetric(article.liveData.temperature, 2)} {typeof article.liveData.temperature === 'number' ? '°C' : ''}</p>
            <p>Wave Height: {formatMetric(article.liveData.waveHeight, 2)} {typeof article.liveData.waveHeight === 'number' ? 'm' : ''}</p>
            {!isCompact && <p>Salinity: {formatMetric(article.liveData.salinity, 2)} {typeof article.liveData.salinity === 'number' ? 'PSU' : ''}</p>}
            {!isCompact && <p>Tide: {formatMetric(article.liveData.tideHeight, 2)} {typeof article.liveData.tideHeight === 'number' ? 'm' : ''}</p>}
            <p className="col-span-2">Coordinates: {formatCoordinate(article.liveData.coordinates.lat)}, {formatCoordinate(article.liveData.coordinates.lng)}</p>
          </div>
          {!isCompact && (
            <p className="mt-2 text-[11px] text-text-secondary">
              Source: Coordinates {readableSource(article.liveData.source?.coordinates ?? 'unavailable')} • Salinity {readableSource(article.liveData.source?.salinity ?? 'unavailable')} • Tide {readableSource(article.liveData.source?.tideHeight ?? 'unavailable')}
            </p>
          )}
          {!hasAnyLiveMetric && <p className="mt-2 text-[11px] text-text-secondary">No live metric values were available during this refresh cycle.</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
            <span>Last fetched: {formatUtc(article.liveData.observedAt)}</span>
            <span className={`px-2 py-1 rounded-full font-semibold ${ageMeta.className}`}>
              Data age: {ageMeta.age} min ({ageMeta.label})
            </span>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 rounded-lg border border-primary/15 bg-white p-3 text-sm text-text-secondary leading-6">
            <p>{article.content}</p>
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold text-text-primary">Verified Sources</p>
              {verifiedSources.map((source, index) => (
                <a key={`${source}-${index}`} href={source} target="_blank" rel="noreferrer" className="block text-xs text-secondary hover:underline break-all">
                  {source}
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs">Last updated: {formatUtc(article.lastUpdated)}</p>
          </div>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setExpanded((prev) => !prev)} className="btn btn-primary text-sm px-4 py-2">
            {expanded ? 'Hide' : 'Read More'}
          </button>
          <button type="button" onClick={() => onToggleBookmark(article.id)} className="btn btn-secondary text-sm px-4 py-2">
            {bookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
        </div>
      </div>
    </article>
  );
}
