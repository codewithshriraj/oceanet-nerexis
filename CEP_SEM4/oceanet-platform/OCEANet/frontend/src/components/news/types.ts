export type NewsLiveData = {
  temperature: number | null;
  waveHeight: number | null;
  salinity: number | null;
  coordinates: {
    lat: number | null;
    lng: number | null;
  };
  tideHeight: number | null;
  observedAt: string;
  source: {
    coordinates: 'live' | 'estimated' | 'unavailable';
    salinity: 'live' | 'estimated' | 'unavailable';
    tideHeight: 'live' | 'estimated' | 'unavailable';
  };
};

export type NewsArticle = {
  id: number;
  title: string;
  content: string;
  category: string;
  location: string;
  images: string[];
  author: string;
  publishDate: string;
  lastUpdated: string;
  externalSource: string;
  verifiedSources: string[];
  liveData: NewsLiveData;
};

export type NewsHero = {
  title: string;
  summary: string;
  category: string;
  publishDate: string;
  lastUpdated: string;
  image: string;
  location: string;
  author: string;
};

export type NewsPayload = {
  generatedAt: string;
  lastUpdated: string;
  refreshIntervalSeconds: number;
  hero: NewsHero;
  articles: NewsArticle[];
  disclaimer: string;
  externalSources: Array<{
    name: string;
    status: string;
    checked_at?: string | null;
    last_success_at?: string | null;
    source_url: string;
    api_url: string;
    note: string;
  }>;
};
