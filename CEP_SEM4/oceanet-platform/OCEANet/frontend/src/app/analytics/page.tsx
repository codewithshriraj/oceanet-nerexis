'use client';

import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { GlassCard } from '@/components/Cards';
import { FloatingParticles } from '@/components/Animations';
import DatieTrustPanel from '@/components/DatieTrustPanel';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
  Label,
  Legend,
} from 'recharts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLngExpression, LeafletMouseEvent, Map as LeafletMap, LayerGroup } from 'leaflet';
import { apiFetch } from '@/utils/api';

const BiodiversityIntelligencePage = dynamic(() => import('@/app/biodiversity/page'), {
  loading: () => <div className="glass rounded-lg p-6 text-sm text-text-secondary">Loading biodiversity intelligence...</div>,
});

const BiodiversityIntelligencePanel = dynamic(() => import('@/components/BiodiversityIntelligencePanel'), {
  loading: () => <div className="glass rounded-lg p-6 text-sm text-text-secondary">Loading biodiversity analytics...</div>,
});

type SpeciesDistribution = { name: string; value: number };
type SpeciesCount = { name: string; count: number };
type EcosystemRegion = {
  region: string;
  risk: number;
  status: string;
  observation_count: number;
  lat: number;
  lng: number;
};
type MonthlyRisk = {
  month: string;
  risk: number;
  status: string;
  sst_c?: number | null;
  wave_height_m?: number | null;
  salinity_psu?: number | null;
  current_velocity_mps?: number | null;
  tide_height_m?: number | null;
};
type ForecastPoint = MonthlyRisk;
type HeatmapPoint = { region: string; lat: number; lng: number; weight: number };
type GeoLabelKind = 'ocean' | 'continent' | 'country';
type GeoLabel = { name: string; lat: number; lng: number; kind: GeoLabelKind };

type AnalyticsSummary = {
  generated_at: string;
  totals: {
    reports: number;
    datasets?: number;
    regions: number;
    types: number;
    users: number;
  };
  species_distribution: SpeciesDistribution[];
  species_counts: SpeciesCount[];
  ecosystem_health: EcosystemRegion[];
  monthly_risk_trend: MonthlyRisk[];
  heatmap_points: HeatmapPoint[];
  domain_coverage?: {
    oceanographic_datasets: number;
    biodiversity_datasets: number;
    environmental_datasets: number;
    community_datasets: number;
    resource_datasets: number;
  };
  live_source_counts?: {
    open_meteo: number;
    noaa: number;
    nasa: number;
    gbif: number;
    inaturalist: number;
    obis: number;
  };
  region_analytics?: Array<{
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
  }>;
  biodiversity_analytics?: {
    top_species: Array<{ name: string; count: number }>;
    regions: Array<{
      region: string;
      species_count: number;
      observation_count: number;
      stress_index: number | null;
      top_species: Array<{ name: string; count: number }>;
    }>;
    total_species_observations: number;
    total_unique_species: number;
    biodiversity_score?: number;
    resilience_score?: number;
  };
  hotspot_intelligence?: Array<{
    region: string;
    severity: number;
    status: string;
    hotspot_type: string;
    cause: string;
    observation_count: number;
    lat: number;
    lng: number;
    latest_observed_at?: string | null;
    risk_basis?: string;
    risk_confidence?: string;
    drivers?: string[];
    metric_coverage_ratio?: number;
  }>;
  coastal_forecasting?: {
    window_months: number;
    monthly_risk_trend: MonthlyRisk[];
    region_forecasts: Array<{
      region: string;
      sst_c?: number | null;
      wave_height_m?: number | null;
      salinity_psu?: number | null;
      current_velocity_mps?: number | null;
      tide_height_m?: number | null;
      stress_index?: number | null;
    }>;
  };
  data_freshness?: {
    latest_observed_at?: string | null;
    oldest_observed_at?: string | null;
    refresh_interval_seconds?: number;
    monitored_regions_total?: number;
    monitored_regions_with_live_metrics?: number;
  };
  metric_definitions?: Record<string, string>;
};

type ForecastApiResponse = {
  generated_at: string;
  region: string;
  horizon_days: number;
  model: string;
  observed_points: Record<string, number>;
  timeline: Array<{
    hour_index: number;
    sst_c: number | null;
    wave_height_m: number | null;
    current_velocity_mps: number | null;
    tide_height_m: number | null;
  }>;
};

type EnrichedSpeciesResponse = {
  generated_at: string;
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
  generated_at: string;
  source: string;
  group_count: number;
  species_count: number;
  total_observations: number;
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
  coverage_note?: string;
};

type LiveFeedStatus = {
  name: string;
  status: string;
  source_url?: string;
};

type UnifiedPlatformSnapshot = {
  generated_at: string;
  platform_scorecard: {
    platform_score: number;
    maturity_tier: string;
    multimodal_balance_score: number;
    live_metric_coverage_pct: number;
    ingestion_quality_pct: number;
    prediction_stability_pct: number;
  };
  capability_kpis: {
    regions_monitored: number;
    high_risk_regions: number;
    datasets_connected: number;
    reports_generated: number;
    active_users: number;
  };
  business_impact: {
    decision_readiness: string;
    esg_alignment: string;
    risk_outlook: string;
    resume_signal: string;
  };
};

type NewsSummaryLite = {
  external_sources?: LiveFeedStatus[];
};

const TAB_KEYS = ['overview', 'ecosystem-health', 'biodiversity-intelligence', 'coastal-forecasting', 'climate-correlation', 'ai-workspace'] as const;

type ModelStatus = 'IDLE' | 'RUNNING' | 'COMPLETED';
type MLModel = {
  id: string;
  name: string;
  tag: string;
  description: string;
  status: ModelStatus;
  progress: number;
  lastRun: string;
};

type PredictionResult = {
  id: string;
  icon: string;
  title: string;
  cluster: string | null;
  body: string;
  confidence: number | null;
  actions: string[];
};

type MLWorkspaceData = {
  generated_at: string;
  models: MLModel[];
  prediction_results: PredictionResult[];
  datasets: Array<{ id: number; name: string; source: string }>;
};

const COLORS = {
  healthy: 'var(--color-seafoam)',
  moderate: 'var(--color-goldenrod)',
  high: 'var(--color-neon-coral)',
};

const PIE_COLORS = [
  'var(--color-bioluminescent)',
  'var(--color-seafoam)',
  'var(--color-electric-violet)',
  'var(--color-goldenrod)',
  'var(--color-neon-coral-alt)',
  'var(--color-primary)',
];

const OCEAN_LABELS: GeoLabel[] = [
  { name: 'Pacific Ocean', lat: 2, lng: -155, kind: 'ocean' },
  { name: 'Atlantic Ocean', lat: 14, lng: -35, kind: 'ocean' },
  { name: 'Indian Ocean', lat: -18, lng: 82, kind: 'ocean' },
  { name: 'Southern Ocean', lat: -56, lng: 24, kind: 'ocean' },
  { name: 'Arctic Ocean', lat: 74, lng: 0, kind: 'ocean' },
];

const CONTINENT_LABELS: GeoLabel[] = [
  { name: 'North America', lat: 48, lng: -104, kind: 'continent' },
  { name: 'South America', lat: -19, lng: -60, kind: 'continent' },
  { name: 'Europe', lat: 53, lng: 16, kind: 'continent' },
  { name: 'Africa', lat: 5, lng: 21, kind: 'continent' },
  { name: 'Asia', lat: 37, lng: 96, kind: 'continent' },
  { name: 'Australia', lat: -25, lng: 134, kind: 'continent' },
  { name: 'Antarctica', lat: -77, lng: 0, kind: 'continent' },
];

const COUNTRY_LABELS: GeoLabel[] = [
  { name: 'United States', lat: 38, lng: -97, kind: 'country' },
  { name: 'Canada', lat: 57, lng: -106, kind: 'country' },
  { name: 'Brazil', lat: -13, lng: -53, kind: 'country' },
  { name: 'United Kingdom', lat: 54, lng: -2, kind: 'country' },
  { name: 'India', lat: 22, lng: 79, kind: 'country' },
  { name: 'Japan', lat: 36, lng: 138, kind: 'country' },
  { name: 'Indonesia', lat: -2, lng: 118, kind: 'country' },
  { name: 'Australia', lat: -26, lng: 133, kind: 'country' },
  { name: 'South Africa', lat: -30, lng: 24, kind: 'country' },
  { name: 'Chile', lat: -35, lng: -71, kind: 'country' },
];

const BASE_GEO_LABELS: GeoLabel[] = [...OCEAN_LABELS, ...CONTINENT_LABELS, ...COUNTRY_LABELS];

const getRiskColor = (risk: number) => {
  if (risk < 40) return COLORS.healthy;
  if (risk < 70) return COLORS.moderate;
  return COLORS.high;
};

const getRiskStatus = (risk: number) => {
  if (risk < 40) return 'Low Risk';
  if (risk < 70) return 'Medium Risk';
  return 'High Risk';
};

const getMapRiskColor = (risk: number) => {
  if (risk < 40) return '#16a34a';
  if (risk < 70) return '#d97706';
  return '#dc2626';
};

const getRiskTier = (risk: number) => {
  if (risk < 40) return 'Low Risk';
  if (risk < 70) return 'Medium Risk';
  return 'Critical Risk';
};

const getSignalStrength = (risk: number) => {
  if (risk < 30) return 'Low';
  if (risk < 50) return 'Rising';
  if (risk < 70) return 'Medium';
  if (risk < 85) return 'High';
  return 'Very High';
};

const getLabelColor = (kind: GeoLabelKind) => {
  if (kind === 'ocean') return 'var(--color-bioluminescent)';
  if (kind === 'continent') return 'var(--color-electric-violet)';
  return 'var(--color-goldenrod)';
};

