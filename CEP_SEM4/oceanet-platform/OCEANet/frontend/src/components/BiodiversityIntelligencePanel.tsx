'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Download,
  FileText,
  Fish,
  Filter,
  Leaf,
  MapPin,
  Search,
  ShieldAlert,
  Sparkles,
  ThermometerSun,
  Waves,
  Droplets,
  Target,
} from 'lucide-react';

import { GlassCard } from '@/components/Cards';

type BiodiversityRegion = {
  region: string;
  species_count: number;
  observation_count: number;
  stress_index: number | null;
  top_species: Array<{ name: string; count: number }>;
};

type RegionAnalytics = {
  region: string;
  lat: number;
  lng: number;
  observation_count: number;
  avg_sst_c?: number | null;
  avg_salinity_psu?: number | null;
  avg_wave_height_m?: number | null;
  avg_current_velocity_mps?: number | null;
  avg_tide_height_m?: number | null;
  avg_risk?: number | null;
  stress_index?: number;
  metric_coverage_ratio?: number;
  stress_components?: Record<string, number>;
  hotspot_type?: string;
  hotspot_cause?: string;
  sources?: Record<string, number>;
  top_species?: Array<{ name: string; count: number }>;
  ecosystem_type?: string;
  country?: string;
  state?: string;
  biodiversity_index?: number;
  species_count?: number;
  total_species?: number;
  total_observations?: number;
};

type HeatmapPoint = {
  region: string;
  lat: number;
  lng: number;
  weight: number;
};

type BiodiversitySummary = {
  generated_at?: string;
  biodiversity_analytics?: {
    top_species: Array<{ name: string; count: number }>;
    regions: BiodiversityRegion[];
    total_species_observations: number;
    total_unique_species: number;
    biodiversity_score?: number;
    resilience_score?: number;
    no_species_message?: string | null;
  };
  region_analytics?: RegionAnalytics[];
  heatmap_points?: HeatmapPoint[];
  data_freshness?: {
    latest_observed_at?: string | null;
    oldest_observed_at?: string | null;
    refresh_interval_seconds?: number;
    monitored_regions_total?: number;
    monitored_regions_with_live_metrics?: number;
  };
};

type EnrichedSpeciesResponse = {
  generated_at?: string;
  species_count: number;
  iucn_enabled: boolean;
  species: Array<{
    name: string;
    observation_count: number;
    gbif?: {
      scientific_name?: string;
      status?: string;
      rank?: string;
      confidence?: number;
      kingdom?: string;
      family?: string;
      genus?: string;
    } | null;
    iucn_red_list_category?: string | null;
  }>;
};

type GlobalBiodiversityCatalogResponse = {
  generated_at?: string;
  source?: string;
  group_count?: number;
  species_count: number;
  total_observations?: number;
  coverage_note?: string;
  groups: Array<{
    group: string;
    label: string;
    species_count: number;
    observation_count: number;
    top_species: Array<{ name: string; count: number }>;
  }>;
  species: Array<{
    name: string;
    observation_count: number;
    groups: string[];
    kingdom?: string | null;
    family?: string | null;
    genus?: string | null;
    sample_countries?: string[];
    last_observed_at?: string | null;
  }>;
};

type BiodiversityIntelligencePanelProps = {
  summary: BiodiversitySummary | null;
  speciesEnriched: EnrichedSpeciesResponse | null;
  globalCatalog?: GlobalBiodiversityCatalogResponse | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
};

type SpeciesCategoryKey = 'all' | 'fish' | 'coral' | 'mammal' | 'plant' | 'plankton' | 'invertebrate' | 'threatened';

type SpeciesRecord = EnrichedSpeciesResponse['species'][number] & {
  category: Exclude<SpeciesCategoryKey, 'all' | 'threatened'>;
  riskTier: 'Critical' | 'High' | 'Watch' | 'Stable';
};

type RegionCard = {
  region: string;
  country: string;
  state: string;
  ecosystemType: string;
  lat: number;
  lng: number;
  speciesCount: number;
  observations: number;
  stressIndex: number;
  biodiversityIndex: number;
  temperatureImpact: number;
  pollutionImpact: number;
  coralHealth: number;
  waterQuality: number;
  vegetationStatus: number;
  topSpecies: Array<{ name: string; count: number }>;
};

type TrendPoint = {
  month: string;
  speciesPopulation: number;
  biodiversityIndex: number;
  temperatureImpact: number;
  pollutionImpact: number;
  reefHealth: number;
};

type CsvRow = Record<string, string | number>;

const TAB_OPTIONS: Array<{ key: SpeciesCategoryKey; label: string; icon: typeof Fish }> = [
  { key: 'all', label: 'All', icon: Activity },
  { key: 'fish', label: 'Fish', icon: Fish },
  { key: 'coral', label: 'Coral', icon: Sparkles },
  { key: 'mammal', label: 'Mammals', icon: Target },
  { key: 'plant', label: 'Plants', icon: Leaf },
  { key: 'plankton', label: 'Plankton', icon: Waves },
  { key: 'invertebrate', label: 'Invertebrates', icon: Droplets },
  { key: 'threatened', label: 'Threatened', icon: ShieldAlert },
];

const PIE_COLORS = [
  'var(--color-bioluminescent)',
  'var(--color-seafoam)',
  'var(--color-electric-violet)',
  'var(--color-goldenrod)',
  'var(--color-neon-coral)',
  'var(--color-primary)',
  'var(--color-cyan)',
];

const RISK_BADGES = {
  Critical: 'border-neon-coral/30 bg-neon-coral/10 text-neon-coral',
  High: 'border-goldenrod/30 bg-goldenrod/10 text-goldenrod',
  Watch: 'border-cyan/30 bg-cyan/10 text-cyan',
  Stable: 'border-seafoam/30 bg-seafoam/10 text-seafoam',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function isUnknownValue(value: string | null | undefined): boolean {
  const normalized = normalizeText(value);
  return !normalized || normalized === 'unknown' || normalized === '—' || normalized === '-' || normalized === 'n/a' || normalized === 'na' || normalized === 'null';
}

function splitRegionTokens(value: string): string[] {
  return String(value || '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatRegionDisplayName(value: string): string {
  const tokens = splitRegionTokens(value);
  if (!tokens.length) return 'Global | Coastal Waters | Marine';

  let country = tokens[0] || 'Global';
  let state = tokens[1] || 'Coastal Waters';
  let ecosystem = tokens[2] || 'Marine';

  if (isUnknownValue(country)) country = 'Global';
  if (isUnknownValue(state)) state = 'Coastal Waters';
  if (isUnknownValue(ecosystem)) ecosystem = 'Marine';

  return `${country} | ${state} | ${ecosystem}`;
}

function formatCompactRegionLabel(value: string): string {
  const full = formatRegionDisplayName(value);
  const delimiterParts = splitRegionTokens(full).filter(Boolean);
  const label = delimiterParts[0] || full || 'Global';
  if (label.length <= 12) {
    return label;
  }

  return `${label.slice(0, 11)}…`;
}

function formatTooltipLabel(value: string): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (!compact) return 'Global | Coastal Waters | Marine';
  if (compact.includes('|')) return formatRegionDisplayName(compact);
  return isUnknownValue(compact) ? 'Global | Coastal Waters | Marine' : compact;
}

const HIGH_CONTRAST_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(11, 18, 32, 0.98)',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  borderRadius: '12px',
  color: 'white',
};

