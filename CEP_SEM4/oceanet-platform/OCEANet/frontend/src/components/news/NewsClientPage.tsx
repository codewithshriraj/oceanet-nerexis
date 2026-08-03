'use client';

import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import NewsHero from './NewsHero';
import NewsControls from './NewsControls';
import NewsCard from './NewsCard';
import type { NewsPayload } from './types';
import { apiFetch } from '@/utils/api';
const BOOKMARK_KEY = 'nerexis_news_bookmarks';
const PAGE_SIZE = 8;

type Props = {
  initialPayload: NewsPayload;
};

const formatUtc = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};

const trendingScore = (article: NewsPayload['articles'][number]) => {
  const temp = article.liveData.temperature ?? 0;
  const wave = article.liveData.waveHeight ?? 0;
  const salinity = article.liveData.salinity ?? 0;
  return temp * 1.2 + wave * 8 + salinity * 0.08;
};

export default function NewsClientPage({ initialPayload }: Props) {
  const [payload, setPayload] = useState<NewsPayload>(initialPayload);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [region, setRegion] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [page, setPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<number[]>([]);

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const stored = localStorage.getItem(BOOKMARK_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setBookmarks(parsed.filter((item) => typeof item === 'number'));
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    let cancelled = false;

    const refreshNews = async () => {
      try {
        const response = await apiFetch('/news/articles', {
          cache: 'no-store',
          timeoutMs: 7000,
          retryOnTimeout: false,
        });
        if (!response.ok) return;
        const nextPayload: NewsPayload = await response.json();
        if (!cancelled) setPayload(nextPayload);
      } catch {
      }
    };

    const intervalMs = Math.max(payload.refreshIntervalSeconds || 300, 300) * 1000;
    const timer = window.setInterval(refreshNews, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [payload.refreshIntervalSeconds]);

  const categories = useMemo(() => [...new Set(payload.articles.map((item) => item.category))].sort(), [payload.articles]);
  const regions = useMemo(() => [...new Set(payload.articles.map((item) => item.location))].sort(), [payload.articles]);

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const list = payload.articles.filter((article) => {
      const searchable = `${article.title} ${article.content} ${article.location}`.toLowerCase();
      const okSearch = searchLower ? searchable.includes(searchLower) : true;
      const okCategory = category === 'All' ? true : article.category === category;
      const okRegion = region === 'All' ? true : article.location === region;
      return okSearch && okCategory && okRegion;
    });

    if (sortBy === 'latest') {
      return list.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
    }
    if (sortBy === 'trending') {
      return list.sort((a, b) => trendingScore(b) - trendingScore(a));
    }
    return list.sort((a, b) => a.location.localeCompare(b.location));
  }, [payload.articles, search, category, region, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, category, region, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const leadStory = visible[0] ?? null;
  const topSecondary = visible[1] ?? null;
  const remainingStories = visible.slice(2);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const topTopics = categories.slice(0, 8);
  const refreshHours = payload.refreshIntervalSeconds ? Math.max(1, Math.round(payload.refreshIntervalSeconds / 3600)) : null;

  const toggleBookmark = (id: number) => {
    setBookmarks((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  const sourceLinks = payload.externalSources
    .map((source) => source.source_url)
    .filter((url, index, all) => !!url && all.indexOf(url) === index)
    .slice(0, 5);

  const sourceStatusItems = payload.externalSources.slice(0, 8);
  const sourceUpCount = sourceStatusItems.filter((item) => item.status === 'ok').length;
  const sourceUptimePct = sourceStatusItems.length > 0 ? Math.round((sourceUpCount / sourceStatusItems.length) * 100) : null;

  return (
    <main className="min-h-screen bg-gradient-dark pb-20 relative">
      <Navbar />

      <div className="pt-24 md:pl-72 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <section className="glass rounded-xl p-5 border border-primary/10">
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-text-secondary">Global Editorial Operations</p>
                <h1 className="mt-2 text-3xl md:text-4xl font-bold text-text-primary">Nerexis Environmental Newsroom</h1>
                <p className="mt-3 text-sm md:text-base text-text-secondary max-w-3xl">
                  Executive environmental intelligence coverage combining live marine datasets, verified source references, and region-aware editorial context.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-200">Editorial Intelligence</span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-200">Verified Sources</span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-200">Live Marine Context</span>
                </div>
              </div>

              <div className="rounded-xl border border-primary/10 bg-white/5 p-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Stories Available</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">{payload.articles.length.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Source Uptime</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">{sourceUptimePct !== null ? `${sourceUptimePct}%` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Last Updated</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{payload.lastUpdated ? formatUtc(payload.lastUpdated) : 'N/A'}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
            <div className="xl:col-span-2">
              <NewsHero hero={payload.hero} />
            </div>

            <aside className="glass rounded-xl p-5 border border-primary/10 h-full flex flex-col">
              <p className="text-xs uppercase tracking-widest text-text-secondary">Editorial Desk</p>
              <h2 className="mt-2 text-xl font-bold text-text-primary">Executive Ocean Brief</h2>
              <p className="mt-2 text-sm text-text-secondary">Last updated: {payload.lastUpdated ? formatUtc(payload.lastUpdated) : 'N/A'}</p>
              <div className="mt-3 inline-flex items-center rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">
                Auto-refresh every {refreshHours !== null ? `${refreshHours} hour${refreshHours === 1 ? '' : 's'}` : 'N/A'}
              </div>

              <div className="mt-4 border-t border-primary/10 pt-4">
                <p className="text-sm font-semibold text-text-primary">Data Source Note</p>
                <p className="mt-2 text-xs text-text-secondary leading-5">{payload.disclaimer}</p>
              </div>

              <div className="mt-4 border-t border-primary/10 pt-4">
                <p className="text-sm font-semibold text-text-primary">Verified Sources</p>
                <div className="mt-2 space-y-2">
                  {sourceLinks.length === 0 ? (
                    <p className="text-xs text-text-secondary">No source links available in this refresh.</p>
                  ) : (
                    sourceLinks.map((link) => (
                      <a key={link} href={link} target="_blank" rel="noreferrer" className="block text-xs text-secondary hover:underline break-all">
                        {link}
                      </a>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-primary/10 text-xs text-text-secondary">
                Bookmarked stories: <span className="font-semibold text-text-primary">{bookmarks.length}</span>
              </div>
            </aside>
          </section>

          <NewsControls
            search={search}
            setSearch={setSearch}
            category={category}
            setCategory={setCategory}
            sortBy={sortBy}
            setSortBy={setSortBy}
            region={region}
            setRegion={setRegion}
            categories={categories}
            regions={regions}
          />

          <section className="glass rounded-xl p-4 border border-primary/10">
            <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Editorial Tracks</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategory('All')}
                className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all duration-200 ${
                  category === 'All'
                    ? 'bg-gradient-to-r from-primary to-secondary text-white border-primary shadow-glow'
                    : 'bg-white text-text-secondary border-primary/20 hover:border-primary/40'
                }`}
              >
                All Topics
              </button>
              {topTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setCategory(topic)}
                  className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all duration-200 ${
                    category === topic
                      ? 'bg-gradient-to-r from-primary to-secondary text-white border-primary shadow-glow'
                      : 'bg-white text-text-secondary border-primary/20 hover:border-primary/40'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </section>

          <section className="glass rounded-xl p-4 border border-primary/10">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs uppercase tracking-widest text-text-secondary">Live Sources</p>
              <p className="text-[11px] text-text-secondary">Refresh cycle: every {refreshHours !== null ? `${refreshHours}h` : 'N/A'}</p>
            </div>

            <div className="space-y-2">
              {sourceStatusItems.length === 0 ? (
                <p className="text-xs text-text-secondary">No source status is available in this refresh window.</p>
              ) : (
                sourceStatusItems.map((source) => {
                  const isUp = source.status === 'ok';
                  const checkedAt = source.checked_at ? formatUtc(source.checked_at) : formatUtc(payload.lastUpdated);
                  const lastSuccess = source.last_success_at ? formatUtc(source.last_success_at) : 'Unavailable';
                  return (
                    <div key={`${source.name}-${source.api_url}`} className="rounded-lg border border-primary/10 bg-white/70 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a href={source.source_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-text-primary hover:underline">
                          {source.name}
                        </a>
                        <span className={`text-[11px] font-semibold rounded-full px-2 py-1 border ${isUp ? 'border-primary/20 text-secondary bg-secondary/10' : 'border-primary/20 text-text-secondary bg-white'}`}>
                          Uptime: {isUp ? 'UP' : 'DOWN'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-text-secondary">Checked: {checkedAt}</p>
                      <p className="text-[11px] text-text-secondary">Last successful fetch: {lastSuccess}</p>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-stretch">
            <div className="xl:col-span-2">
              {leadStory ? (
                <NewsCard
                  key={leadStory.id}
                  article={leadStory}
                  bookmarked={bookmarks.includes(leadStory.id)}
                  onToggleBookmark={toggleBookmark}
                  variant="lead"
                />
              ) : (
                <div className="glass rounded-xl border border-primary/10 p-6 text-sm text-text-secondary">No stories found for this filter.</div>
              )}
            </div>

            <div className="xl:col-span-1">
              {topSecondary ? (
                <NewsCard
                  key={topSecondary.id}
                  article={topSecondary}
                  bookmarked={bookmarks.includes(topSecondary.id)}
                  onToggleBookmark={toggleBookmark}
                  variant="compact"
                />
              ) : (
                <div className="glass rounded-xl border border-primary/10 p-6 text-sm text-text-secondary h-full">No secondary story available.</div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
            {remainingStories.map((article) => (
              <NewsCard
                key={article.id}
                article={article}
                bookmarked={bookmarks.includes(article.id)}
                onToggleBookmark={toggleBookmark}
              />
            ))}
          </section>

          <section className="glass rounded-xl p-4 border border-primary/10 space-y-3">
            <p className="text-sm text-text-secondary">Showing page {page} of {totalPages} • {filtered.length} stories total.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => changePage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="btn btn-secondary px-3 py-2 text-xs disabled:opacity-50"
              >
                Previous
              </button>

              {pageNumbers.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => changePage(entry)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                    entry === page
                      ? 'bg-gradient-to-r from-primary to-secondary text-white border-primary shadow-glow'
                      : 'bg-white text-text-secondary border-primary/20 hover:border-primary/40'
                  }`}
                >
                  {entry}
                </button>
              ))}

              <button
                type="button"
                onClick={() => changePage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="btn btn-secondary px-3 py-2 text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