function MarineHeatmap({ points }: { points: HeatmapPoint[] }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlayLayerRef = useRef<LayerGroup | null>(null);
  const lastAutoFitKeyRef = useRef<string>('');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(2);
  const [selectedRegion, setSelectedRegion] = useState<HeatmapPoint | null>(null);

  const sortedPoints = useMemo(() => [...points].sort((a, b) => b.weight - a.weight), [points]);
  const pointsKey = useMemo(
    () => sortedPoints.map((point) => `${point.region}:${point.lat}:${point.lng}:${point.weight}`).join('|'),
    [sortedPoints]
  );

  const riskDistribution = useMemo(() => {
    const baseline = { low: 0, moderate: 0, high: 0 };
    if (!sortedPoints.length) return baseline;

    return sortedPoints.reduce(
      (acc, point) => {
        if (point.weight < 40) acc.low += 1;
        else if (point.weight < 70) acc.moderate += 1;
        else acc.high += 1;
        return acc;
      },
      { ...baseline }
    );
  }, [sortedPoints]);

  const averageRisk = useMemo(() => {
    if (!sortedPoints.length) return 0;
    const total = sortedPoints.reduce((sum, point) => sum + point.weight, 0);
    return Math.round((total / sortedPoints.length) * 10) / 10;
  }, [sortedPoints]);

  const hotspotCoverage = useMemo(() => {
    if (!sortedPoints.length) return 0;
    const highCount = sortedPoints.filter((point) => point.weight >= 70).length;
    return Math.round((highCount / sortedPoints.length) * 100);
  }, [sortedPoints]);

  useEffect(() => {
    if (!sortedPoints.length) {
      setSelectedRegion(null);
      return;
    }

    if (!selectedRegion || !sortedPoints.some((point) => point.region === selectedRegion.region)) {
      setSelectedRegion(sortedPoints[0]);
    }
  }, [selectedRegion, sortedPoints]);

  useEffect(() => {
    let cancelled = false;

    const initLeaflet = async () => {
      try {
        if (!mapContainerRef.current || mapRef.current) return;

        const L = await import('leaflet');

        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: true,
          worldCopyJump: true,
          preferCanvas: true,
          wheelDebounceTime: 20,
          wheelPxPerZoomLevel: 45,
          inertia: false,
        }).setView([18, 0], 2);

        map.on('zoomend', () => {
          setMapZoom(map.getZoom());
        });

        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          maxZoom: 19,
        }).addTo(map);

        overlayLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        if (!cancelled) {
          setMapReady(true);
          setMapZoom(map.getZoom());
          setMapError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : 'Unable to load OpenStreetMap layer.');
        }
      }
    };

    initLeaflet();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        overlayLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !overlayLayerRef.current) return;

    const drawLayers = async () => {
      try {
        const L = await import('leaflet');
        const dynamicCountryLabels: GeoLabel[] = sortedPoints.slice(0, 8).map((point) => ({
          name: point.region,
          lat: point.lat,
          lng: point.lng,
          kind: 'country' as const,
        }));

        const baseLabelsByZoom =
          mapZoom <= 2
            ? [...OCEAN_LABELS, ...CONTINENT_LABELS.filter((label) => label.name !== 'Antarctica')]
            : mapZoom <= 3
              ? [...OCEAN_LABELS, ...CONTINENT_LABELS]
              : [...BASE_GEO_LABELS];

        const geoLabels = [...baseLabelsByZoom, ...dynamicCountryLabels];

        const createLabelIcon = (label: string, kind: GeoLabelKind, important = false) =>
          L.divIcon({
            className: '',
            iconSize: [0, 0],
            html: `<div style="
              white-space: nowrap;
              color: ${getLabelColor(kind)};
              background: rgba(11, 26, 47, 0.72);
              border: 1px solid rgba(255, 255, 255, 0.18);
              border-radius: 999px;
              padding: ${important ? '3px 10px' : '2px 8px'};
              font-size: ${kind === 'country' ? '10px' : '11px'};
              font-weight: ${important ? 700 : 600};
              letter-spacing: 0.25px;
              backdrop-filter: blur(2px);
              text-transform: ${kind === 'continent' ? 'uppercase' : 'none'};
            ">${label}</div>`,
          });

        overlayLayerRef.current?.clearLayers();

        geoLabels.forEach((label) => {
          L.marker([label.lat, label.lng], {
            icon: createLabelIcon(label.name, label.kind, label.kind !== 'country'),
            interactive: false,
            keyboard: false,
          }).addTo(overlayLayerRef.current as LayerGroup);
        });

        if (!sortedPoints.length) return;

        const bounds = L.latLngBounds(sortedPoints.map((point) => [point.lat, point.lng] as LatLngExpression));

        sortedPoints.forEach((point, index) => {
          const color = getMapRiskColor(point.weight);
          const coreRadius = 45000 + point.weight * 5000;
          const glowRadius = coreRadius * 1.85;
          const hotspotId = `H${String(index + 1).padStart(2, '0')}`;

          L.circle([point.lat, point.lng], {
            radius: glowRadius,
            fillColor: color,
            fillOpacity: 0.12,
            stroke: false,
          }).addTo(overlayLayerRef.current as LayerGroup);

          const primaryCircle = L.circle([point.lat, point.lng], {
            radius: coreRadius,
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.28,
          }).addTo(overlayLayerRef.current as LayerGroup);

          L.circleMarker([point.lat, point.lng], {
            radius: Math.max(7, Math.round(point.weight / 8)),
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.9,
          })
            .bindTooltip(`${hotspotId} · ${point.region} · ${point.weight}%`, {
              direction: 'top',
              offset: [0, -8],
              opacity: 0.95,
            })
            .addTo(overlayLayerRef.current as LayerGroup);

          if (index < 8) {
            L.marker([point.lat, point.lng], {
              icon: L.divIcon({
                className: '',
                iconSize: [0, 0],
                html: `<div style="
                  transform: translateY(-18px);
                  background: rgba(11, 26, 47, 0.85);
                  border: 1px solid rgba(255,255,255,0.22);
                  border-radius: 8px;
                  color: #e2f8f5;
                  font-size: 10px;
                  font-weight: 700;
                  letter-spacing: 0.3px;
                  padding: 1px 5px;
                  white-space: nowrap;
                ">${hotspotId}</div>`,
              }),
              interactive: false,
              keyboard: false,
            }).addTo(overlayLayerRef.current as LayerGroup);
          }

          primaryCircle.bindPopup(
            `<strong>${hotspotId} · ${point.region}</strong><br/>Risk: ${point.weight}% (${getRiskTier(point.weight)})<br/>Signal: ${getSignalStrength(point.weight)}<br/>Lat: ${point.lat.toFixed(3)}<br/>Lng: ${point.lng.toFixed(3)}`
          );

          primaryCircle.on('click', (event: LeafletMouseEvent) => {
            setSelectedRegion(point);
            mapRef.current?.panTo(event.latlng);
          });
        });

        const shouldAutoFit = lastAutoFitKeyRef.current !== pointsKey;
        if (shouldAutoFit) {
          lastAutoFitKeyRef.current = pointsKey;
          if (sortedPoints.length === 1) {
            mapRef.current.setView([sortedPoints[0].lat, sortedPoints[0].lng], 4);
          } else {
            mapRef.current.fitBounds(bounds.pad(0.3));
          }
        }
      } catch (err) {
        setMapError(err instanceof Error ? err.message : 'Unable to render OSM heat layer.');
      }
    };

    drawLayers();
  }, [mapReady, mapZoom, pointsKey, sortedPoints]);

  if (!points.length) {
    return (
      <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 p-4 text-sm text-text-secondary">
        No regional points available yet. Ingest live datasets to populate the heatmap.
      </div>
    );
  }

  const selectedInsight = selectedRegion || sortedPoints[0] || null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 p-2 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-[380px] rounded-lg" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-4 py-3">
          <p className="text-xs text-text-secondary">Average Risk Signal</p>
          <p className="text-xl font-semibold text-text-primary">{averageRisk}%</p>
        </div>
        <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-4 py-3">
          <p className="text-xs text-text-secondary">Critical Hotspot Share</p>
          <p className="text-xl font-semibold text-neon-coral">{hotspotCoverage}%</p>
        </div>
        <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-4 py-3">
          <p className="text-xs text-text-secondary">Low / Moderate / Critical</p>
          <p className="text-base font-semibold text-text-primary">
            {riskDistribution.low} / {riskDistribution.moderate} / {riskDistribution.high}
          </p>
        </div>
        <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-4 py-3">
          <p className="text-xs text-text-secondary">Total Monitored Points</p>
          <p className="text-xl font-semibold text-bioluminescent">{sortedPoints.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-3">
        <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-text-secondary mb-2">Focused Hotspot Intelligence</p>
          {selectedInsight ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-text-primary">
                  {`H${String(sortedPoints.findIndex((point) => point.region === selectedInsight.region) + 1).padStart(2, '0')}`} · {selectedInsight.region}
                </p>
                <span className="text-sm font-semibold" style={{ color: getRiskColor(selectedInsight.weight) }}>
                  {selectedInsight.weight}% · {getRiskTier(selectedInsight.weight)}
                </span>
              </div>
              <p className="text-sm text-text-secondary">{getSignalStrength(selectedInsight.weight)} based on current report density and severity clustering.</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-md bg-white bg-opacity-5 border border-white border-opacity-10 px-3 py-2">
                  <p className="text-xs text-text-secondary">Latitude</p>
                  <p className="text-sm font-medium text-text-primary">{selectedInsight.lat.toFixed(3)}</p>
                </div>
                <div className="rounded-md bg-white bg-opacity-5 border border-white border-opacity-10 px-3 py-2">
                  <p className="text-xs text-text-secondary">Longitude</p>
                  <p className="text-sm font-medium text-text-primary">{selectedInsight.lng.toFixed(3)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Select a hotspot on the map to view detailed intelligence.</p>
          )}
        </div>

        <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-text-secondary mb-3">Top Priority Hotspots</p>
          <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
            {sortedPoints.slice(0, 8).map((point, index) => (
              <button
                key={`${point.region}-${point.lat}-${point.lng}`}
                onClick={() => {
                  setSelectedRegion(point);
                  mapRef.current?.flyTo([point.lat, point.lng], 4, { duration: 0.35 });
                }}
                className="w-full text-left rounded-md border border-white border-opacity-10 bg-white bg-opacity-5 hover:bg-opacity-10 transition px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-text-primary">H{String(index + 1).padStart(2, '0')} · {point.region}</p>
                  <span className="text-sm font-semibold" style={{ color: getRiskColor(point.weight) }}>
                    {point.weight}%
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{getSignalStrength(point.weight)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Marine Risk Gradient</span>
          <span>Low → Moderate → Critical</span>
        </div>
        <div
          className="h-2.5 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, #16a34a 0%, #d97706 52%, #dc2626 100%)',
          }}
        />
        <p className="text-xs text-text-secondary">
          Labels include oceans, continents, countries, and top live hotspot regions from your current dataset.
        </p>
        <p className="text-xs text-text-secondary">
          Dot IDs (`H01`, `H02`, ...) map directly to the Top Priority list and popups for fast hotspot identification.
        </p>
      </div>

      {mapError && <p className="text-sm text-neon-coral">{mapError}</p>}
      {!mapError && !mapReady && <p className="text-sm text-text-secondary">Loading OpenStreetMap heat layer...</p>}
    </div>
  );
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<(typeof TAB_KEYS)[number]>('overview');
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeWindow, setTimeWindow] = useState<3 | 6 | 12>(6);
  const [healthSort, setHealthSort] = useState<'risk' | 'observations'>('risk');
  const [liveFeeds, setLiveFeeds] = useState<LiveFeedStatus[]>([]);
  const [mlModels, setMlModels] = useState<MLModel[]>([]);
  const [mlWorkspace, setMlWorkspace] = useState<MLWorkspaceData | null>(null);
  const [activeDataset, setActiveDataset] = useState('');
  const [mlLoading, setMlLoading] = useState(false);
  const [minSeverityFilter, setMinSeverityFilter] = useState<0 | 40 | 70>(40);
  const [hotspotTypeFilter, setHotspotTypeFilter] = useState<string>('all');
  const [hotspotWindowDays, setHotspotWindowDays] = useState<30 | 90 | 365>(90);
  const [forecastRegion, setForecastRegion] = useState<string>('Global');
  const [forecastData, setForecastData] = useState<ForecastApiResponse | null>(null);
  const [speciesEnriched, setSpeciesEnriched] = useState<EnrichedSpeciesResponse | null>(null);
  const [globalBiodiversityCatalog, setGlobalBiodiversityCatalog] = useState<GlobalBiodiversityCatalogResponse | null>(null);
  const [unifiedSnapshot, setUnifiedSnapshot] = useState<UnifiedPlatformSnapshot | null>(null);
  const isSummaryFetchInFlight = useRef(false);

  const fetchSummary = useCallback(async (manual = false) => {
    if (isSummaryFetchInFlight.current) return;
    isSummaryFetchInFlight.current = true;
    if (manual) setRefreshing(true);

    try {
      const analyticsResponse = await apiFetch('/_legacy/analytics/summary', {
        cache: 'no-store',
        timeoutMs: 20000,
        retryOnTimeout: false,
        dedupeGetMs: 3000,
      });

      if (!analyticsResponse.ok) {
        const statusCode = analyticsResponse.status;
        throw new Error(`Failed to load analytics (${statusCode})`);
      }

      const payload: AnalyticsSummary = await analyticsResponse.json();
      setData(payload);
      try {
        window.localStorage.setItem('nerexis.analytics.summary', JSON.stringify(payload));
      } catch {
      }

      // Non-critical call: update when ready, but do not block primary analytics render.
      void apiFetch('/platform/unified-snapshot', { cache: 'no-store', timeoutMs: 7000 })
        .then(async (response) => {
          if (!response.ok) return;
          const platformPayload: UnifiedPlatformSnapshot = await response.json();
          setUnifiedSnapshot(platformPayload);
        })
        .catch(() => {});

      setError(null);
    } catch (err) {
      if (data) {
        setError('Live sync delayed. Showing last successful analytics snapshot.');
      } else {
        let restored = false;
        try {
          const cached = window.localStorage.getItem('nerexis.analytics.summary');
          if (cached) {
            const parsed = JSON.parse(cached) as AnalyticsSummary;
            setData(parsed);
            restored = true;
          }
        } catch {
        }
        setError(restored ? 'Live sync delayed. Showing cached analytics snapshot.' : (err instanceof Error ? err.message : 'Unable to fetch analytics'));
      }
    } finally {
      isSummaryFetchInFlight.current = false;
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = window.setInterval(() => fetchSummary(), 30000);
    return () => {
      window.clearInterval(interval);
    };
  }, [fetchSummary]);

  useEffect(() => {
    let cancelled = false;

    const fetchFeedStatus = async () => {
      try {
        const response = await apiFetch('/_legacy/news/summary', { cache: 'no-store', timeoutMs: 10000, retryOnTimeout: false });
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

  useEffect(() => {
    let cancelled = false;

    const loadForecast = async () => {
      if (activeTab !== 'coastal-forecasting') return;
      try {
        const queryRegion = forecastRegion === 'Global' ? '' : `&region=${encodeURIComponent(forecastRegion)}`;
        const response = await apiFetch(`/_legacy/analytics/forecast?horizon_days=3${queryRegion}`, { cache: 'no-store', timeoutMs: 25000, retryOnTimeout: false });
        if (!response.ok) return;
        const payload: ForecastApiResponse = await response.json();
        if (!cancelled) setForecastData(payload);
      } catch {
      }
    };

    loadForecast();
    return () => {
      cancelled = true;
    };
  }, [forecastRegion, activeTab]);

  useEffect(() => {
    let cancelled = false;
    if (activeTab !== 'biodiversity-intelligence') return;

    const loadBiodiversityDetails = async () => {
      try {
        const [enrichedRes, catalogRes] = await Promise.allSettled([
          apiFetch('/_legacy/biodiversity/species/enriched?limit=20', {
            cache: 'no-store',
            timeoutMs: 22000,
            retryOnTimeout: false,
            allowLocalFallback: true,
            dedupeGetMs: 4000,
          }),
          apiFetch('/_legacy/biodiversity/species/global-catalog?limit_per_group=20&max_species=140', {
            cache: 'no-store',
            timeoutMs: 25000,
            retryOnTimeout: false,
            allowLocalFallback: true,
            dedupeGetMs: 4000,
          }),
        ]);

        let enrichedCount = 0;
        let catalogCount = 0;

        if (!cancelled && enrichedRes.status === 'fulfilled' && enrichedRes.value.ok) {
          const payload: EnrichedSpeciesResponse = await enrichedRes.value.json();
          enrichedCount = Number(payload.species_count || 0);
          if ((payload.species_count || 0) > 0) {
            setSpeciesEnriched(payload);
          }
        }

        if (!cancelled && catalogRes.status === 'fulfilled' && catalogRes.value.ok) {
          const payload: GlobalBiodiversityCatalogResponse = await catalogRes.value.json();
          catalogCount = Number(payload.species_count || 0);
          if ((payload.species_count || 0) > 0) {
            setGlobalBiodiversityCatalog(payload);
          }
        }

        const needsEnrichedRetry =
          enrichedRes.status !== 'fulfilled' ||
          !enrichedRes.value.ok ||
          enrichedCount <= 0;
        const needsCatalogRetry =
          catalogRes.status !== 'fulfilled' ||
          !catalogRes.value.ok ||
          catalogCount <= 0;

        if (!cancelled && needsEnrichedRetry) {
          const retryEnriched = await apiFetch('/_legacy/biodiversity/species/enriched?limit=10', {
            cache: 'no-store',
            timeoutMs: 30000,
            retryOnTimeout: false,
            allowLocalFallback: true,
            dedupeGetMs: 4000,
          });
          if (retryEnriched.ok) {
            const payload: EnrichedSpeciesResponse = await retryEnriched.json();
            if ((payload.species_count || 0) > 0) {
              setSpeciesEnriched(payload);
            }
          }
        }

        if (!cancelled && needsCatalogRetry) {
          const retryCatalog = await apiFetch('/_legacy/biodiversity/species/global-catalog?limit_per_group=12&max_species=90', {
            cache: 'no-store',
            timeoutMs: 32000,
            retryOnTimeout: false,
            allowLocalFallback: true,
            dedupeGetMs: 4000,
          });
          if (retryCatalog.ok) {
            const payload: GlobalBiodiversityCatalogResponse = await retryCatalog.json();
            if ((payload.species_count || 0) > 0) {
              setGlobalBiodiversityCatalog(payload);
            }
          }
        }
      } catch {
      }
    };

    loadBiodiversityDetails();
    const interval = window.setInterval(loadBiodiversityDetails, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeTab]);

  // ─── ML Workspace: fetch on mount, every 6 hours, and poll when RUNNING ──
  const fetchMLWorkspace = useCallback(async () => {
    try {
      const response = await apiFetch('/analytics/ml-workspace', { cache: 'no-store' });
      if (!response.ok) return;
      const payload: MLWorkspaceData = await response.json();
      setMlWorkspace(payload);
      setMlModels(payload.models);
      if (!activeDataset && payload.datasets.length > 0) {
        setActiveDataset(payload.datasets[0].name);
      }
    } catch {
      // silently ignore — live data will appear on retry
    } finally {
      setMlLoading(false);
    }
  }, [activeDataset]);

  useEffect(() => {
    setMlLoading(true);
    fetchMLWorkspace();
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const interval = window.setInterval(fetchMLWorkspace, SIX_HOURS_MS);
    return () => window.clearInterval(interval);
  }, [fetchMLWorkspace]);

  // Fast polling while any model is running
  useEffect(() => {
    const anyRunning = mlModels.some((m) => m.status === 'RUNNING');
    if (!anyRunning) return;
    const poll = window.setInterval(fetchMLWorkspace, 5000);
    return () => window.clearInterval(poll);
  }, [mlModels, fetchMLWorkspace]);

  const handleMLAction = useCallback(async (modelId: string, action: 'start' | 'stop') => {
    // Optimistic update
    setMlModels((prev) =>
      prev.map((m) => {
        if (m.id !== modelId) return m;
        if (action === 'stop') return { ...m, status: 'IDLE' as ModelStatus, progress: 0, lastRun: 'Stopped' };
        return { ...m, status: 'RUNNING' as ModelStatus, progress: 0, lastRun: 'Running...' };
      })
    );
    try {
      await apiFetch(`/analytics/ml-workspace/${modelId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      // Refresh workspace state after ~1s to get authoritative status
      setTimeout(fetchMLWorkspace, 1200);
    } catch {
      // Revert optimistic update on error
      fetchMLWorkspace();
    }
  }, [fetchMLWorkspace]);

  const handleResultAction = useCallback(async (resultId: string, action: string) => {
    const d = new Date().toISOString().slice(0, 10);
    const exportMap: Record<string, { endpoint: string; filename: string }> = {
      rf:     { endpoint: '/analytics/export/rf-report',       filename: `rf-species-report-${d}.json` },
      km:     { endpoint: '/analytics/export/km-clusters',     filename: `km-clusters-${d}.json` },
      ts:     { endpoint: '/analytics/export/ts-forecast',     filename: `ts-sst-forecast-${d}.csv` },
      iso:    { endpoint: '/analytics/export/iso-anomalies',   filename: `iso-anomalies-${d}.csv` },
      gbr:    { endpoint: '/analytics/export/gbr-stress',      filename: `gbr-stress-${d}.json` },
      pca:    { endpoint: '/analytics/export/pca-factors',     filename: `pca-factors-${d}.json` },
      dbscan: { endpoint: '/analytics/export/dbscan-clusters', filename: `dbscan-clusters-${d}.csv` },
      lr:     { endpoint: '/analytics/export/lr-risk',         filename: `lr-risk-${d}.json` },
      svr:    { endpoint: '/analytics/export/svr-tide',        filename: `svr-tide-forecast-${d}.csv` },
    };

    const downloadFromEndpoint = async (endpoint: string, filename: string) => {
      try {
        const res = await apiFetch(endpoint, { timeoutMs: 30000 });
        if (!res.ok) throw new Error(`Export failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      } catch { /* silently swallow */ }
    };

    // Navigation actions
    if (action === 'View Species Map' || action === 'View on Map') { setActiveTab('ecosystem-health'); return; }
    if (action === 'View Forecast') { setActiveTab('coastal-forecasting'); return; }
    if (action === 'View Anomaly Chart' || action === 'View Stress Map' || action === 'View Risk Map') { setActiveTab('ecosystem-health'); return; }
    if (action === 'View Factor Chart') { setActiveTab('climate-correlation'); return; }

    // Export actions — route by resultId
    const exp = exportMap[resultId];
    if (exp) await downloadFromEndpoint(exp.endpoint, exp.filename);
  }, [setActiveTab]);

  const averageRisk = useMemo(() => {
    if (!data?.ecosystem_health?.length) return 0;
    const total = data.ecosystem_health.reduce((sum, entry) => sum + entry.risk, 0);
    return Math.round(total / data.ecosystem_health.length);
  }, [data]);

  const speciesDistribution = data?.species_distribution || [];
  const speciesCounts = data?.species_counts || [];
  const ecosystemHealth = data?.ecosystem_health || [];
  const monthlyRiskTrend = data?.monthly_risk_trend || [];
  const heatmapPoints = data?.heatmap_points || [];
  const filteredTrend = useMemo(() => monthlyRiskTrend.slice(-timeWindow), [monthlyRiskTrend, timeWindow]);
  // Prepare decomposed trend lines for SST, wave, salinity, current, and risk
  const chartTrend = useMemo(() => {
    return filteredTrend.map((point) => ({
      month: point.month,
      risk: point.risk,
      status: point.status,
      sst: point.sst_c ?? null,
      wave: point.wave_height_m ?? null,
      salinity: point.salinity_psu ?? null,
      current: point.current_velocity_mps ?? null,
    }));
  }, [filteredTrend]);
  const riskDelta = useMemo(() => {
    if (filteredTrend.length < 2) return 0;
    return Math.round((filteredTrend[filteredTrend.length - 1].risk - filteredTrend[0].risk) * 10) / 10;
  }, [filteredTrend]);

  const sortedEcosystemHealth = useMemo(() => {
    const list = [...ecosystemHealth];
    if (healthSort === 'observations') {
      return list.sort((a, b) => {
        if (b.observation_count !== a.observation_count) return b.observation_count - a.observation_count;
        return b.risk - a.risk;
      });
    }
    return list.sort((a, b) => {
      if (b.risk !== a.risk) return b.risk - a.risk;
      return b.observation_count - a.observation_count;
    });
  }, [ecosystemHealth, healthSort]);

  const maxObservationCount = useMemo(
    () => Math.max(1, ...ecosystemHealth.map((entry) => entry.observation_count || 0)),
    [ecosystemHealth]
  );

  const highestRiskRegion = ecosystemHealth.length
    ? ecosystemHealth.reduce((highest, current) => (current.risk > highest.risk ? current : highest), ecosystemHealth[0])
    : null;

  const lowRiskCount = ecosystemHealth.filter((entry) => entry.risk < 40).length;
  const highRiskCount = ecosystemHealth.filter((entry) => entry.risk >= 70).length;
  const domainCoverage = data?.domain_coverage;
  const liveSourceCounts = data?.live_source_counts;
  const regionAnalytics = data?.region_analytics || [];
  const biodiversityAnalytics = data?.biodiversity_analytics;
  const hotspotIntelligence = data?.hotspot_intelligence || [];
  const coastalForecasting = data?.coastal_forecasting;
  const dataFreshness = data?.data_freshness;
  const metricDefinitions = data?.metric_definitions || {};
  const riskToRegionDensity = data?.totals.regions ? Math.round((averageRisk / data.totals.regions) * 10) / 10 : 0;
  const topBiodiversityRegions = (biodiversityAnalytics?.regions || []).slice(0, 6);
  const topSpecies = (biodiversityAnalytics?.top_species || []).slice(0, 8);
  const biodiversityObservationPerSpecies = useMemo(() => {
    const observations = biodiversityAnalytics?.total_species_observations || 0;
    const species = biodiversityAnalytics?.total_unique_species || 0;
    if (!species) return 0;
    return Math.round((observations / species) * 10) / 10;
  }, [biodiversityAnalytics]);
  const biodiversityRegionsWithStress = useMemo(
    () => topBiodiversityRegions.filter((region) => typeof region.stress_index === 'number').length,
    [topBiodiversityRegions]
  );
  const biodiversityAtRiskSpecies = useMemo(
    () => hotspotIntelligence.filter((item) => Number(item.severity || 0) >= 70).length,
    [hotspotIntelligence]
  );
  const biodiversitySpeciesChart = useMemo(() => {
    const total = Math.max(1, biodiversityAnalytics?.total_species_observations || 0);
    const topObservationTotal = topSpecies.reduce((sum, item) => sum + item.count, 0);

    const rows = topSpecies.map((item) => ({
      name: item.name,
      value: Math.max(0, Math.round((item.count / total) * 1000) / 10),
    }));

    if (total > topObservationTotal) {
      rows.push({
        name: 'Other species',
        value: Math.max(0, Math.round(((total - topObservationTotal) / total) * 1000) / 10),
      });
    }

    return rows.slice(0, 6);
  }, [biodiversityAnalytics?.total_species_observations, topSpecies]);
  const biodiversityRegionRanking = useMemo(() => {
    return topBiodiversityRegions
      .slice()
      .sort((a, b) => {
        const aStress = typeof a.stress_index === 'number' ? a.stress_index : -1;
        const bStress = typeof b.stress_index === 'number' ? b.stress_index : -1;
        if (bStress !== aStress) return bStress - aStress;
        if (b.species_count !== a.species_count) return b.species_count - a.species_count;
        return b.observation_count - a.observation_count;
      })
      .map((region, index) => ({
        ...region,
        rank: index + 1,
      }));
  }, [topBiodiversityRegions]);
  const oceanDatasets = domainCoverage?.oceanographic_datasets ?? 0;
  const biodiversityDatasets = domainCoverage?.biodiversity_datasets ?? 0;
  const domainTotal = Math.max(1, oceanDatasets + biodiversityDatasets);
  const oceanShare = Math.round((oceanDatasets / domainTotal) * 100);
  const biodiversityShare = Math.round((biodiversityDatasets / domainTotal) * 100);
  const biodiversityGap = Math.max(0, oceanDatasets - biodiversityDatasets);
  const liveFeedsUp = liveFeeds.filter((feed) => feed.status === 'ok').length;
  const regionalClimateCorrelation = useMemo(() => {
    const forecastByRegion = new Map<string, (typeof coastalForecasting.region_forecasts)[number]>();
    (coastalForecasting?.region_forecasts || []).forEach((row) => {
      if (!row?.region) return;
      forecastByRegion.set(String(row.region).toLowerCase(), row);
    });

    return regionAnalytics
      .map((region) => {
        const fallback = forecastByRegion.get(String(region.region || '').toLowerCase());
        const sst = region.avg_sst_c ?? fallback?.sst_c ?? null;
        const salinity = region.avg_salinity_psu ?? fallback?.salinity_psu ?? null;
        const wave = region.avg_wave_height_m ?? fallback?.wave_height_m ?? null;
        const current = region.avg_current_velocity_mps ?? fallback?.current_velocity_mps ?? null;

        return {
          region: region.region,
          stress: Number(region.stress_index || 0),
          sst,
          salinity,
          wave,
          current,
        };
      })
      .filter((row) => [row.sst, row.wave, row.salinity, row.current].some((v) => v != null))
      .sort((a, b) => b.stress - a.stress)
      .slice(0, 12);
  }, [regionAnalytics, coastalForecasting]);

  const hotspotTypeOptions = useMemo(() => {
    const options = new Set<string>();
    hotspotIntelligence.forEach((item) => {
      if (item.hotspot_type) options.add(item.hotspot_type);
    });
    return ['all', ...Array.from(options).sort()];
  }, [hotspotIntelligence]);

  const filteredHotspots = useMemo(() => {
    const now = Date.now();
    const maxAgeMs = hotspotWindowDays * 24 * 60 * 60 * 1000;

    return hotspotIntelligence.filter((item) => {
      if ((item.severity || 0) < minSeverityFilter) return false;
      if (hotspotTypeFilter !== 'all' && item.hotspot_type !== hotspotTypeFilter) return false;

      if (!item.latest_observed_at) return true;
      const ts = new Date(item.latest_observed_at).getTime();
      if (Number.isNaN(ts)) return true;
      return now - ts <= maxAgeMs;
    });
  }, [hotspotIntelligence, hotspotTypeFilter, hotspotWindowDays, minSeverityFilter]);

  const filteredHeatmapPoints = useMemo(() => {
    const allowed = new Set(filteredHotspots.map((item) => String(item.region || '').toLowerCase()));
    if (allowed.size === 0) return [] as HeatmapPoint[];
    return heatmapPoints.filter((point) => allowed.has(String(point.region || '').toLowerCase()));
  }, [filteredHotspots, heatmapPoints]);

  const forecastRegionOptions = useMemo(() => {
    const names = Array.from(new Set(regionAnalytics.map((item) => item.region))).sort();
    return ['Global', ...names];
  }, [regionAnalytics]);

  const coastalRows = useMemo(() => {
    const rows = (coastalForecasting?.region_forecasts || []).filter((row) => {
      return [row.sst_c, row.wave_height_m, row.salinity_psu, row.current_velocity_mps, row.tide_height_m].some(
        (value) => value !== null && value !== undefined
      );
    });
    return rows;
  }, [coastalForecasting]);

  const latestObservedText = useMemo(() => {
    const raw = dataFreshness?.latest_observed_at;
    if (!raw) return 'No live timestamp available yet';
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? String(raw) : parsed.toLocaleString();
  }, [dataFreshness]);

  const metricCoveragePercent = useMemo(() => {
    const total = dataFreshness?.monitored_regions_total || 0;
    const covered = dataFreshness?.monitored_regions_with_live_metrics || 0;
    if (!total) return 0;
    return Math.round((covered / total) * 100);
  }, [dataFreshness]);

  const criticalRegionShare = useMemo(() => {
    if (!ecosystemHealth.length) return 0;
    return Math.round((highRiskCount / ecosystemHealth.length) * 100);
  }, [ecosystemHealth.length, highRiskCount]);

  const stableRegionShare = useMemo(() => {
    if (!ecosystemHealth.length) return 0;
    return Math.round((lowRiskCount / ecosystemHealth.length) * 100);
  }, [ecosystemHealth.length, lowRiskCount]);

  const feedAvailabilityPercent = useMemo(() => {
    if (!liveFeeds.length) return 0;
    return Math.round((liveFeedsUp / liveFeeds.length) * 100);
  }, [liveFeeds.length, liveFeedsUp]);

  const domainBalanceScore = useMemo(() => {
    const top = Math.max(oceanDatasets, biodiversityDatasets);
    const bottom = Math.min(oceanDatasets, biodiversityDatasets);
    if (top <= 0) return 0;
    return Math.round((bottom / top) * 100);
  }, [biodiversityDatasets, oceanDatasets]);

  const riskVolatility = useMemo(() => {
    if (!ecosystemHealth.length) return 0;
    const mean = ecosystemHealth.reduce((sum, item) => sum + item.risk, 0) / ecosystemHealth.length;
    const variance = ecosystemHealth.reduce((sum, item) => sum + (item.risk - mean) ** 2, 0) / ecosystemHealth.length;
    return Math.round(Math.sqrt(variance));
  }, [ecosystemHealth]);

  const operationalReadinessScore = useMemo(() => {
    const blend = [
      metricCoveragePercent,
      feedAvailabilityPercent,
      domainBalanceScore,
      Math.max(0, 100 - averageRisk),
    ];
    return Math.round(blend.reduce((sum, value) => sum + value, 0) / blend.length);
  }, [averageRisk, domainBalanceScore, feedAvailabilityPercent, metricCoveragePercent]);

  const readinessBand =
    operationalReadinessScore >= 80 ? 'High Readiness' : operationalReadinessScore >= 55 ? 'Moderate Readiness' : 'Low Readiness';

  const platformScore = Math.round(unifiedSnapshot?.platform_scorecard?.platform_score || 0);
  const platformTier = unifiedSnapshot?.platform_scorecard?.maturity_tier || 'Operational';
  const platformReadiness = unifiedSnapshot?.business_impact?.decision_readiness || 'Moderate';
  const platformOutlook = unifiedSnapshot?.business_impact?.risk_outlook || 'Watch';

  const insightCards = [
    {
      label: 'Critical Regions',
      value: highRiskCount,
      helper: 'Require immediate interventions',
      color: COLORS.high,
    },
    {
      label: 'Stable Regions',
      value: lowRiskCount,
      helper: 'Maintaining healthy balance',
      color: COLORS.healthy,
    },
    {
      label: 'Trend Direction',
      value: `${riskDelta > 0 ? '+' : ''}${riskDelta}%`,
      helper: `${timeWindow}-month risk movement`,
      color: riskDelta > 0 ? COLORS.high : COLORS.healthy,
    },
  ];

  const detailedInsightCards = [
    {
      label: 'Operational Readiness',
      value: `${operationalReadinessScore}%`,
      helper: readinessBand,
      color: operationalReadinessScore >= 80 ? COLORS.healthy : operationalReadinessScore >= 55 ? COLORS.moderate : COLORS.high,
    },
    {
      label: 'Critical Region Share',
      value: `${criticalRegionShare}%`,
      helper: `${highRiskCount} of ${ecosystemHealth.length || 0} regions`,
      color: COLORS.high,
    },
    {
      label: 'Stable Region Share',
      value: `${stableRegionShare}%`,
      helper: `${lowRiskCount} of ${ecosystemHealth.length || 0} regions`,
      color: COLORS.healthy,
    },
    {
      label: 'Source Availability',
      value: `${feedAvailabilityPercent}%`,
      helper: `${liveFeedsUp}/${liveFeeds.length || 0} live feeds available`,
      color: feedAvailabilityPercent >= 70 ? COLORS.healthy : COLORS.moderate,
    },
    {
      label: 'Domain Balance',
      value: `${domainBalanceScore}%`,
      helper: 'Oceanography vs biodiversity coverage balance',
      color: domainBalanceScore >= 70 ? COLORS.healthy : COLORS.moderate,
    },
    {
      label: 'Risk Volatility',
      value: `${riskVolatility}`,
      helper: 'Standard deviation across regional risk scores',
      color: riskVolatility <= 12 ? COLORS.healthy : riskVolatility <= 20 ? COLORS.moderate : COLORS.high,
    },
  ];

  return (
    <main className="min-h-screen bg-ocean-gradient pb-20">
      <Navbar />
      <FloatingParticles count={15} />

      <section className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-6 py-6 shadow-glow">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Nerexis Intelligence Suite</p>
                  <h1 className="mt-2 text-4xl md:text-5xl font-bold text-text-primary">Marine Analytics Command Center</h1>
                  <p className="mt-3 max-w-3xl text-text-secondary">
                    Professional monitoring workspace for ecosystem risk, biodiversity intelligence, coastal forecasting, and AI-driven analysis.
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {data?.generated_at ? `Last verified sync: ${new Date(data.generated_at).toLocaleString()}` : 'Awaiting first analytics sync...'}
                  </p>
                </div>
                <div className="min-w-[220px] rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Platform Score</p>
                  <p className="mt-2 text-3xl font-bold text-text-primary">{platformScore}%</p>
                  <p className="mt-1 text-xs text-text-secondary">{platformTier}</p>
                  <p className="mt-3 text-xs text-text-secondary">Readiness: <span className="font-semibold text-text-primary">{platformReadiness}</span></p>
                  <p className="mt-1 text-xs text-text-secondary">Outlook: <span className="font-semibold text-text-primary">{platformOutlook}</span></p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Reports</p>
                <p className="mt-2 text-3xl font-bold text-text-primary">{data?.totals.reports ?? 0}</p>
                <p className="mt-1 text-sm text-text-secondary">Total intelligence reports indexed.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Regions</p>
                <p className="mt-2 text-3xl font-bold text-text-primary">{data?.totals.regions ?? 0}</p>
                <p className="mt-1 text-sm text-text-secondary">Actively monitored coastal zones.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Average Risk</p>
                <p className="mt-2 text-3xl font-bold" style={{ color: getRiskColor(averageRisk) }}>{averageRisk}%</p>
                <p className="mt-1 text-sm text-text-secondary">Cross-region ecosystem stress score.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Datasets</p>
                <p className="mt-2 text-3xl font-bold text-text-primary">{data?.totals.datasets ?? 0}</p>
                <p className="mt-1 text-sm text-text-secondary">Live and historical sources connected.</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Unified Platform Scorecard</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Executive-grade maturity indicators for multimodal ocean and biodiversity operations.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-text-primary">{platformScore}%</p>
                  <p className="text-xs text-cyan">{platformTier}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Readiness</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{platformReadiness}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Risk Outlook</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{platformOutlook}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Fusion Balance</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">
                    {Math.round(unifiedSnapshot?.platform_scorecard?.multimodal_balance_score || 0)}%
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">Live Coverage</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">
                    {Math.round(unifiedSnapshot?.platform_scorecard?.live_metric_coverage_pct || 0)}%
                  </p>
                </div>
              </div>
            </div>

            <DatieTrustPanel />

            <div className="mt-5 rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-widest text-text-secondary">Live Feed Health</p>
                <p className="text-[11px] text-text-secondary">UP {liveFeedsUp}/{liveFeeds.length || 0}</p>
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

            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Data Governance Note</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Metrics are generated from live marine and biodiversity feeds. For policy, legal, or safety decisions, validate against authoritative source systems.
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Refresh Configuration</p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Analytics auto-refreshes every 30 seconds. Data source ingestion interval: {(dataFreshness?.refresh_interval_seconds || 0) > 0 ? `${dataFreshness?.refresh_interval_seconds}s` : 'configured'}.
                  </p>
                </div>
                <button
                  onClick={() => fetchSummary(true)}
                  className="btn-secondary px-5 py-2.5 shrink-0"
                  disabled={refreshing}
                >
                  {refreshing ? 'Refreshing…' : 'Refresh Now'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-1 bg-white/10 border border-white/20 p-1.5 rounded-xl"
          >
            {[
              { label: 'Overview', value: 'overview' },
              { label: 'Ecosystem Health', value: 'ecosystem-health' },
              { label: 'Biodiversity Intelligence', value: 'biodiversity-intelligence' },
              { label: 'Coastal Forecasting', value: 'coastal-forecasting' },
              { label: 'Climate Trends', value: 'climate-correlation' },
              { label: 'AI Workspace', value: 'ai-workspace' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value as (typeof TAB_KEYS)[number])}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.value
                    ? 'bg-white text-text-primary border border-white/30 shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {loading && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <GlassCard>
              <p className="text-text-secondary">Loading live analytics...</p>
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

      {activeTab === 'overview' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-6 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insightCards.map((insight) => (
                <GlassCard key={insight.label}>
                  <p className="text-sm text-text-secondary">{insight.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: insight.color }}>
                    {insight.value}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">{insight.helper}</p>
                </GlassCard>
              ))}
            </div>

            <GlassCard className="mt-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">Detailed Operational Analytics</h3>
                  <p className="text-sm text-text-secondary mt-1">Detailed health checks explained in plain language for quick decisions.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">Overall status:</span> {readinessBand}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {detailedInsightCards.map((item) => (
                  <div key={item.label} className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">{item.label}</p>
                    <p className="mt-2 text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                    <p className="mt-1 text-xs text-text-secondary">{item.helper}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">How to read this scorecard</p>
                  <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                    <li>Readiness combines data quality, source availability, data balance, and current average risk.</li>
                    <li>A higher critical share means more regions need quick attention.</li>
                    <li>Higher volatility means risk is uneven across regions and should be handled region by region.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">Recommended focus this cycle</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {operationalReadinessScore < 55
                      ? 'First improve data stability and coverage before expanding AI-driven actions.'
                      : operationalReadinessScore < 80
                        ? 'Keep data flow reliable and focus on response plans for high-risk regions.'
                        : 'Maintain current operations and speed up preventive actions in medium-risk regions.'}
                  </p>
                </div>
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="chart-container p-7"
              >
                <h3 className="text-xl font-bold text-text-primary mb-2">Report Type Share (%)</h3>
                <p className="text-sm text-text-secondary mb-6">How reports are split by type (in percent).</p>
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie
                      data={speciesDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      innerRadius={62}
                      outerRadius={112}
                      paddingAngle={2}
                      fill="var(--color-electric-violet)"
                      dataKey="value"
                    >
                      {speciesDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value}%`, 'Share']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid rgba(148,163,184,0.35)',
                        borderRadius: '10px',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {speciesDistribution.slice(0, 6).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="text-sm text-text-secondary">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-text-primary">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="chart-container p-7"
              >
                <h3 className="text-xl font-bold text-text-primary mb-2">Report Count by Type</h3>
                <p className="text-sm text-text-secondary mb-6">Total number of reports in each type.</p>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart
                    data={speciesCounts}
                    margin={{ top: 12, right: 16, left: 8, bottom: 16 }}
                    barCategoryGap={28}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" tickMargin={10}>
                      <Label value="Report Type" offset={-6} position="insideBottom" fill="var(--text-secondary)" fontSize={12} />
                    </XAxis>
                    <YAxis stroke="var(--text-secondary)" tickMargin={8}>
                      <Label value="Count (records)" angle={-90} position="insideLeft" fill="var(--text-secondary)" fontSize={12} style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid rgba(148,163,184,0.35)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <Bar dataKey="count" fill="var(--color-bioluminescent)" radius={[6, 6, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            <GlassCard className="mt-6">
              <h3 className="text-xl font-bold text-text-primary mb-4">Key Highlights</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg bg-white bg-opacity-5 p-4 border border-white border-opacity-10">
                  <p className="text-text-secondary text-sm">Top Risk Region</p>
                  <p className="text-lg font-semibold text-text-primary mt-1">{highestRiskRegion?.region || 'N/A'}</p>
                  <p className="text-sm mt-1" style={{ color: getRiskColor(highestRiskRegion?.risk || 0) }}>
                    {highestRiskRegion ? `${highestRiskRegion.risk}% · ${highestRiskRegion.status}` : 'No data'}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">Calculated using live temperature, wave, salinity, current, tide, and ecology data.</p>
                </div>
                <div className="rounded-lg bg-white bg-opacity-5 p-4 border border-white border-opacity-10">
                  <p className="text-text-secondary text-sm">Data Freshness</p>
                  <p className="text-lg font-semibold text-text-primary mt-1">{latestObservedText}</p>
                  <p className="text-sm text-text-secondary mt-1">Latest observed live timestamp across monitored regions</p>
                </div>
                <div className="rounded-lg bg-white bg-opacity-5 p-4 border border-white border-opacity-10">
                  <p className="text-text-secondary text-sm">Coverage Confidence</p>
                  <p className="text-lg font-semibold text-text-primary mt-1">
                    {metricCoveragePercent >= 75 ? 'High' : metricCoveragePercent >= 45 ? 'Moderate' : 'Limited'}
                  </p>
                  <p className="text-sm text-text-secondary mt-1">{metricCoveragePercent}% regions have enough live metrics for full stress scoring</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="rounded-lg bg-white bg-opacity-5 p-4 border border-white border-opacity-10">
                  <p className="text-text-secondary text-sm">Oceanography Live Sources</p>
                  <p className="text-lg font-semibold text-text-primary mt-1">
                    {(liveSourceCounts?.open_meteo ?? 0) + (liveSourceCounts?.noaa ?? 0) + (liveSourceCounts?.nasa ?? 0)}
                  </p>
                  <p className="text-sm text-text-secondary mt-1">Ocean and weather feeds currently available.</p>
                </div>
                <div className="rounded-lg bg-white bg-opacity-5 p-4 border border-white border-opacity-10">
                  <p className="text-text-secondary text-sm">Biodiversity Live Sources</p>
                  <p className="text-lg font-semibold text-text-primary mt-1">
                    {(liveSourceCounts?.gbif ?? 0) + (liveSourceCounts?.inaturalist ?? 0) + (liveSourceCounts?.obis ?? 0)}
                  </p>
                  <p className="text-sm text-text-secondary mt-1">Biodiversity feeds currently available.</p>
                </div>
                <div className="rounded-lg bg-white bg-opacity-5 p-4 border border-white border-opacity-10">
                  <p className="text-text-secondary text-sm">Unified Domain Mix</p>
                  <p className="text-lg font-semibold text-text-primary mt-1">
                    {(domainCoverage?.oceanographic_datasets ?? 0).toLocaleString()} / {(domainCoverage?.biodiversity_datasets ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-text-secondary mt-1">Current balance of ocean and biodiversity datasets.</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="text-xl font-bold text-text-primary mb-4">Domain Coverage Snapshot</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg bg-white bg-opacity-5 p-4 border border-white border-opacity-10">
                  <p className="text-text-secondary text-sm">Oceanography Coverage</p>
                  <p className="text-lg font-semibold text-text-primary mt-1">{oceanDatasets.toLocaleString()} datasets · {oceanShare}% share</p>
                  <p className="text-sm text-text-secondary mt-1">Includes Open-Meteo, NOAA, and NASA ocean/environmental snapshots.</p>
                </div>
                <div className="rounded-lg bg-white bg-opacity-5 p-4 border border-white border-opacity-10">
                  <p className="text-text-secondary text-sm">Biodiversity Coverage</p>
                  <p className="text-lg font-semibold text-text-primary mt-1">{biodiversityDatasets.toLocaleString()} datasets · {biodiversityShare}% share</p>
                  <p className="text-sm text-text-secondary mt-1">Includes GBIF, iNaturalist, and OBIS species observations.</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-white bg-opacity-5 p-4 border border-white border-opacity-10">
                <p className="text-text-secondary text-sm">Quick Interpretation</p>
                <p className="text-text-primary mt-1">
                  {biodiversityGap > 0
                    ? `Biodiversity data is currently behind ocean data by ${biodiversityGap.toLocaleString()} datasets. This view helps compare both sides clearly.`
                    : 'Ocean and biodiversity data coverage are well balanced, which improves confidence in results.'}
                </p>
              </div>
            </GlassCard>

          </div>
        </section>
      )}

      {activeTab === 'ecosystem-health' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <GlassCard className="p-4 md:p-5">
                <h4 className="text-lg font-bold text-text-primary">Ecosystem Executive Snapshot</h4>
                <p className="text-sm text-text-secondary mt-1">Fast-read summary of ecosystem stress concentration and hotspot coverage.</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Avg Risk</p>
                    <p className="text-lg font-semibold" style={{ color: getRiskColor(averageRisk) }}>{averageRisk}%</p>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Critical Regions</p>
                    <p className="text-lg font-semibold text-neon-coral">{highRiskCount}</p>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Low Risk Regions</p>
                    <p className="text-lg font-semibold text-seafoam">{lowRiskCount}</p>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Visible Hotspots</p>
                    <p className="text-lg font-semibold text-text-primary">{filteredHotspots.length}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-text-primary">Regional Ranking Controls</h4>
                    <p className="text-sm text-text-secondary">Sort regions by risk level or number of observations.</p>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-lg">
                    {[
                      { label: 'Sort: Risk', value: 'risk' },
                      { label: 'Sort: Observations', value: 'observations' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setHealthSort(option.value as 'risk' | 'observations')}
                        className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                          healthSort === option.value
                            ? 'bg-white font-semibold text-text-primary border border-slate-200 shadow-sm'
                            : 'text-text-secondary hover:text-text-primary hover:bg-white/70'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-4 md:p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Hotspot Type</p>
                    <select
                      value={hotspotTypeFilter}
                      onChange={(event) => setHotspotTypeFilter(event.target.value)}
                      className="w-full rounded-md bg-white bg-opacity-5 border border-white border-opacity-15 px-3 py-2 text-sm text-text-primary"
                    >
                      {hotspotTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'all' ? 'All Types' : option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-xs text-text-secondary mb-1">Minimum Severity</p>
                    <select
                      value={String(minSeverityFilter)}
                      onChange={(event) => setMinSeverityFilter(Number(event.target.value) as 0 | 40 | 70)}
                      className="w-full rounded-md bg-white bg-opacity-5 border border-white border-opacity-15 px-3 py-2 text-sm text-text-primary"
                    >
                      <option value="0">All</option>
                      <option value="40">Moderate+ (&gt;=40)</option>
                      <option value="70">Critical (&gt;=70)</option>
                    </select>
                  </div>

                  <div>
                    <p className="text-xs text-text-secondary mb-1">Recency Window</p>
                    <select
                      value={String(hotspotWindowDays)}
                      onChange={(event) => setHotspotWindowDays(Number(event.target.value) as 30 | 90 | 365)}
                      className="w-full rounded-md bg-white bg-opacity-5 border border-white border-opacity-15 px-3 py-2 text-sm text-text-primary"
                    >
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="365">Last 365 days</option>
                    </select>
                  </div>

                  <div className="rounded-md bg-white bg-opacity-5 border border-white border-opacity-10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Visible Hotspots</p>
                    <p className="text-lg font-semibold text-text-primary">{filteredHotspots.length}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <h4 className="text-lg font-bold text-text-primary mb-2">Global Marine Risk Heatmap</h4>
                <p className="text-sm text-text-secondary mb-4">Click any hotspot to view location details and severity context.</p>
                <MarineHeatmap points={filteredHeatmapPoints} />
              </GlassCard>

              <GlassCard>
                <h3 className="text-xl font-bold text-text-primary mb-2">Regional Ecosystem Risk Assessment</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Ranked by <span className="font-semibold text-text-primary">{healthSort === 'risk' ? 'Risk Percentage' : 'Observation Count'}</span>
                </p>
                <div className="space-y-4">
                  {sortedEcosystemHealth.map((region, i) => (
                    <motion.div
                      key={`${region.region}-${healthSort}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center space-x-4"
                    >
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-text-primary font-medium">{region.region}</span>
                          <span className="text-sm font-semibold" style={{ color: getRiskColor(region.risk) }}>
                            #{i + 1} · {region.status} · {region.observation_count} observations
                          </span>
                        </div>
                        <div className="w-full bg-white bg-opacity-10 rounded-full h-3 overflow-hidden">
                          <div
                            style={{
                              width:
                                healthSort === 'risk'
                                  ? `${region.risk}%`
                                  : `${Math.round((region.observation_count / maxObservationCount) * 100)}%`,
                              backgroundColor:
                                healthSort === 'risk' ? getRiskColor(region.risk) : 'var(--color-bioluminescent)',
                              boxShadow:
                                healthSort === 'risk'
                                  ? `0 0 10px ${getRiskColor(region.risk)}`
                                  : '0 0 10px rgba(64,224,208,0.5)',
                            }}
                            className="h-full transition-all duration-500"
                          />
                        </div>
                      </div>
                      <span className="text-text-primary font-bold w-24 text-right">
                        {healthSort === 'risk' ? `${region.risk}%` : `${region.observation_count} obs`}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard>
                <h4 className="text-lg font-bold text-text-primary mb-2">Focused Hotspot Intelligence</h4>
                <p className="text-sm text-text-secondary mb-4">
                  Hotspots are identified from live regional data such as temperature, wave height, salinity, tides, currents, and risk score.
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {filteredHotspots.length === 0 ? (
                    <p className="text-sm text-text-secondary">No hotspot intelligence rows are available yet.</p>
                  ) : (
                    filteredHotspots.map((hotspot, index) => (
                      <div key={`${hotspot.region}-${index}`} className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-4 py-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <p className="text-sm font-semibold text-text-primary">
                            H{String(index + 1).padStart(2, '0')} · {hotspot.region}
                          </p>
                          <p className="text-sm font-semibold" style={{ color: getRiskColor(hotspot.severity || 0) }}>
                            Severity {hotspot.severity}% · {hotspot.status}
                          </p>
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                          {hotspot.hotspot_type} | Cause: {hotspot.cause}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          Reason: {hotspot.risk_basis || 'Live regional change pattern'} | Confidence: {hotspot.risk_confidence || 'Medium'}
                          {hotspot.metric_coverage_ratio != null ? ` | Metric coverage: ${Math.round(hotspot.metric_coverage_ratio * 100)}%` : ''}
                        </p>
                        {!!hotspot.drivers?.length && (
                          <p className="text-xs text-text-secondary mt-1">Drivers: {hotspot.drivers.join(', ')}</p>
                        )}
                        <p className="text-xs text-text-secondary mt-1">
                          Observations: {hotspot.observation_count} | Coordinates: {hotspot.lat?.toFixed?.(3)}, {hotspot.lng?.toFixed?.(3)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>

              <GlassCard>
                <h4 className="text-lg font-bold text-text-primary mb-4">Ecosystem Risk Legend</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: COLORS.healthy }} />
                      <span className="text-text-secondary">Low risk (&lt;40%)</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: COLORS.moderate }} />
                      <span className="text-text-secondary">Medium risk (40-70%)</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: COLORS.high }} />
                      <span className="text-text-secondary">High risk (&gt;70%)</span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </section>
      )}

      {activeTab === 'biodiversity-intelligence' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto space-y-6">
            <BiodiversityIntelligencePanel
              summary={data}
              speciesEnriched={speciesEnriched}
              globalCatalog={globalBiodiversityCatalog}
              isRefreshing={refreshing}
              onRefresh={() => fetchSummary(true)}
            />
            <BiodiversityIntelligencePage embedded summaryOverride={data} enrichedOverride={speciesEnriched} />
          </div>
        </section>
      )}

      {activeTab === 'coastal-forecasting' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-lg p-8"
            >
              <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
                <h4 className="text-lg font-bold text-text-primary">Coastal Forecast Executive Snapshot</h4>
                <p className="text-sm text-text-secondary mt-1">Quick summary of forecast trend, data coverage, and biodiversity support.</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Trend Delta</p>
                    <p className="text-lg font-semibold" style={{ color: riskDelta > 0 ? COLORS.high : COLORS.healthy }}>{`${riskDelta > 0 ? '+' : ''}${riskDelta}%`}</p>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Forecast Rows</p>
                    <p className="text-lg font-semibold text-text-primary">{coastalRows.length}</p>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Window</p>
                    <p className="text-lg font-semibold text-text-primary">{timeWindow} months</p>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Biodiversity Signal</p>
                    <p className="text-lg font-semibold text-bioluminescent">{(biodiversityAnalytics?.total_species_observations || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-text-primary mb-2">Coastal Forecasting</h3>
                  <p className="text-text-secondary">Region-level forecasts based on live temperature, wave, salinity, tide, and current data.</p>
                </div>
                <div className="flex flex-wrap items-center gap-1 bg-slate-100 border border-slate-200 p-1.5 rounded-lg w-fit">
                  <span className="px-2 text-xs font-medium text-text-secondary">Window</span>
                  {[3, 6, 12].map((window) => (
                    <button
                      key={window}
                      onClick={() => setTimeWindow(window as 3 | 6 | 12)}
                      className={`px-3 py-1.5 rounded-md text-sm ${
                        timeWindow === window
                          ? 'bg-white font-semibold text-text-primary border border-slate-200 shadow-sm'
                          : 'text-text-secondary hover:text-text-primary hover:bg-white/70'
                      }`}
                    >
                      {window} Months
                    </button>
                  ))}
                  <select
                    value={forecastRegion}
                    onChange={(event) => setForecastRegion(event.target.value)}
                    className="rounded-md bg-white bg-opacity-5 border border-white border-opacity-15 px-3 py-1.5 text-sm text-text-primary"
                  >
                    {forecastRegionOptions.map((regionName) => (
                      <option key={regionName} value={regionName}>{regionName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-4 py-3">
                  <p className="text-xs text-text-secondary">Forecast Model</p>
                  <p className="text-sm font-semibold text-text-primary">{forecastData?.model || 'Loading...'}</p>
                </div>
                <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-4 py-3">
                  <p className="text-xs text-text-secondary">Region</p>
                  <p className="text-sm font-semibold text-text-primary">{forecastData?.region || forecastRegion}</p>
                </div>
                <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-4 py-3">
                  <p className="text-xs text-text-secondary">Observed Data Points (SST/Wave/Current/Tide)</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {forecastData
                      ? `${forecastData.observed_points.sst_c || 0}/${forecastData.observed_points.wave_height_m || 0}/${forecastData.observed_points.current_velocity_mps || 0}/${forecastData.observed_points.tide_height_m || 0}`
                      : 'Loading...'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 2xl:grid-cols-[1.45fr_1fr] gap-8">
                <div className="space-y-3">
                  <ResponsiveContainer width="100%" height={390}>
                    <LineChart data={chartTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                      <XAxis
                        dataKey="month"
                        stroke="var(--text-secondary)"
                        tickMargin={10}
                        minTickGap={28}
                        tickFormatter={(value) => String(value).slice(2)}
                      >
                        <Label value="Month" offset={-6} position="insideBottom" fill="var(--text-secondary)" fontSize={12} />
                      </XAxis>
                      <YAxis stroke="var(--text-secondary)" domain={[0, 100]} tickMargin={8} width={34}>
                        <Label value="Metric Value" angle={-90} position="insideLeft" fill="var(--text-secondary)" fontSize={12} style={{ textAnchor: 'middle' }} />
                      </YAxis>
                      <Tooltip
                        cursor={{ stroke: 'rgba(100,116,139,0.4)', strokeWidth: 1 }}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.96)',
                          border: '1px solid rgba(148,163,184,0.35)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Line
                        type="monotone"
                        dataKey="risk"
                        name="Risk Score"
                        stroke="var(--color-bioluminescent)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        animationDuration={500}
                        dot={false}
                        activeDot={{ r: 6, fill: 'var(--color-bioluminescent)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sst"
                        name="SST (°C)"
                        stroke="#1e90ff"
                        strokeWidth={2}
                        strokeDasharray="5 2"
                        dot={false}
                        activeDot={{ r: 5, fill: '#1e90ff' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="wave"
                        name="Wave (m)"
                        stroke="#00b894"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                        activeDot={{ r: 5, fill: '#00b894' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="salinity"
                        name="Salinity (PSU)"
                        stroke="#fdcb6e"
                        strokeWidth={2}
                        strokeDasharray="3 2"
                        dot={false}
                        activeDot={{ r: 5, fill: '#fdcb6e' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="current"
                        name="Current (m/s)"
                        stroke="#e17055"
                        strokeWidth={2}
                        strokeDasharray="2 2"
                        dot={false}
                        activeDot={{ r: 5, fill: '#e17055' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {filteredTrend.length < 2 && (
                    <div className="rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 px-4 py-3">
                      <p className="text-sm text-text-primary font-medium">Limited historical points</p>
                      <p className="text-xs text-text-secondary mt-1">
                        Only real monthly points are shown. More months will appear as new live data arrives.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {chartTrend.map((entry) => (
                    <div key={entry.month} className="rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-text-primary font-medium">{entry.month}</p>
                        <p className="text-sm text-text-secondary">{entry.status}</p>
                      </div>
                      <span className="text-lg font-semibold" style={{ color: getRiskColor(entry.risk) }}>{entry.risk}%</span>
                    </div>
                  ))}
                  {chartTrend.length === 0 && (
                    <div className="rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-4">
                      <p className="text-sm text-text-secondary">No real monthly risk history is available yet for the selected window.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-white border-opacity-10 bg-white bg-opacity-5 p-4">
                <p className="text-sm font-semibold text-text-primary mb-3">Regional Coastal Forecast Snapshot</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-secondary border-b border-white border-opacity-10">
                        <th className="py-2 pr-3">Region</th>
                        <th className="py-2 pr-3">SST (degC)</th>
                        <th className="py-2 pr-3">Wave (m)</th>
                        <th className="py-2 pr-3">Salinity (PSU)</th>
                        <th className="py-2 pr-3">Current (m/s)</th>
                        <th className="py-2 pr-3">Tide (m)</th>
                        <th className="py-2">Stress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coastalRows.map((row) => (
                        <tr key={row.region} className="border-b border-white border-opacity-5 text-text-primary">
                          <td className="py-2 pr-3">{row.region}</td>
                          <td className="py-2 pr-3">{row.sst_c ?? '-'}</td>
                          <td className="py-2 pr-3">{row.wave_height_m ?? '-'}</td>
                          <td className="py-2 pr-3">{row.salinity_psu ?? '-'}</td>
                          <td className="py-2 pr-3">{row.current_velocity_mps ?? '-'}</td>
                          <td className="py-2 pr-3">{row.tide_height_m ?? '-'}</td>
                          <td className="py-2" style={{ color: getRiskColor(Number(row.stress_index || 0)) }}>
                            {row.stress_index == null ? 'Insufficient metrics' : `${row.stress_index} (${getRiskStatus(Number(row.stress_index))})`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {coastalRows.length === 0 && <p className="text-xs text-text-secondary mt-2">No coastal numbers are available for this time window yet.</p>}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {activeTab === 'climate-correlation' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-lg p-8"
            >
              <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
                <h4 className="text-lg font-bold text-text-primary">Climate Executive Snapshot</h4>
                <p className="text-sm text-text-secondary mt-1">Quick view of climate trend strength, direction, and biodiversity pressure.</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Correlation Rows</p>
                    <p className="text-lg font-semibold text-text-primary">{regionalClimateCorrelation.length}</p>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Avg Risk</p>
                    <p className="text-lg font-semibold" style={{ color: getRiskColor(averageRisk) }}>{averageRisk}%</p>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">Trend Direction</p>
                    <p className="text-lg font-semibold" style={{ color: riskDelta > 0 ? COLORS.high : COLORS.healthy }}>{riskDelta > 0 ? 'Rising' : riskDelta < 0 ? 'Improving' : 'Stable'}</p>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-text-secondary">At-Risk Species</p>
                    <p className="text-lg font-semibold text-neon-coral">{biodiversityAtRiskSpecies}</p>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-text-primary mb-4">Climate Trends</h3>
              <p className="text-text-secondary mb-6">Trend indicators from live regional health, past data, and reporting signals.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard>
                  <p className="text-sm text-text-secondary">Average Ecosystem Risk</p>
                  <p className="text-2xl font-bold" style={{ color: getRiskColor(averageRisk) }}>
                    {averageRisk}%
                  </p>
                  <p className="text-xs text-text-secondary">{getRiskStatus(averageRisk)}</p>
                </GlassCard>
                <GlassCard>
                  <p className="text-sm text-text-secondary">Risk-to-Region Ratio</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {riskToRegionDensity}
                  </p>
                  <p className="text-xs text-text-secondary">Average ecosystem risk divided by monitored region count.</p>
                </GlassCard>
                <GlassCard>
                  <p className="text-sm text-text-secondary">Correlation Confidence</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {regionalClimateCorrelation.length >= 8 ? 'High' : regionalClimateCorrelation.length >= 4 ? 'Moderate' : 'Low'}
                  </p>
                  <p className="text-xs text-text-secondary">Confidence increases when more regions have complete live data.</p>
                </GlassCard>
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-4">
                  <p className="text-sm text-text-secondary">Current Risk Status</p>
                  <p className="text-xl font-semibold mt-1" style={{ color: getRiskColor(averageRisk) }}>
                    {getRiskStatus(averageRisk)}
                  </p>
                  <p className="text-xs text-text-secondary mt-2">
                    This combines average risk, concentration by region, and recent month-to-month change.
                  </p>
                </div>
                <div className="rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-4">
                  <p className="text-sm text-text-secondary">Forecast Direction</p>
                  <p className="text-xl font-semibold mt-1" style={{ color: riskDelta > 0 ? COLORS.high : COLORS.healthy }}>
                    {riskDelta > 0 ? 'Risk increasing' : riskDelta < 0 ? 'Risk improving' : 'Stable pattern'}
                  </p>
                  <p className="text-xs text-text-secondary mt-2">Based on the selected {timeWindow}-month trend window.</p>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-4">
                  <p className="text-sm font-semibold text-text-primary mb-3">Regional Climate Breakdown</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-secondary border-b border-white border-opacity-10">
                        <th className="py-2 pr-3">Region</th>
                        <th className="py-2 pr-3">Stress</th>
                        <th className="py-2 pr-3">SST (degC)</th>
                        <th className="py-2 pr-3">Wave (m)</th>
                        <th className="py-2 pr-3">Salinity (PSU)</th>
                        <th className="py-2">Current (m/s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regionalClimateCorrelation.map((row) => (
                        <tr key={row.region} className="border-b border-white border-opacity-5 text-text-primary">
                          <td className="py-2 pr-3">{row.region}</td>
                          <td className="py-2 pr-3" style={{ color: getRiskColor(row.stress) }}>{row.stress}</td>
                          <td className="py-2 pr-3">{row.sst ?? '-'}</td>
                          <td className="py-2 pr-3">{row.wave ?? '-'}</td>
                          <td className="py-2 pr-3">{row.salinity ?? '-'}</td>
                          <td className="py-2">{row.current ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {regionalClimateCorrelation.length === 0 && (
                  <p className="text-xs text-text-secondary mt-2">No regional climate rows with complete live metrics are available yet.</p>
                )}
              </div>

              <div className="mt-4 rounded-lg bg-white bg-opacity-5 border border-white border-opacity-10 p-4">
                <p className="text-sm font-semibold text-text-primary mb-2">Metric Definitions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(metricDefinitions).map(([key, value]) => (
                    <div key={key} className="rounded-md border border-white border-opacity-10 bg-white bg-opacity-5 px-3 py-2">
                      <p className="text-xs text-bioluminescent font-semibold">{key}</p>
                      <p className="text-xs text-text-secondary mt-1">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ─── AI Analysis Workspace ─────────────────────────────────────────── */}
      {activeTab === 'ai-workspace' && (
        <section className="px-4 sm:px-6 lg:px-8 pb-8 relative z-10">
          <div className="max-w-7xl mx-auto space-y-6">

            <GlassCard className="p-4 md:p-5">
              <h4 className="text-lg font-bold text-text-primary">AI Workspace Executive Snapshot</h4>
              <p className="text-sm text-text-secondary mt-1">Current run status, model output readiness, and biodiversity data support.</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                  <p className="text-xs text-text-secondary">Models</p>
                  <p className="text-lg font-semibold text-text-primary">{mlModels.length}</p>
                </div>
                <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                  <p className="text-xs text-text-secondary">Running</p>
                  <p className="text-lg font-semibold text-bioluminescent">{mlModels.filter((model) => model.status === 'RUNNING').length}</p>
                </div>
                <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                  <p className="text-xs text-text-secondary">Completed</p>
                  <p className="text-lg font-semibold text-seafoam">{mlModels.filter((model) => model.status === 'COMPLETED').length}</p>
                </div>
                <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2">
                  <p className="text-xs text-text-secondary">Biodiversity Records</p>
                  <p className="text-lg font-semibold text-text-primary">{(biodiversityAnalytics?.total_species_observations || 0).toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-text-primary">AI Analysis Workspace</h2>
                <p className="text-text-secondary mt-1 text-sm">
                  Run AI/ML models on live marine data and review the results.
                  {mlWorkspace && (
                    <span className="ml-2 text-xs text-text-secondary opacity-70">
                      Updated: {new Date(mlWorkspace.generated_at).toLocaleTimeString()}
                      {' · refreshes every 6 h'}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-text-secondary font-medium whitespace-nowrap">Active Dataset:</span>
                <select
                  value={activeDataset}
                  onChange={(e) => setActiveDataset(e.target.value)}
                  className="text-sm font-semibold text-text-primary bg-transparent border-none outline-none cursor-pointer max-w-[220px]"
                >
                  {(mlWorkspace?.datasets ?? []).length > 0 ? (
                    mlWorkspace!.datasets.map((ds) => (
                      <option key={ds.id} value={ds.name}>{ds.name}</option>
                    ))
                  ) : (
                    <option>{activeDataset || 'Loading datasets…'}</option>
                  )}
                </select>
              </div>
            </div>

            {mlLoading && mlModels.length === 0 && (
              <p className="text-sm text-text-secondary">Loading ML workspace from live datasets…</p>
            )}

            {/* Model Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mlModels.map((model) => {
                const statusColor =
                  model.status === 'RUNNING'
                    ? 'bg-bioluminescent/10 text-bioluminescent border border-bioluminescent/20'
                    : model.status === 'COMPLETED'
                    ? 'bg-seafoam/10 text-seafoam border border-seafoam/20'
                    : 'bg-slate-100 text-text-secondary border border-slate-200';
                const progressColor =
                  model.status === 'RUNNING'
                    ? 'var(--color-bioluminescent, #2563EB)'
                    : model.status === 'COMPLETED'
                    ? 'var(--color-seafoam, #059669)'
                    : '#CBD5E1';
                return (
                  <motion.div
                    key={model.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-xl p-5 flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-text-primary text-base leading-tight">{model.name}</p>
                        <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-text-secondary border border-slate-200">{model.tag}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${statusColor}`}>{model.status}</span>
                    </div>
                    <p className="text-sm text-text-secondary">{model.description}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-text-secondary">
                        <span>Progress</span>
                        <span>{model.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${model.progress}%`, backgroundColor: progressColor }}
                        />
                      </div>
                      <p className="text-xs text-text-secondary">Last run: {model.lastRun}</p>
                    </div>
                    <button
                      onClick={() => handleMLAction(model.id, model.status === 'RUNNING' ? 'stop' : 'start')}
                      className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                        model.status === 'RUNNING'
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                          : 'bg-bioluminescent text-white hover:opacity-90'
                      }`}
                    >
                      {model.status === 'RUNNING' ? 'Stop' : model.status === 'COMPLETED' ? 'Run Again' : 'Start Analysis'}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Prediction Results Panel */}
            <div>
              <h3 className="text-lg font-bold text-text-primary mb-4">Prediction Results</h3>
              {(mlWorkspace?.prediction_results ?? []).length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <p className="text-sm text-text-secondary">
                    No results yet — run a model above to generate predictions from live datasets.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(mlWorkspace?.prediction_results ?? []).map((result) => {
                    const downloadSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
                    const mapSvg      = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>;
                    const trendSvg    = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>;
                    const alertSvg    = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
                    const chartSvg    = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>;
                    const scaleSvg    = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" /></svg>;

                    const iconMap: Record<string, React.ReactNode> = {
                      rf: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                        </svg>
                      ),
                      km: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                        </svg>
                      ),
                      ts: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                        </svg>
                      ),
                      iso: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      ),
                      gbr: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
                        </svg>
                      ),
                      pca: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                        </svg>
                      ),
                      dbscan: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      ),
                      lr: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" />
                        </svg>
                      ),
                      svr: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                      ),
                    };
                    const iconBgMap: Record<string, string> = {
                      rf:     'bg-seafoam/10 text-seafoam',
                      km:     'bg-bioluminescent/10 text-bioluminescent',
                      ts:     'bg-goldenrod/10 text-goldenrod',
                      iso:    'bg-neon-coral/10 text-neon-coral',
                      gbr:    'bg-goldenrod/10 text-goldenrod',
                      pca:    'bg-electric-violet/10 text-electric-violet',
                      dbscan: 'bg-bioluminescent/10 text-bioluminescent',
                      lr:     'bg-secondary/10 text-secondary',
                      svr:    'bg-seafoam/10 text-seafoam',
                    };
                    const actionStyleMap: Record<string, string> = {
                      'Export Report':      'bg-text-primary/90 text-white hover:bg-text-primary border border-text-primary/20',
                      'Export Data':        'bg-text-primary/90 text-white hover:bg-text-primary border border-text-primary/20',
                      'Compare Results':    'bg-text-primary/90 text-white hover:bg-text-primary border border-text-primary/20',
                      'View Species Map':   'border border-slate-300 text-text-secondary hover:text-text-primary hover:bg-slate-100',
                      'View on Map':        'border border-slate-300 text-text-secondary hover:text-text-primary hover:bg-slate-100',
                      'View Forecast':      'border border-slate-300 text-text-secondary hover:text-text-primary hover:bg-slate-100',
                      'View Anomaly Chart': 'border border-slate-300 text-text-secondary hover:text-text-primary hover:bg-slate-100',
                      'View Stress Map':    'border border-slate-300 text-text-secondary hover:text-text-primary hover:bg-slate-100',
                      'View Factor Chart':  'border border-slate-300 text-text-secondary hover:text-text-primary hover:bg-slate-100',
                      'View Risk Map':      'border border-slate-300 text-text-secondary hover:text-text-primary hover:bg-slate-100',
                    };
                    const actionIconMap: Record<string, React.ReactNode> = {
                      'Export Report':      downloadSvg,
                      'Export Data':        downloadSvg,
                      'Compare Results':    downloadSvg,
                      'View Species Map':   mapSvg,
                      'View on Map':        mapSvg,
                      'View Anomaly Chart': alertSvg,
                      'View Stress Map':    mapSvg,
                      'View Factor Chart':  chartSvg,
                      'View Risk Map':      scaleSvg,
                      'View Forecast':      trendSvg,
                    };
                    return (
                      <motion.div
                        key={result.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass rounded-xl p-5 space-y-4"
                      >
                        {/* Card header */}
                        <div className="flex items-start gap-3">
                          <div className={`rounded-lg p-2 shrink-0 ${iconBgMap[result.id] ?? 'bg-slate-100 text-slate-500'}`}>
                            {iconMap[result.id] ?? (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-text-primary text-sm leading-tight">{result.title}</p>
                            {result.cluster && (
                              <span className="inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-bioluminescent/10 text-bioluminescent border border-bioluminescent/20">
                                {result.cluster}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Body */}
                        <p className="text-sm text-text-secondary leading-relaxed">{result.body}</p>

                        {/* Confidence meter */}
                        {result.confidence != null && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Model Confidence</span>
                              <span className="text-sm font-bold text-text-primary">{result.confidence}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-1.5 rounded-full transition-all duration-700"
                                style={{
                                  width: `${result.confidence}%`,
                                  backgroundColor: result.confidence >= 80 ? 'var(--color-seafoam, #059669)' : result.confidence >= 60 ? 'var(--color-bioluminescent, #2563EB)' : 'var(--color-goldenrod, #D97706)',
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        {result.actions.length > 0 && (
                          <div className="flex gap-2 flex-wrap pt-1">
                            {result.actions.map((action) => (
                              <button
                                key={action}
                                onClick={() => handleResultAction(result.id, action)}
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${actionStyleMap[action] ?? 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                              >
                                {actionIconMap[action]}
                                {action}
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </section>
      )}
    </main>
  );
}