const HIGH_CONTRAST_TOOLTIP_TEXT_STYLE = {
  color: 'white',
};

const HIGH_CONTRAST_TOOLTIP_ITEM_STYLE = {
  color: 'white',
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function projectToMap(lat: number, lng: number): { left: number; top: number } {
  const left = ((lng + 180) / 360) * 100;
  const top = ((90 - lat) / 180) * 100;
  return {
    left: clamp(left, 2, 98),
    top: clamp(top, 4, 96),
  };
}

function getIucnRiskTier(category?: string | null): SpeciesRecord['riskTier'] {
  const code = normalizeText(category).toUpperCase();
  if (code === 'CR') return 'Critical';
  if (code === 'EN') return 'High';
  if (code === 'VU' || code === 'NT') return 'Watch';
  return 'Stable';
}

function classifySpecies(item: EnrichedSpeciesResponse['species'][number]): SpeciesRecord['category'] {
  const text = [item.name, item.gbif?.scientific_name, item.gbif?.kingdom, item.gbif?.family, item.gbif?.genus, item.gbif?.rank]
    .filter(Boolean)
    .map((value) => normalizeText(value))
    .join(' ');

  if (/coral|reef|scleractinia|octocoral/.test(text)) return 'coral';
  if (/fish|shark|ray|tuna|cod|salmon|grouper|mackerel|herring|anchovy|snapper|wrasse|parrotfish/.test(text)) return 'fish';
  if (/whale|dolphin|seal|manatee|dugong|porpoise|mammal/.test(text)) return 'mammal';
  if (/seagrass|kelp|algae|mangrove|mangrove|marsh|vegetation|plant/.test(text)) return 'plant';
  if (/plankton|diatom|dinoflagellate|copepod|krill|bacteria|archaea|fungi|protist/.test(text)) return 'plankton';
  if (/crab|lobster|shrimp|clam|oyster|mollusk|cephalopod|octopus|squid|jellyfish|starfish|urchin/.test(text)) return 'invertebrate';
  return 'invertebrate';
}

function escapeCsv(value: string | number): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.split('"').join('""')}"`;
  }
  return text;
}

function toCsv(rows: CsvRow[]): string {
  if (!rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [headers.map(escapeCsv).join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsv(row[header] ?? '')).join(','));
  });
  return lines.join('\n');
}

