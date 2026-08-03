import type { Metadata } from 'next';
import NewsClientPage from '@/components/news/NewsClientPage';
import type { NewsPayload } from '@/components/news/types';
import { apiFetch } from '@/utils/api';

export const metadata: Metadata = {
  title: 'Nerexis News | Environmental Intelligence Editorial Desk',
  description:
    'Professional environmental newsroom combining live climate and biodiversity data, region-focused reporting, and verified scientific sources.',
  openGraph: {
    title: 'Nerexis News | Environmental Intelligence Editorial Desk',
    description:
      'Live environmental intelligence stories with verified sources, editorial clarity, and real-time ecosystem conditions.',
    type: 'website',
  },
};

const fallbackPayload: NewsPayload = {
  generatedAt: '',
  lastUpdated: '',
  refreshIntervalSeconds: 300,
  hero: {
    title: 'Environmental Intelligence News Feed Unavailable',
    summary: 'Live editorial stories will populate automatically when the newsroom backend feed is available.',
    category: 'System',
    publishDate: '',
    lastUpdated: '',
    image: '',
    location: 'Global',
    author: 'Nerexis Editorial Desk',
  },
  articles: [],
  disclaimer:
    'Data combines Nerexis sources and third-party climate and biodiversity agencies. Validate critical values directly with source systems.',
  externalSources: [],
};

async function getNewsPayload(): Promise<NewsPayload> {
  try {
    const response = await apiFetch('/news/articles', {
      cache: 'no-store',
      allowLocalFallback: false,
      timeoutMs: 9000,
      retryOnTimeout: false,
    });
    if (!response.ok) return fallbackPayload;
    return (await response.json()) as NewsPayload;
  } catch {
    return fallbackPayload;
  }
}

export default async function NewsPage() {
  const payload = await getNewsPayload();
  return <NewsClientPage initialPayload={payload} />;
}