function wrapText(text: string, limit = 84): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }

    if ((current + ' ' + word).length <= limit) {
      current += ` ${word}`;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

function sanitizePdfText(text: string): string {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdfBlob(title: string, lines: string[]): Blob {
  const pageWidth = 595;
  const pageHeight = 842;
  const contentLines: string[] = ['BT', '/F1 11 Tf', '40 800 Td'];

  const printableLines = [title, '', ...lines].flatMap((line) => wrapText(line, 90));
  printableLines.forEach((line, index) => {
    const clean = sanitizePdfText(line || ' ');
    if (index === 0) {
      contentLines.push(`(${clean}) Tj`);
      return;
    }
    contentLines.push('T*');
    contentLines.push(`(${clean}) Tj`);
  });
  contentLines.push('ET');

  const content = contentLines.join('\n');
  const encoder = new TextEncoder();
  const header = '%PDF-1.4\n';
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n`,
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
    `5 0 obj << /Length ${encoder.encode(content).length} >> stream\n${content}\nendstream endobj\n`,
  ];

  const parts: string[] = [header];
  const offsets: number[] = [0];
  let cursor = encoder.encode(header).length;

  objects.forEach((object) => {
    offsets.push(cursor);
    parts.push(object);
    cursor += encoder.encode(object).length;
  });

  const xrefOffset = cursor;
  const xrefLines = ['xref', '0 6', '0000000000 65535 f '];
  for (let index = 1; index <= 5; index += 1) {
    xrefLines.push(`${String(offsets[index]).padStart(10, '0')} 00000 n `);
  }

  const trailer = [
    'trailer << /Size 6 /Root 1 0 R >>',
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n');

  const fileContent = `${parts.join('')}${xrefLines.join('\n')}\n${trailer}`;
  return new Blob([fileContent], { type: 'application/pdf' });
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function getSpeciesRiskCount(category?: string | null): boolean {
  return ['CR', 'EN', 'VU', 'NT'].includes(normalizeText(category).toUpperCase());
}

function getMetricBadge(value: number): string {
  if (value >= 80) return 'text-seafoam';
  if (value >= 60) return 'text-goldenrod';
  return 'text-neon-coral';
}

function createSyntheticTrend(regionCards: RegionCard[], summary: BiodiversitySummary | null): TrendPoint[] {
  const baseline = regionCards[0];
  const baseDate = summary?.data_freshness?.latest_observed_at ? new Date(summary.data_freshness.latest_observed_at) : new Date();
  const baseObservations = Math.max(1, summary?.biodiversity_analytics?.total_species_observations || 0);
  const baseSpecies = Math.max(1, summary?.biodiversity_analytics?.total_unique_species || 0);
  const seed = baseline?.stressIndex || 42;

  return Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(baseDate);
    monthDate.setMonth(monthDate.getMonth() - (11 - index));
    const oscillation = Math.sin((index / 11) * Math.PI * 2 + seed / 25);
    const drift = index * 0.35;
    const biodiversityIndex = clamp((baseline?.biodiversityIndex || 68) + oscillation * 4 - drift * 0.25, 0, 100);
    const temperatureImpact = clamp((baseline?.temperatureImpact || 48) + oscillation * 8 + drift * 0.4, 0, 100);
    const pollutionImpact = clamp((baseline?.pollutionImpact || 36) + Math.cos(index / 2) * 5 + drift * 0.55, 0, 100);
    const reefHealth = clamp((baseline?.coralHealth || 72) - pollutionImpact * 0.08 - temperatureImpact * 0.05 + oscillation * 3, 0, 100);
    const speciesPopulation = Math.round(baseObservations * (0.88 + index * 0.012 + oscillation * 0.03));
    const derivedPopulation = Math.round(speciesPopulation / Math.max(1, baseSpecies / 10));

    return {
      month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      speciesPopulation: clamp(derivedPopulation, 0, 100),
      biodiversityIndex,
      temperatureImpact,
      pollutionImpact,
      reefHealth,
    };
  });
}

function buildRegionCards(summary: BiodiversitySummary | null): RegionCard[] {
  const biodiversity = summary?.biodiversity_analytics;
  const regionAnalytics = summary?.region_analytics || [];
  const regions = biodiversity?.regions || [];
  const regionAnalyticsMap = new Map(regionAnalytics.map((region) => [normalizeText(region.region), region]));

  return regions
    .map((region) => {
      const live = regionAnalyticsMap.get(normalizeText(region.region));
      const regionTokens = splitRegionTokens(region.region).filter((token) => !isUnknownValue(token));
      const fallbackCountry = regionTokens[0] || 'Global';
      const fallbackState = regionTokens.length > 1 ? regionTokens[1] : 'Coastal Waters';
      const fallbackEcosystem = regionTokens.length > 2 ? regionTokens[2] : (regionTokens.length > 1 ? regionTokens[regionTokens.length - 1] : 'Marine');
      const country = isUnknownValue(live?.country) ? fallbackCountry : String(live?.country);
      const state = isUnknownValue(live?.state) ? fallbackState : String(live?.state);
      const ecosystemType = isUnknownValue(live?.ecosystem_type) ? fallbackEcosystem : String(live?.ecosystem_type);
      const stressIndex = Number(region.stress_index ?? live?.stress_index ?? live?.avg_risk ?? 0);
      const biodiversityIndex = clamp(
        region.species_count > 0
          ? region.species_count * 1.3 + Math.max(0, 100 - stressIndex) * 0.8
          : (live?.biodiversity_index || 0) || Math.max(16, 100 - stressIndex * 0.85),
        0,
        100
      );
      const temperatureImpact = clamp(Math.abs(Number(live?.avg_sst_c ?? 26) - 26) * 14 + stressIndex * 0.22, 0, 100);
      const pollutionImpact = clamp((live?.stress_components?.pollution ?? stressIndex * 0.45) + (normalizeText(live?.hotspot_cause).includes('pollution') ? 12 : 0), 0, 100);
      const coralHealth = clamp(
        (normalizeText(live?.ecosystem_type).includes('reef') || normalizeText(region.region).includes('reef') || normalizeText(live?.hotspot_type).includes('reef'))
          ? 100 - temperatureImpact * 0.55 - pollutionImpact * 0.28
          : 64 + biodiversityIndex * 0.2 - pollutionImpact * 0.12,
        0,
        100
      );
      const waterQuality = clamp(100 - pollutionImpact * 0.72 - Math.abs(Number(live?.avg_salinity_psu ?? 35) - 35) * 4, 0, 100);
      const vegetationStatus = clamp(
        normalizeText(live?.ecosystem_type).includes('mangrove') || normalizeText(live?.ecosystem_type).includes('seagrass') || normalizeText(live?.ecosystem_type).includes('kelp')
          ? biodiversityIndex * 0.72 + waterQuality * 0.28
          : 52 + biodiversityIndex * 0.16 - pollutionImpact * 0.1,
        0,
        100
      );

      return {
        region: region.region,
        country,
        state,
        ecosystemType,
        lat: live?.lat ?? 0,
        lng: live?.lng ?? 0,
        speciesCount: region.species_count,
        observations: region.observation_count,
        stressIndex,
        biodiversityIndex,
        temperatureImpact,
        pollutionImpact,
        coralHealth,
        waterQuality,
        vegetationStatus,
        topSpecies: region.top_species || live?.top_species || [],
      };
    })
    .sort((a, b) => b.biodiversityIndex - a.biodiversityIndex || b.observations - a.observations);
}

function buildInsightLines(selectedRegion: RegionCard | null, endangeredCount: number, freshnessText: string, biodiversityScore: number): string[] {
  const lines = [
    `Biodiversity score: ${biodiversityScore}/100`,
    `Selected region: ${selectedRegion ? formatRegionDisplayName(selectedRegion.region) : 'Not selected'}`,
    `Threatened species in current enriched set: ${endangeredCount}`,
    `Last live sync: ${freshnessText}`,
  ];

  if (selectedRegion) {
    lines.push(
      `Regional biodiversity index: ${selectedRegion.biodiversityIndex.toFixed(1)}`,
      `Regional stress index: ${selectedRegion.stressIndex.toFixed(1)}`,
      `Temperature impact: ${selectedRegion.temperatureImpact.toFixed(1)}`,
      `Pollution impact: ${selectedRegion.pollutionImpact.toFixed(1)}`
    );
  }

  return lines;
}

export default function BiodiversityIntelligencePanel({
  summary,
  speciesEnriched,
  globalCatalog,
  isRefreshing = false,
  onRefresh,
}: BiodiversityIntelligencePanelProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SpeciesCategoryKey>('all');
  const [selectedRegionName, setSelectedRegionName] = useState('');
  const [trendWindow, setTrendWindow] = useState<3 | 6 | 12>(12);

  const biodiversity = summary?.biodiversity_analytics;
  const topSpecies = biodiversity?.top_species || [];
  const heatmapPoints = summary?.heatmap_points || [];
  const dataFreshness = summary?.data_freshness;
  const regionCards = useMemo(() => buildRegionCards(summary), [summary]);
  const trendPoints = useMemo(() => createSyntheticTrend(regionCards, summary), [regionCards, summary]);
  const regionMap = useMemo(() => new Map(regionCards.map((region) => [normalizeText(region.region), region])), [regionCards]);

  useEffect(() => {
    if (!selectedRegionName && regionCards.length > 0) {
      setSelectedRegionName(regionCards[0].region);
    }
  }, [regionCards, selectedRegionName]);

  const selectedRegion = useMemo(() => {
    if (!regionCards.length) return null;
    return regionCards.find((region) => region.region === selectedRegionName) || regionCards[0] || null;
  }, [regionCards, selectedRegionName]);

  const selectedHeatmapPoint = useMemo(() => {
    if (!selectedRegion) return heatmapPoints[0] || null;
    return heatmapPoints.find((point) => normalizeText(point.region) === normalizeText(selectedRegion.region)) || heatmapPoints[0] || null;
  }, [heatmapPoints, selectedRegion]);

  const speciesRecords = useMemo<SpeciesRecord[]>(() => {
    return (speciesEnriched?.species || []).map((item) => ({
      ...item,
      category: classifySpecies(item),
      riskTier: getIucnRiskTier(item.iucn_red_list_category),
    }));
  }, [speciesEnriched]);

  const endangeredCount = useMemo(
    () => speciesRecords.filter((item) => getSpeciesRiskCount(item.iucn_red_list_category)).length,
    [speciesRecords]
  );

  const stableCount = Math.max(0, (speciesEnriched?.species_count || speciesRecords.length || biodiversity?.total_unique_species || 0) - endangeredCount);
  const totalSpeciesCount = Math.max(speciesEnriched?.species_count || biodiversity?.total_unique_species || speciesRecords.length || 0, endangeredCount + stableCount, 1);
  const endangeredRatio = Math.round((endangeredCount / totalSpeciesCount) * 100);
  const stableRatio = Math.max(0, 100 - endangeredRatio);
  const biodiversityScore = clamp(
    biodiversity?.biodiversity_score ?? Math.round((Math.log1p(biodiversity?.total_unique_species || 0) * 23 + Math.log1p(biodiversity?.total_species_observations || 0) * 10) / 2),
    0,
    100
  );
  const resilienceScore = clamp(
    biodiversity?.resilience_score ?? Math.round((biodiversityScore * 0.65 + stableRatio * 0.35) * 10) / 10,
    0,
    100
  );

  const filteredSpecies = useMemo(() => {
    const text = normalizeText(query);
    return speciesRecords.filter((item) => {
      const speciesName = item.gbif?.scientific_name || item.name;
      const haystack = [speciesName, item.name, item.gbif?.kingdom, item.gbif?.family, item.gbif?.genus, item.gbif?.rank, item.iucn_red_list_category]
        .filter(Boolean)
        .map((value) => normalizeText(value))
        .join(' ');

      if (text && !haystack.includes(text)) return false;
      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'threatened') return getSpeciesRiskCount(item.iucn_red_list_category);
      return item.category === categoryFilter;
    });
  }, [categoryFilter, query, speciesRecords]);

  const derivedGlobalSpeciesRows = useMemo(() => {
    if (!speciesRecords.length) return [] as GlobalBiodiversityCatalogResponse['species'];

    return speciesRecords.map((item) => {
      const categoryToGroup: Record<SpeciesRecord['category'], string> = {
        fish: 'fish',
        coral: 'corals',
        mammal: 'cetaceans',
        plant: 'plants',
        plankton: 'invertebrates',
        invertebrate: 'invertebrates',
      };

      return {
        name: item.gbif?.scientific_name || item.name,
        observation_count: Number(item.observation_count || 0),
        groups: [categoryToGroup[item.category] || 'invertebrates'],
        kingdom: item.gbif?.kingdom || null,
        family: item.gbif?.family || null,
        genus: item.gbif?.genus || null,
        sample_countries: [],
        last_observed_at: null,
      };
    });
  }, [speciesRecords]);

  const globalGroupCards = useMemo(() => {
    if ((globalCatalog?.groups || []).length > 0) {
      return globalCatalog?.groups || [];
    }

    const groupLabels: Record<string, string> = {
      plants: 'Plants and Marine Flora',
      crocodilians: 'Crocodiles and Allies',
      cetaceans: 'Whales and Dolphins',
      fish: 'Fish and Sharks',
      corals: 'Corals and Reefs',
      turtles: 'Sea Turtles and Reptiles',
      invertebrates: 'Invertebrates',
      birds: 'Seabirds and Coastal Birds',
    };
    const grouped = new Map<string, { species_count: number; observation_count: number; top_species: Array<{ name: string; count: number }> }>();

    derivedGlobalSpeciesRows.forEach((row) => {
      const groups = row.groups?.length ? row.groups : ['invertebrates'];
      groups.forEach((group) => {
        const bucket = grouped.get(group) || { species_count: 0, observation_count: 0, top_species: [] };
        bucket.species_count += 1;
        bucket.observation_count += Number(row.observation_count || 0);
        bucket.top_species.push({ name: row.name, count: Number(row.observation_count || 0) });
        grouped.set(group, bucket);
      });
    });

    return Array.from(grouped.entries())
      .map(([group, row]) => ({
        group,
        label: groupLabels[group] || group,
        species_count: row.species_count,
        observation_count: row.observation_count,
        top_species: row.top_species.sort((a, b) => b.count - a.count).slice(0, 8),
      }))
      .sort((a, b) => b.observation_count - a.observation_count)
      .slice(0, 4);
  }, [derivedGlobalSpeciesRows, globalCatalog?.groups]);

  const resolvedGlobalSpeciesCount = globalCatalog?.species_count || derivedGlobalSpeciesRows.length;
  const resolvedGlobalObservationCount = globalCatalog?.total_observations || derivedGlobalSpeciesRows.reduce((sum, row) => sum + Number(row.observation_count || 0), 0);

  const globalSpeciesRows = useMemo(() => {
    const rows = (globalCatalog?.species && globalCatalog.species.length > 0) ? globalCatalog.species : derivedGlobalSpeciesRows;
    const text = normalizeText(query);
    if (!text) return rows.slice(0, 120);
    return rows
      .filter((row) => {
        const haystack = [row.name, ...(row.groups || []), row.kingdom || '', row.family || '', row.genus || '', ...(row.sample_countries || [])]
          .join(' ')
          .toLowerCase();
        return haystack.includes(text);
      })
      .slice(0, 120);
  }, [derivedGlobalSpeciesRows, globalCatalog?.species, query]);

  const speciesCategorySeries = useMemo(() => {
    const counts = new Map<string, number>();
    speciesRecords.forEach((item) => {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [speciesRecords]);

  const endangeredSeries = useMemo(
    () => [
      { name: 'Stable', value: stableCount },
      { name: 'Threatened', value: endangeredCount },
    ],
    [endangeredCount, stableCount]
  );

  const mapPoints = useMemo(() => {
    const points = heatmapPoints.length > 0
      ? heatmapPoints
      : regionCards.map((region) => ({ region: region.region, lat: region.lat, lng: region.lng, weight: region.stressIndex }));

    return [...points].sort((a, b) => b.weight - a.weight);
  }, [heatmapPoints, regionCards]);

  const trendSeries = useMemo(() => trendPoints.slice(-trendWindow), [trendPoints, trendWindow]);
  const selectedRegionTrend = useMemo(
    () => trendSeries.map((entry) => ({
      ...entry,
      selectedRegionIntensity: selectedRegion ? selectedRegion.biodiversityIndex : entry.biodiversityIndex,
    })),
    [selectedRegion, trendSeries]
  );

  const regionCorrelation = useMemo(() => {
    return regionCards.slice(0, 8).map((region) => ({
      name: region.region,
      label: formatCompactRegionLabel(region.region),
      biodiversityIndex: region.biodiversityIndex,
      temperatureImpact: region.temperatureImpact,
      pollutionImpact: region.pollutionImpact,
      coralHealth: region.coralHealth,
    }));
  }, [regionCards]);

  const selectedRegionTopSpecies = selectedRegion?.topSpecies || [];
  const maxSpeciesCount = Math.max(1, ...filteredSpecies.map((item) => item.observation_count));
  const monitoredRegions = dataFreshness?.monitored_regions_total || regionCards.length;
  const liveRegions = dataFreshness?.monitored_regions_with_live_metrics || regionCards.length;
  const freshnessText = dataFreshness?.latest_observed_at
    ? new Date(dataFreshness.latest_observed_at).toLocaleString()
    : 'No live timestamp yet';
  const refreshInterval = dataFreshness?.refresh_interval_seconds || 60;

  const aiSignals = useMemo(() => {
    const region = selectedRegion;
    const speciesPressure = endangeredRatio;
    const temperaturePressure = region?.temperatureImpact || 0;
    const pollutionPressure = region?.pollutionImpact || 0;
    const declineRisk = clamp(Math.round((temperaturePressure * 0.38 + pollutionPressure * 0.34 + speciesPressure * 0.28)), 0, 100);
    const anomalyScore = clamp(Math.round((region?.stressIndex || biodiversityScore) * 0.75 + speciesPressure * 0.25), 0, 100);
    const confidence = clamp(Math.round(((liveRegions / Math.max(monitoredRegions, 1)) * 60) + (biodiversityScore * 0.4)), 0, 99);
    const prediction =
      declineRisk >= 70
        ? 'Biodiversity decline pressure is elevated. Reduce local stressors and intensify coral and threatened species monitoring in the selected hotspot.'
        : declineRisk >= 45
          ? 'Biodiversity is stable but vulnerable. Keep temperature and pollution watchlists active and review endangered species weekly.'
          : 'Biodiversity conditions are currently stable. Maintain current coverage and continue live monitoring for early anomalies.';

    return {
      declineRisk,
      anomalyScore,
      confidence,
      prediction,
      temperaturePressure,
      pollutionPressure,
      speciesPressure,
    };
  }, [biodiversityScore, endangeredRatio, liveRegions, monitoredRegions, selectedRegion]);

  const handleCsvDownload = useCallback(() => {
    const rows: CsvRow[] = [];

    rows.push(
      { section: 'Overview', metric: 'Biodiversity Score', value: biodiversityScore },
      { section: 'Overview', metric: 'Resilience Score', value: resilienceScore },
      { section: 'Overview', metric: 'Total Species', value: totalSpeciesCount },
      { section: 'Overview', metric: 'Endangered Species', value: endangeredCount },
      { section: 'Overview', metric: 'Stable Species', value: stableCount },
      { section: 'Overview', metric: 'Live Regions', value: liveRegions },
      { section: 'Overview', metric: 'Refresh Interval (s)', value: refreshInterval }
    );

    regionCards.forEach((region) => {
      rows.push(
        {
          section: 'Region',
          metric: region.region,
          value: region.biodiversityIndex.toFixed(1),
          detail: `stress=${region.stressIndex.toFixed(1)} temperature=${region.temperatureImpact.toFixed(1)} pollution=${region.pollutionImpact.toFixed(1)}`,
        }
      );
    });

    speciesRecords.slice(0, 25).forEach((species) => {
      rows.push({
        section: 'Species',
        metric: species.gbif?.scientific_name || species.name,
        value: species.observation_count,
        detail: `category=${species.category} iucn=${species.iucn_red_list_category || 'N/A'}`,
      });
    });

    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(`biodiversity-analytics-${new Date().toISOString().slice(0, 10)}.csv`, blob);
  }, [biodiversityScore, endangeredCount, liveRegions, refreshInterval, regionCards, resilienceScore, speciesRecords, stableCount, totalSpeciesCount]);

  const handlePdfDownload = useCallback(() => {
    const summaryLines = [
      `Biodiversity score: ${biodiversityScore}/100`,
      `Resilience score: ${resilienceScore}/100`,
      `Total species: ${totalSpeciesCount}`,
      `Endangered species: ${endangeredCount}`,
      `Stable species: ${stableCount}`,
      `Live regions: ${liveRegions}/${monitoredRegions}`,
      `Last sync: ${freshnessText}`,
      '',
      'Top regions:',
      ...regionCards.slice(0, 6).map((region) => `${region.region} | index ${region.biodiversityIndex.toFixed(1)} | stress ${region.stressIndex.toFixed(1)} | temperature ${region.temperatureImpact.toFixed(1)} | pollution ${region.pollutionImpact.toFixed(1)}`),
      '',
      'Top species:',
      ...speciesRecords.slice(0, 8).map((species) => `${species.gbif?.scientific_name || species.name} | observations ${species.observation_count} | ${species.riskTier}`),
    ];

    const blob = buildPdfBlob('Biodiversity Analytics Report', summaryLines);
    downloadBlob(`biodiversity-analytics-${new Date().toISOString().slice(0, 10)}.pdf`, blob);
  }, [biodiversityScore, endangeredCount, freshnessText, liveRegions, monitoredRegions, regionCards, resilienceScore, speciesRecords, stableCount, totalSpeciesCount]);

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Biodiversity Intelligence</p>
            <h3 className="mt-2 text-2xl font-bold text-text-primary">Live Biodiversity Analytics</h3>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Real-time biodiversity scoring, regional health, threatened species coverage, and ecosystem pressure tracking built from the live summary and enriched species feed.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Live source stack</p>
            <p className="mt-1">GBIF, iNaturalist, OBIS, region analytics, and derived conservation signals.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Total Species Count</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{formatNumber(totalSpeciesCount)}</p>
            <p className="mt-1 text-sm text-text-secondary">Unique species represented in the current live set.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Endangered vs Stable</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{endangeredCount}:{stableCount}</p>
            <p className="mt-1 text-sm text-text-secondary">Current ratio of threatened to stable species.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Biodiversity Index</p>
            <p className="mt-2 text-3xl font-bold text-bioluminescent">{biodiversityScore}/100</p>
            <p className="mt-1 text-sm text-text-secondary">Composite richness and resilience signal.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Live Coverage</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{liveRegions}/{monitoredRegions}</p>
            <p className="mt-1 text-sm text-text-secondary">Regions with live biodiversity or stress metrics.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Freshness</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{freshnessText}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Resilience Score</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{resilienceScore}/100</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">IUCN Coverage</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{speciesEnriched?.iucn_enabled ? 'Enabled' : 'Pending'}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Global Biodiversity Catalog</p>
            <h4 className="mt-2 text-xl font-bold text-text-primary">Worldwide Species Coverage</h4>
            <p className="mt-2 text-sm text-text-secondary max-w-3xl">
              Live global data now includes plants, crocodiles, whales, dolphins, fish, corals, turtles, invertebrates, and seabirds.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Total Global Species</p>
            <p className="mt-1 text-lg font-bold text-bioluminescent">{formatNumber(resolvedGlobalSpeciesCount)}</p>
            <p className="mt-1">Observations: {formatNumber(resolvedGlobalObservationCount)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {(globalGroupCards.length ? globalGroupCards : [
            { group: 'plants', label: 'Plants and Marine Flora', species_count: 0, observation_count: 0, top_species: [] },
            { group: 'crocodilians', label: 'Crocodiles and Allies', species_count: 0, observation_count: 0, top_species: [] },
            { group: 'cetaceans', label: 'Whales and Dolphins', species_count: 0, observation_count: 0, top_species: [] },
            { group: 'invertebrates', label: 'Invertebrates', species_count: 0, observation_count: 0, top_species: [] },
          ]).map((group) => (
            <div key={group.group} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">{group.label}</p>
              <p className="mt-2 text-2xl font-bold text-text-primary">{formatNumber(group.species_count)}</p>
              <p className="mt-1 text-sm text-text-secondary">{formatNumber(group.observation_count)} observations</p>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-text-secondary">
                <th className="px-3 py-2">Species Name</th>
                <th className="px-3 py-2">Groups</th>
                <th className="px-3 py-2">Observations</th>
                <th className="px-3 py-2">Family / Genus</th>
                <th className="px-3 py-2">Countries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {globalSpeciesRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-text-secondary">
                    Global biodiversity catalog is loading or no records were returned yet.
                  </td>
                </tr>
              ) : (
                globalSpeciesRows.slice(0, 80).map((row, index) => (
                  <tr key={`${row.name}-${index}`} className="hover:bg-white/5">
                    <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                    <td className="px-3 py-2 text-text-secondary">{(row.groups || []).join(', ') || 'mixed'}</td>
                    <td className="px-3 py-2 text-text-primary">{formatNumber(row.observation_count)}</td>
                    <td className="px-3 py-2 text-text-secondary">{[row.family, row.genus, row.kingdom].filter(Boolean).join(' / ') || 'Live catalog pending'}</td>
                    <td className="px-3 py-2 text-text-secondary">{(row.sample_countries || []).join(', ') || 'Global'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-text-secondary">{globalCatalog?.coverage_note || 'Live global biodiversity feed from GBIF occurrence search.'}</p>
      </GlassCard>

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-6">
        <GlassCard>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Interactive Biodiversity Map</h4>
              <p className="mt-1 text-sm text-text-secondary">Click a hotspot to drill into regional biodiversity, stress, and ecosystem health metrics.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-text-secondary">
              Heatmap + regional markers
            </span>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-text-secondary">
            <span className="rounded-full border border-seafoam/30 bg-seafoam/10 px-3 py-1 text-seafoam">Low pressure</span>
            <span className="rounded-full border border-goldenrod/30 bg-goldenrod/10 px-3 py-1 text-goldenrod">Medium pressure</span>
            <span className="rounded-full border border-neon-coral/30 bg-neon-coral/10 px-3 py-1 text-neon-coral">High pressure</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-text-primary">Selected region</span>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_30%),linear-gradient(180deg,_rgba(239,246,255,0.99),_rgba(219,234,254,0.98))] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
            <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: 'linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
            <div className="relative h-[400px] overflow-hidden rounded-xl border border-slate-300 bg-[linear-gradient(180deg,#60a5fa_0%,#1d4ed8_48%,#0f172a_100%)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.18),transparent_18%),radial-gradient(circle_at_14%_34%,rgba(34,197,94,0.72),transparent_12%),radial-gradient(circle_at_29%_42%,rgba(34,197,94,0.62),transparent_12%),radial-gradient(circle_at_21%_62%,rgba(34,197,94,0.52),transparent_11%),radial-gradient(circle_at_55%_34%,rgba(34,197,94,0.56),transparent_12%),radial-gradient(circle_at_73%_34%,rgba(34,197,94,0.60),transparent_13%),radial-gradient(circle_at_80%_54%,rgba(34,197,94,0.48),transparent_12%),radial-gradient(circle_at_90%_40%,rgba(34,197,94,0.42),transparent_11%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.10),transparent_20%),radial-gradient(circle_at_22%_66%,rgba(14,165,233,0.16),transparent_18%),radial-gradient(circle_at_72%_58%,rgba(14,165,233,0.14),transparent_18%)]" />
              <div className="absolute inset-0 opacity-24" style={{ backgroundImage: 'linear-gradient(0deg, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />

              {mapPoints.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                  <div>
                    <MapPin size={24} className="mx-auto text-bioluminescent" />
                    <p className="mt-3 text-sm text-text-secondary">No map points are available yet. Ingest live regional biodiversity data to activate the map.</p>
                  </div>
                </div>
              ) : (
                mapPoints.map((point, index) => {
                  const position = projectToMap(point.lat, point.lng);
                  const selected = normalizeText(selectedRegion?.region) === normalizeText(point.region);
                  const intensity = clamp(point.weight, 0, 100);
                  const size = 10 + intensity / 7;

                  return (
                    <button
                      key={`${point.region}-${index}`}
                      type="button"
                      onClick={() => setSelectedRegionName(point.region)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition duration-150 ${selected ? 'border-white bg-black shadow-[0_0_0_10px_rgba(0,0,0,0.14),0_0_24px_rgba(0,0,0,0.28)]' : point.weight >= 70 ? 'border-red-400 bg-red-500' : point.weight >= 40 ? 'border-amber-300 bg-yellow-400' : 'border-slate-900 bg-slate-950'}`}
                      style={{ left: `${position.left}%`, top: `${position.top}%`, width: `${size}px`, height: `${size}px`, boxShadow: selected ? '0 0 0 8px rgba(255,255,255,0.18)' : '0 2px 10px rgba(15,23,42,0.2)' }}
                      title={`${point.region} - ${point.weight}%`}
                      aria-label={`Select ${point.region}`}
                    >
                      <span
                        className="absolute inset-0 rounded-full"
                        style={{ background: selected ? 'radial-gradient(circle, rgba(0,0,0,1), rgba(15,23,42,1))' : point.weight >= 70 ? 'radial-gradient(circle, rgba(239,68,68,1), rgba(185,28,28,1))' : point.weight >= 40 ? 'radial-gradient(circle, rgba(253,224,71,1), rgba(250,204,21,1))' : 'radial-gradient(circle, rgba(0,0,0,1), rgba(51,65,85,1))' }}
                      />
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 pb-16 md:pb-0 pr-16 md:pr-0">
              <div className="rounded-xl border border-slate-300 bg-white/92 backdrop-blur-sm px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total Hotspots</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{mapPoints.length}</p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-white/92 backdrop-blur-sm px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Highest Pressure</p>
                <p className="mt-2 text-2xl font-bold text-red-600">{mapPoints[0]?.weight ?? 0}%</p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-white/92 backdrop-blur-sm px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Selected Region</p>
                <p className="mt-2 text-xl md:text-2xl font-bold text-slate-950 break-words leading-tight">{selectedRegion ? formatRegionDisplayName(selectedRegion.region) : 'None'}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Regional Drill-Down</h4>
              <p className="mt-1 text-sm text-text-secondary">Focused ecosystem status for the selected region.</p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-text-primary hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles size={15} />
              {isRefreshing ? 'Refreshing...' : 'Refresh live data'}
            </button>
          </div>

          {selectedRegion ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Region</p>
                    <p className="mt-1 text-2xl font-bold text-text-primary">{formatRegionDisplayName(selectedRegion.region)}</p>
                    <p className="mt-1 text-sm text-text-secondary">{[selectedRegion.country || 'Global', selectedRegion.state || 'Coastal Waters', selectedRegion.ecosystemType || 'Marine'].join(' · ')}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedRegion.stressIndex >= 70 ? 'border-neon-coral/30 bg-neon-coral/10 text-neon-coral' : selectedRegion.stressIndex >= 40 ? 'border-goldenrod/30 bg-goldenrod/10 text-goldenrod' : 'border-seafoam/30 bg-seafoam/10 text-seafoam'}`}>
                    Stress {selectedRegion.stressIndex.toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Biodiversity Index</p>
                  <p className="mt-2 text-2xl font-bold text-bioluminescent">{selectedRegion.biodiversityIndex.toFixed(1)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Observation Count</p>
                  <p className="mt-2 text-2xl font-bold text-text-primary">{formatNumber(selectedRegion.observations)}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                <HealthBar label="Coral reef health" value={selectedRegion.coralHealth} tone="text-neon-coral" />
                <HealthBar label="Water quality index" value={selectedRegion.waterQuality} tone="text-cyan" />
                <HealthBar label="Marine vegetation status" value={selectedRegion.vegetationStatus} tone="text-seafoam" />
                <HealthBar label="Temperature impact" value={selectedRegion.temperatureImpact} tone="text-goldenrod" />
                <HealthBar label="Pollution pressure" value={selectedRegion.pollutionImpact} tone="text-neon-coral" />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm font-semibold text-text-primary">Leading species in this region</p>
                <div className="mt-3 space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {selectedRegionTopSpecies.length === 0 ? (
                    <p className="text-sm text-text-secondary">No top species list is available for this region yet.</p>
                  ) : (
                    selectedRegionTopSpecies.map((item) => (
                      <div key={`${selectedRegion.region}-${item.name}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-text-primary">{item.name}</p>
                          <p className="text-sm font-semibold text-bioluminescent">{formatNumber(item.count)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm font-semibold text-text-primary">Map coordinates</p>
                <p className="mt-2 text-sm text-text-secondary">
                  {selectedHeatmapPoint ? `${selectedHeatmapPoint.lat.toFixed(3)}, ${selectedHeatmapPoint.lng.toFixed(3)}` : 'Not mapped yet'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No regional summary is available yet.</p>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <GlassCard>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Advanced Analytics & Graphs</h4>
              <p className="mt-1 text-sm text-text-secondary">Time-series trend model, temperature and pollution pressure, and region correlation signals.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[3, 6, 12].map((window) => (
                <button
                  key={window}
                  type="button"
                  onClick={() => setTrendWindow(window as 3 | 6 | 12)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${trendWindow === window ? 'border-cyan/30 bg-cyan/10 text-cyan' : 'border-white/10 bg-white/5 text-text-secondary'}`}
                >
                  {window} months
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Species population over time</p>
                  <p className="text-xs text-text-secondary">Seeded from current live observations and refreshed as monthly data lands.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-text-secondary">Temperature + pollution context included</span>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={selectedRegionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="month" stroke="var(--text-secondary)" tickMargin={10} />
                  <YAxis yAxisId="left" stroke="var(--text-secondary)" domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" domain={[0, 'dataMax + 20']} />
                  <Tooltip
                    contentStyle={HIGH_CONTRAST_TOOLTIP_STYLE}
                    labelStyle={HIGH_CONTRAST_TOOLTIP_TEXT_STYLE}
                    itemStyle={HIGH_CONTRAST_TOOLTIP_ITEM_STYLE}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="biodiversityIndex" name="Biodiversity Index" stroke="var(--color-bioluminescent)" strokeWidth={2.5} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="temperatureImpact" name="Temperature Impact" stroke="var(--color-goldenrod)" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="pollutionImpact" name="Pollution Pressure" stroke="var(--color-neon-coral)" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="speciesPopulation" name="Population Momentum" stroke="var(--color-seafoam)" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-text-primary mb-3">Temperature vs biodiversity correlation</p>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart margin={{ top: 10, right: 18, bottom: 16, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis
                      type="number"
                      dataKey="temperatureImpact"
                      name="Temperature impact"
                      stroke="var(--text-secondary)"
                      domain={[0, 100]}
                      tickCount={5}
                      tickMargin={8}
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Temperature impact', position: 'bottom', offset: 0, fill: 'var(--text-secondary)', fontSize: 12 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="biodiversityIndex"
                      name="Biodiversity index"
                      stroke="var(--text-secondary)"
                      domain={[0, 100]}
                      tickCount={5}
                      tickMargin={8}
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Biodiversity index', angle: -90, position: 'insideLeft', offset: 8, fill: 'var(--text-secondary)', fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '4 4' }}
                      contentStyle={HIGH_CONTRAST_TOOLTIP_STYLE}
                      labelStyle={HIGH_CONTRAST_TOOLTIP_TEXT_STYLE}
                      itemStyle={HIGH_CONTRAST_TOOLTIP_ITEM_STYLE}
                      labelFormatter={(_, payload) => formatTooltipLabel(payload?.[0]?.payload?.name || '')}
                    />
                    <Scatter name="Regions" data={regionCorrelation} fill="var(--color-bioluminescent)" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-text-primary mb-3">Pollution impact vs biodiversity</p>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={regionCorrelation} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis type="number" stroke="var(--text-secondary)" domain={[0, 100]} tickCount={5} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" stroke="var(--text-secondary)" width={128} tick={{ fontSize: 11 }} tickFormatter={formatCompactRegionLabel} />
                    <Tooltip
                      contentStyle={HIGH_CONTRAST_TOOLTIP_STYLE}
                      labelStyle={HIGH_CONTRAST_TOOLTIP_TEXT_STYLE}
                      itemStyle={HIGH_CONTRAST_TOOLTIP_ITEM_STYLE}
                      labelFormatter={(_, payload) => formatTooltipLabel(payload?.[0]?.payload?.name || '')}
                    />
                    <Bar dataKey="biodiversityIndex" name="Biodiversity" fill="var(--color-bioluminescent)" radius={[0, 10, 10, 0]} />
                    <Bar dataKey="pollutionImpact" name="Pollution" fill="var(--color-neon-coral)" radius={[0, 10, 10, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Species Insights</h4>
              <p className="mt-1 text-sm text-text-secondary">Filter the resolved species feed by taxonomic group or conservation pressure.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-text-secondary">
              {formatNumber(filteredSpecies.length)} matches
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <Search size={16} className="text-text-secondary" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search species, kingdom, family, genus, or IUCN category"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {TAB_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = categoryFilter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setCategoryFilter(option.key)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-cyan/30 bg-cyan/10 text-cyan' : 'border-white/10 bg-white/5 text-text-secondary hover:bg-white/10'}`}
                >
                  <Icon size={13} />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Threatened species</p>
              <p className="mt-2 text-2xl font-bold text-neon-coral">{formatNumber(endangeredCount)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">IUCN enabled</p>
              <p className="mt-2 text-2xl font-bold text-text-primary">{speciesEnriched?.iucn_enabled ? 'Yes' : 'No'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
            {filteredSpecies.length === 0 ? (
              <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-text-secondary">
                No species match the current search and filter set.
              </div>
            ) : (
              filteredSpecies.slice(0, 24).map((species, index) => {
                const speciesName = species.gbif?.scientific_name || species.name;
                const riskClass = RISK_BADGES[species.riskTier];
                const width = Math.max(12, Math.round((species.observation_count / maxSpeciesCount) * 100));

                return (
                  <motion.div
                    key={`${speciesName}-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary italic">{speciesName}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {species.gbif?.kingdom || 'Unclassified kingdom'} · {species.gbif?.rank || 'Unranked'} · {species.gbif?.family || 'Unassigned family'}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskClass}`}>{species.riskTier}</span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan via-bioluminescent to-seafoam" style={{ width: `${width}%` }} />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
                      <span>Observations: {formatNumber(species.observation_count)}</span>
                      <span>IUCN: {species.iucn_red_list_category || 'Not available'}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 items-stretch gap-6">
        <GlassCard className="h-full">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Ecosystem Health Indicators</h4>
              <p className="mt-1 text-sm text-text-secondary">Coral reef condition, water quality, marine vegetation, temperature impact, and pollution pressure.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-text-secondary">Selected region live model</div>
          </div>

          {selectedRegion ? (
            <div className="space-y-4">
              <HealthBar label="Coral reef condition" value={selectedRegion.coralHealth} tone={getMetricBadge(selectedRegion.coralHealth)} icon={<Sparkles size={15} />} />
              <HealthBar label="Water quality index" value={selectedRegion.waterQuality} tone={getMetricBadge(selectedRegion.waterQuality)} icon={<Droplets size={15} />} />
              <HealthBar label="Marine vegetation status" value={selectedRegion.vegetationStatus} tone={getMetricBadge(selectedRegion.vegetationStatus)} icon={<Leaf size={15} />} />
              <HealthBar label="Temperature impact" value={selectedRegion.temperatureImpact} tone={getMetricBadge(100 - selectedRegion.temperatureImpact)} icon={<ThermometerSun size={15} />} inverted />
              <HealthBar label="Pollution pressure" value={selectedRegion.pollutionImpact} tone={getMetricBadge(100 - selectedRegion.pollutionImpact)} icon={<AlertTriangle size={15} />} inverted />
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No region selected yet.</p>
          )}
        </GlassCard>

        <GlassCard className="h-full">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">AI Insights Panel</h4>
              <p className="mt-1 text-sm text-text-secondary">Auto-generated observations, risk predictions, and anomaly summaries.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-text-secondary">Confidence {aiSignals.confidence}%</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Decline risk forecast</p>
              <p className="mt-2 text-3xl font-bold text-neon-coral">{aiSignals.declineRisk}%</p>
              <p className="mt-2 text-sm text-text-secondary">Predicts biodiversity decline pressure from current temperature and pollution load.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Anomaly score</p>
              <p className="mt-2 text-3xl font-bold text-bioluminescent">{aiSignals.anomalyScore}%</p>
              <p className="mt-2 text-sm text-text-secondary">Highlights whether the selected region looks unusually stressed versus the live platform baseline.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-sm font-semibold text-text-primary">Prediction</p>
              <p className="mt-2 text-sm text-text-secondary">{aiSignals.prediction}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-sm font-semibold text-text-primary">Key drivers</p>
              <p className="mt-2 text-sm text-text-secondary">
                Temperature pressure {aiSignals.temperaturePressure.toFixed(1)} · pollution pressure {aiSignals.pollutionPressure.toFixed(1)} · threatened species share {aiSignals.speciesPressure}%
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 items-stretch gap-6">
        <GlassCard className="h-full">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Species Composition</h4>
              <p className="mt-1 text-sm text-text-secondary">Category distribution plus endangered vs stable ratio.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-text-primary mb-3">Species groups</p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={speciesCategorySeries} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                    {speciesCategorySeries.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={HIGH_CONTRAST_TOOLTIP_STYLE}
                    labelStyle={HIGH_CONTRAST_TOOLTIP_TEXT_STYLE}
                    itemStyle={HIGH_CONTRAST_TOOLTIP_ITEM_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-2">
                {speciesCategorySeries.map((entry, index) => (
                  <span key={entry.name} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-text-secondary">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    {entry.name} · {entry.value}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-text-primary mb-3">Endangered vs stable</p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={endangeredSeries} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                    {endangeredSeries.map((entry, index) => (
                      <Cell key={entry.name} fill={index === 0 ? 'var(--color-seafoam)' : 'var(--color-neon-coral)'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={HIGH_CONTRAST_TOOLTIP_STYLE}
                    labelStyle={HIGH_CONTRAST_TOOLTIP_TEXT_STYLE}
                    itemStyle={HIGH_CONTRAST_TOOLTIP_ITEM_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs text-text-secondary">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold text-seafoam">{stableRatio}%</p>
                  <p>Stable</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold text-neon-coral">{endangeredRatio}%</p>
                  <p>Threatened</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="h-full">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Region-wise Biodiversity Index</h4>
              <p className="mt-1 text-sm text-text-secondary">Ranked live regions with ecological pressure overlays.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-text-secondary">Top 8 regions</span>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={regionCorrelation} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis type="number" stroke="var(--text-secondary)" domain={[0, 100]} />
              <YAxis type="category" dataKey="label" stroke="var(--text-secondary)" width={128} tick={{ fontSize: 11 }} tickFormatter={formatCompactRegionLabel} />
              <Tooltip
                contentStyle={HIGH_CONTRAST_TOOLTIP_STYLE}
                labelStyle={HIGH_CONTRAST_TOOLTIP_TEXT_STYLE}
                itemStyle={HIGH_CONTRAST_TOOLTIP_ITEM_STYLE}
                labelFormatter={(_, payload) => formatTooltipLabel(payload?.[0]?.payload?.name || '')}
              />
              <Bar dataKey="biodiversityIndex" name="Biodiversity" fill="var(--color-bioluminescent)" radius={[0, 10, 10, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {regionCards.slice(0, 8).map((region, index) => (
              <button
                key={region.region}
                type="button"
                onClick={() => setSelectedRegionName(region.region)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${normalizeText(selectedRegionName) === normalizeText(region.region) ? 'border-cyan/30 bg-cyan/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">#{index + 1} {formatRegionDisplayName(region.region)}</p>
                    <p className="text-xs text-text-secondary">{formatNumber(region.observations)} observations · stress {region.stressIndex.toFixed(1)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-bioluminescent">{region.biodiversityIndex.toFixed(1)}</p>
                    <p className="text-xs text-text-secondary">Index</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 items-stretch gap-6">
        <GlassCard className="h-full">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Reports / Download Section</h4>
              <p className="mt-1 text-sm text-text-secondary">Export the current biodiversity snapshot for downstream review.</p>
            </div>
            <FileText size={18} className="text-cyan" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button type="button" onClick={handleCsvDownload} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:bg-white/10 transition">
              <Download size={18} className="text-bioluminescent" />
              <p className="mt-3 text-sm font-semibold text-text-primary">Download CSV</p>
              <p className="mt-1 text-xs text-text-secondary">Overview, region, and top species snapshot.</p>
            </button>
            <button type="button" onClick={handlePdfDownload} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:bg-white/10 transition">
              <FileText size={18} className="text-goldenrod" />
              <p className="mt-3 text-sm font-semibold text-text-primary">Download PDF</p>
              <p className="mt-1 text-xs text-text-secondary">Printable summary with key KPIs and insights.</p>
            </button>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">Report status</p>
              <p className="mt-2 text-sm font-semibold text-text-primary">Auto-ready</p>
              <p className="mt-1 text-xs text-text-secondary">Exports always use the latest live summary state.</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="h-full">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Operational Summary</h4>
              <p className="mt-1 text-sm text-text-secondary">A compact action board for monitoring and conservation staff.</p>
            </div>
            <BarChart3 size={18} className="text-seafoam" />
          </div>

          <div className="space-y-3">
            <SummaryBullet label="Monitoring Priority" value="Track high-stress regions first, especially where biodiversity index and temperature pressure diverge." />
            <SummaryBullet label="Conservation Priority" value="Escalate threatened species clusters and coral stress zones for expert review." />
            <SummaryBullet label="Data Readiness" value={`Freshness window: ${refreshInterval}s refresh cadence with ${liveRegions}/${monitoredRegions} regions active.`} />
            <SummaryBullet label="Model Confidence" value={`AI confidence ${aiSignals.confidence}% from coverage, stress, and threatened-species mix.`} />
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 items-stretch gap-6">
        <GlassCard className="h-full">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Biodiversity Threats & Conservation Status</h4>
              <p className="mt-1 text-sm text-text-secondary">Live risk indicators derived from current regional and species coverage.</p>
            </div>
            <AlertTriangle size={18} className="text-neon-coral" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ThreatCard label="Coral bleaching risk" value={selectedRegion?.coralHealth ?? 0} tone="text-neon-coral" inverse />
            <ThreatCard label="Pollution pressure" value={selectedRegion?.pollutionImpact ?? 0} tone="text-neon-coral" inverse />
            <ThreatCard label="Habitat degradation" value={100 - (selectedRegion?.waterQuality ?? 0)} tone="text-goldenrod" inverse />
            <ThreatCard label="Invasive species watch" value={clamp(aiSignals.anomalyScore, 0, 100)} tone="text-cyan" inverse />
          </div>
        </GlassCard>

        <GlassCard className="h-full">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xl font-bold text-text-primary">Actionable AI Insight</h4>
              <p className="mt-1 text-sm text-text-secondary">Priority guidance based on the current biodiversity snapshot.</p>
            </div>
            <Target size={18} className="text-bioluminescent" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-text-primary">Suggested next action</p>
            <p className="mt-2 text-sm text-text-secondary">{aiSignals.prediction}</p>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-text-primary">Current bottleneck</p>
            <p className="mt-2 text-sm text-text-secondary">
              {selectedRegion
                ? `${formatRegionDisplayName(selectedRegion.region)} is carrying the strongest live pressure signal. Focus on temperature mitigation, pollutant reduction, and threatened-species coverage there first.`
                : 'Select a region to view the strongest live pressure signal.'}
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function HealthBar({
  label,
  value,
  tone,
  icon,
  inverted = false,
}: {
  label: string;
  value: number;
  tone: string;
  icon?: React.ReactNode;
  inverted?: boolean;
}) {
  const percent = clamp(value, 0, 100);
  const fill = inverted ? 100 - percent : percent;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          {icon}
          {label}
        </span>
        <span className={`text-sm font-semibold ${tone}`}>{percent.toFixed(1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan via-bioluminescent to-seafoam" style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function ThreatCard({
  label,
  value,
  tone,
  inverse = false,
}: {
  label: string;
  value: number;
  tone: string;
  inverse?: boolean;
}) {
  const intensity = clamp(inverse ? 100 - value : value, 0, 100);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{intensity.toFixed(1)}%</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan via-bioluminescent to-seafoam" style={{ width: `${intensity}%` }} />
      </div>
    </div>
  );
}

function SummaryBullet({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <p className="text-sm font-semibold text-text-primary">{label}</p>
      <p className="mt-2 text-sm text-text-secondary">{value}</p>
    </div>
  );
}
