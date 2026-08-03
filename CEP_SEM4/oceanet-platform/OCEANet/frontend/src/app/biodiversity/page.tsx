'use client';

import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { GlassCard } from '@/components/Cards';
import { FloatingParticles } from '@/components/Animations';
import { apiFetch } from '@/utils/api';

type BiodiversityRegion = {
  region: string;
  country?: string;
  state?: string;
  ecosystem_type?: string;
  total_species?: number;
  total_observations?: number;
  species_count?: number;
  observation_count?: number;
  biodiversity_index?: number;
  stress_index?: number | null;
  top_species?: Array<{ name: string; count: number }>;
};

type AnalyticsSummary = {
  generated_at: string;
  biodiversity_analytics?: {
    top_species: Array<{ name: string; count: number }>;
    regions: BiodiversityRegion[];
    total_species_observations: number;
    total_unique_species: number;
    no_species_message?: string | null;
  };
};

type EnrichedSpeciesResponse = {
  iucn_enabled: boolean;
  source_integration?: {
    gbif?: boolean;
    iucn?: boolean;
    iucn_token_configured?: boolean;
    mode?: string;
  };
  data_quality?: {
    taxonomy_resolution_pct?: number;
    source_consistency_pct?: number;
    iucn_coverage_pct?: number;
    resolution_confidence_pct?: number;
  };
  species: Array<{
    name: string;
    observation_count: number;
    gbif?: {
      kingdom?: string;
      phylum?: string;
      rank?: string;
      family?: string;
      genus?: string;
      status?: string;
    } | null;
    iucn_red_list_category?: string | null;
  }>;
};

function getBadgeTone(value: string): string {
  if (value.toLowerCase().includes('high') || value.toLowerCase().includes('species')) {
    return 'border-secondary/30 bg-secondary/10 text-secondary';
  }
  if (value.toLowerCase().includes('medium') || value.toLowerCase().includes('genus')) {
    return 'border-goldenrod/30 bg-goldenrod/10 text-goldenrod';
  }
  return 'border-neon-coral/30 bg-neon-coral/10 text-neon-coral';
}

type BiodiversityIntelligencePageProps = {
  embedded?: boolean;
  summaryOverride?: AnalyticsSummary | null;
  enrichedOverride?: EnrichedSpeciesResponse | null;
};

export default function BiodiversityIntelligencePage({ embedded = false, summaryOverride = null, enrichedOverride = null }: BiodiversityIntelligencePageProps) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(summaryOverride);
  const [enriched, setEnriched] = useState<EnrichedSpeciesResponse | null>(enrichedOverride);
  const [loading, setLoading] = useState(summaryOverride ? false : true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (summaryOverride && !cancelled) {
        setSummary(summaryOverride);
        setLoading(false);
        setError(null);
      }

      if (!summaryOverride) {
        try {
          const summaryRes = await apiFetch('/_legacy/analytics/summary', {
            cache: 'no-store',
            timeoutMs: 20000,
            retryOnTimeout: false,
            dedupeGetMs: 3000,
          });

          if (!summaryRes.ok) {
            throw new Error('Unable to load biodiversity analytics summary');
          }

          const summaryPayload: AnalyticsSummary = await summaryRes.json();
          if (!cancelled) setSummary(summaryPayload);

          if (!cancelled) {
            setError(null);
            setLoading(false);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Unable to load biodiversity intelligence');
            setLoading(false);
          }
        }
      }

      if (enrichedOverride) {
        if (!cancelled) {
          setEnriched(enrichedOverride);
        }
        return;
      }

      try {
        const enrichedRes = await apiFetch('/_legacy/biodiversity/species/enriched?limit=20', {
          cache: 'no-store',
          timeoutMs: 20000,
          retryOnTimeout: false,
          allowLocalFallback: true,
          dedupeGetMs: 4000,
        });

        if (enrichedRes.ok) {
          const enrichedPayload: EnrichedSpeciesResponse = await enrichedRes.json();
          if (!cancelled) setEnriched(enrichedPayload);
        }
      } catch {
        // Keep page usable with summary/top-species data when enrichment is slow.
        try {
          const retryRes = await apiFetch('/_legacy/biodiversity/species/enriched?limit=10', {
            cache: 'no-store',
            timeoutMs: 25000,
            retryOnTimeout: false,
            allowLocalFallback: true,
            dedupeGetMs: 4000,
          });
          if (retryRes.ok) {
            const retryPayload: EnrichedSpeciesResponse = await retryRes.json();
            if (!cancelled) setEnriched(retryPayload);
          }
        } catch {
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enrichedOverride, summaryOverride]);

  const biodiversity = summary?.biodiversity_analytics;
  const topSpecies = biodiversity?.top_species || [];
  const regions = biodiversity?.regions || [];

  const richnessIndex = biodiversity?.total_unique_species || 0;
  const observationTotal = biodiversity?.total_species_observations || 0;

  const shannonIndex = useMemo(() => {
    const counts = topSpecies.map((row) => Number(row.count || 0)).filter((count) => count > 0);
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (!total || !counts.length) return 0;
    const h = counts.reduce((sum, count) => {
      const p = count / total;
      return sum - p * Math.log(p);
    }, 0);
    return Number(h.toFixed(3));
  }, [topSpecies]);

  const simpsonIndex = useMemo(() => {
    const counts = topSpecies.map((row) => Number(row.count || 0)).filter((count) => count > 0);
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (!total || !counts.length) return 0;
    const d = counts.reduce((sum, count) => {
      const p = count / total;
      return sum + p * p;
    }, 0);
    return Number((1 - d).toFixed(3));
  }, [topSpecies]);

  const biodiversityScore = useMemo(() => {
    if (!richnessIndex && !observationTotal) return 0;
    const richnessScore = Math.min(100, Math.log1p(richnessIndex) * 26);
    const volumeScore = Math.min(100, Math.log1p(observationTotal) * 16);
    const evennessScore = Math.min(100, shannonIndex * 28);
    return Math.round((richnessScore + volumeScore + evennessScore) / 3);
  }, [observationTotal, richnessIndex, shannonIndex]);

  const dataQuality = biodiversityScore >= 75 ? 'High' : biodiversityScore >= 45 ? 'Medium' : 'Low';
  const taxonomyResolution = topSpecies.length > 0 ? 'Species' : (regions.length > 0 ? 'Genus' : 'Order');

  const taxonomicDistribution = useMemo(() => {
    const kingdomCounter = new Map<string, number>();
    const familyCounter = new Map<string, number>();

    for (const row of enriched?.species || []) {
      const k = row.gbif?.kingdom || 'Unspecified';
      const f = row.gbif?.family || 'Unspecified';
      kingdomCounter.set(k, (kingdomCounter.get(k) || 0) + Number(row.observation_count || 0));
      familyCounter.set(f, (familyCounter.get(f) || 0) + Number(row.observation_count || 0));
    }

    return {
      kingdoms: Array.from(kingdomCounter.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      families: Array.from(familyCounter.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    };
  }, [enriched?.species]);

  const RootContainer = embedded ? 'div' : 'main';

  return (
    <RootContainer className={embedded ? 'pb-2' : 'min-h-screen bg-ocean-gradient pb-20'}>
      {!embedded && <Navbar />}
      {!embedded && <FloatingParticles count={12} />}

      {!embedded && (
      <section className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/10 px-6 py-6 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Environmental Intelligence Platform</p>
            <h1 className="mt-2 text-4xl md:text-5xl font-bold text-text-primary">Biodiversity Intelligence Dashboard</h1>
            <p className="mt-3 max-w-3xl text-text-secondary">
              Research-grade biodiversity analytics for species richness, taxonomic structure, regional ecosystem signals, and conservation intelligence readiness.
            </p>
          </div>
        </div>
      </section>
      )}

      <section className={embedded ? 'px-0 pb-0 relative z-10' : 'px-4 sm:px-6 lg:px-8 pb-10 relative z-10'}>
        <div className={embedded ? 'w-full space-y-6' : 'max-w-7xl mx-auto space-y-6'}>
          {loading && <GlassCard><p className="text-text-secondary">Loading biodiversity intelligence...</p></GlassCard>}
          {error && <GlassCard><p className="text-neon-coral">{error}</p></GlassCard>}

          {!loading && !error && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <GlassCard>
                  <h3 className="text-xl font-bold text-text-primary mb-4">Species Richness Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">Biodiversity Score</p>
                      <p className="mt-2 text-3xl font-bold text-text-primary">{biodiversityScore}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">Species Richness Index</p>
                      <p className="mt-2 text-3xl font-bold text-text-primary">{richnessIndex.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">Shannon Diversity Index</p>
                      <p className="mt-2 text-3xl font-bold text-text-primary">{shannonIndex}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">Simpson Index</p>
                      <p className="mt-2 text-3xl font-bold text-text-primary">{simpsonIndex}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getBadgeTone(dataQuality)}`}>
                      Data Quality: {dataQuality}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getBadgeTone(taxonomyResolution)}`}>
                      Taxonomy Resolution: {taxonomyResolution}
                    </span>
                  </div>
                </GlassCard>

                <GlassCard>
                  <h3 className="text-xl font-bold text-text-primary mb-2">Top Observed Species (Current Biodiversity Window)</h3>
                  {topSpecies.length === 0 ? (
                    <p className="text-sm text-text-secondary">
                      {biodiversity?.no_species_message || 'No taxonomically resolved species records are currently available in the ingested biodiversity datasets. Species-level analytics will activate once validated observations are processed.'}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {topSpecies.slice(0, 20).map((species, index) => (
                        <div key={species.name} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-text-primary">#{index + 1} {species.name}</p>
                          <p className="text-sm font-semibold text-bioluminescent">{species.count.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard>
                  <h3 className="text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
                    <span className="text-cyan">🐠</span> Fish Species Distribution
                  </h3>
                  <div className="space-y-2">
                    <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Tropical Fish Species</span>
                        <span className="text-xs bg-cyan/20 text-cyan px-2 py-1 rounded">High Diversity</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Includes reef fish, wrasse, parrotfish, and surgeonfish</p>
                    </div>
                    <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Deep Sea Fish</span>
                        <span className="text-xs bg-goldenrod/20 text-goldenrod px-2 py-1 rounded">Moderate</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Bioluminescent species, anglerfish, viperfish</p>
                    </div>
                    <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Migratory Fish</span>
                        <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded">Tracked</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Salmon, tuna, mackerel, and herring species</p>
                    </div>
                    <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Commercial Fish</span>
                        <span className="text-xs bg-neon-coral/20 text-neon-coral px-2 py-1 rounded">At Risk</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Cod, halibut, grouper - monitoring overfishing</p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard>
                  <h3 className="text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
                    <span className="text-green-400">🌿</span> Flora & Plant Species
                  </h3>
                  <div className="space-y-2">
                    <div className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Seagrass Meadows</span>
                        <span className="text-xs bg-green-400/20 text-green-400 px-2 py-1 rounded">Critical</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Zostera, Halophila - carbon sinks & nurseries</p>
                    </div>
                    <div className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Kelp & Macroalgae</span>
                        <span className="text-xs bg-green-400/20 text-green-400 px-2 py-1 rounded">High Density</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Giant kelp, brown algae, red algae forests</p>
                    </div>
                    <div className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Mangrove Ecosystems</span>
                        <span className="text-xs bg-goldenrod/20 text-goldenrod px-2 py-1 rounded">Threatened</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Coastal nurseries, salt tolerance specialists</p>
                    </div>
                    <div className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Coastal Vegetation</span>
                        <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded">Monitored</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Salt marshes, beach grass, halophytes</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard>
                  <h3 className="text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
                    <span>🪸</span> Marine Invertebrates & Coral
                  </h3>
                  <div className="space-y-2">
                    <div className="rounded-md border border-secondary/20 bg-secondary/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Hard Coral Species</span>
                        <span className="text-xs bg-neon-coral/20 text-neon-coral px-2 py-1 rounded">Bleaching Risk</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Scleractinia, reef builders, temperature sensitive</p>
                    </div>
                    <div className="rounded-md border border-secondary/20 bg-secondary/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Soft Coral & Octocorals</span>
                        <span className="text-xs bg-cyan/20 text-cyan px-2 py-1 rounded">Stable</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Sea fans, sea pens, xenias</p>
                    </div>
                    <div className="rounded-md border border-secondary/20 bg-secondary/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Mollusks & Cephalopods</span>
                        <span className="text-xs bg-cyan/20 text-cyan px-2 py-1 rounded">Active</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Octopus, squid, clams, oysters</p>
                    </div>
                    <div className="rounded-md border border-secondary/20 bg-secondary/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Crustaceans</span>
                        <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded">Commercial</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Crabs, lobsters, shrimp, krill</p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard>
                  <h3 className="text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
                    <span>🦈</span> Marine Megafauna & Mammals
                  </h3>
                  <div className="space-y-2">
                    <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Sharks & Rays</span>
                        <span className="text-xs bg-neon-coral/20 text-neon-coral px-2 py-1 rounded">Vulnerable</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Great white, reef sharks, manta rays</p>
                    </div>
                    <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Marine Mammals</span>
                        <span className="text-xs bg-goldenrod/20 text-goldenrod px-2 py-1 rounded">Protected</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Whales, dolphins, seals, manatees</p>
                    </div>
                    <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Sea Turtles</span>
                        <span className="text-xs bg-goldenrod/20 text-goldenrod px-2 py-1 rounded">Endangered</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Green, leatherback, hawksbill - migration tracked</p>
                    </div>
                    <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">Seabirds</span>
                        <span className="text-xs bg-cyan/20 text-cyan px-2 py-1 rounded">Monitored</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Penguins, albatross, cormorants, pelicans</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              <GlassCard>
                <h3 className="text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
                  <span>🔬</span> Microorganisms & Plankton
                </h3>
                <p className="text-sm text-text-secondary mb-4">Foundational biodiversity drivers and ecosystem health indicators</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-sm font-semibold text-text-primary mb-2">Phytoplankton</p>
                    <p className="text-xs text-text-secondary">Diatoms, dinoflagellates, coccolithophores - primary producers, oxygen generation</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-sm font-semibold text-text-primary mb-2">Zooplankton</p>
                    <p className="text-xs text-text-secondary">Copepods, krill, larvae - food chain base, nutritional link</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-sm font-semibold text-text-primary mb-2">Bacteria & Archaea</p>
                    <p className="text-xs text-text-secondary">Nutrient cycling, chemosynthesis, methane oxidation, decomposition</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-sm font-semibold text-text-primary mb-2">Marine Fungi & Protists</p>
                    <p className="text-xs text-text-secondary">Decomposers, nutrient remineralization, dispersal vectors</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <h3 className="text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
                  <span>🌍</span> Ecosystem Health Indicators
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-md border border-cyan/20 bg-cyan/5 px-4 py-3">
                    <p className="text-sm font-bold text-cyan mb-2">Biodiversity Index</p>
                    <p className="text-2xl font-bold text-text-primary">{biodiversityScore}/100</p>
                    <p className="text-xs text-text-secondary mt-1">Overall ecosystem health composite</p>
                  </div>
                  <div className="rounded-md border border-secondary/20 bg-secondary/5 px-4 py-3">
                    <p className="text-sm font-bold text-secondary mb-2">Species Interactions</p>
                    <p className="text-2xl font-bold text-text-primary">{Math.round(shannonIndex * 100)}%</p>
                    <p className="text-xs text-text-secondary mt-1">Community evenness & stability</p>
                  </div>
                  <div className="rounded-md border border-goldenrod/20 bg-goldenrod/5 px-4 py-3">
                    <p className="text-sm font-bold text-goldenrod mb-2">Resilience Score</p>
                    <p className="text-2xl font-bold text-text-primary">{Math.round(simpsonIndex * 100)}%</p>
                    <p className="text-xs text-text-secondary mt-1">Resistance to ecosystem disturbances</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <h3 className="text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
                  <span>⚠️</span> Biodiversity Threats & Conservation Status
                </h3>
                <div className="space-y-2">
                  <div className="rounded-md border border-neon-coral/20 bg-neon-coral/5 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">Overfishing Pressure</span>
                      <span className="text-xs font-bold text-neon-coral">HIGH</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">Commercial species decline, ecosystem cascade risk</p>
                  </div>
                  <div className="rounded-md border border-neon-coral/20 bg-neon-coral/5 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">Coral Bleaching Events</span>
                      <span className="text-xs font-bold text-neon-coral">CRITICAL</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">Temperature anomalies triggering symbiote expulsion</p>
                  </div>
                  <div className="rounded-md border border-goldenrod/20 bg-goldenrod/5 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">Habitat Degradation</span>
                      <span className="text-xs font-bold text-goldenrod">MODERATE</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">Pollution, coastal development, altered sediment patterns</p>
                  </div>
                  <div className="rounded-md border border-cyan/20 bg-cyan/5 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">Invasive Species</span>
                      <span className="text-xs font-bold text-cyan">MONITORED</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">Non-native species outcompeting native biodiversity</p>
                  </div>
                </div>
              </GlassCard>
              <div className="grid grid-cols-1 xl:grid-cols-2 items-stretch gap-6">
                <GlassCard>
                  <h3 className="text-xl font-bold text-text-primary mb-2">Taxonomic Distribution (Kingdom → Species)</h3>
                  <p className="text-sm text-text-secondary mb-3">Distribution generated from resolved GBIF-linked taxonomy fields.</p>
                  <div className="space-y-2">
                    {taxonomicDistribution.kingdoms.length === 0 ? (
                      <p className="text-sm text-text-secondary">Taxonomic distribution will activate once biodiversity enrichments are available.</p>
                    ) : (
                      taxonomicDistribution.kingdoms.map((row) => (
                        <div key={row.name} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-between">
                          <span className="text-sm text-text-primary">{row.name}</span>
                          <span className="text-sm font-semibold text-text-primary">{row.count.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </GlassCard>

                <GlassCard>
                  <h3 className="text-xl font-bold text-text-primary mb-2">Region-wise Biodiversity Heatmap</h3>
                  <p className="text-sm text-text-secondary mb-3">Grouped by country, state/province, and ecosystem type.</p>
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {regions.length === 0 ? (
                      <p className="text-sm text-text-secondary">No regional biodiversity distribution is currently available.</p>
                    ) : (
                      regions.slice(0, 24).map((region) => (
                        <div key={region.region} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-text-primary">
                              {(region.country && String(region.country).trim().toLowerCase() !== 'unknown' ? region.country : 'Global')} · {(region.state && String(region.state).trim().toLowerCase() !== 'unknown' ? region.state : 'Coastal Waters')} · {(region.ecosystem_type && String(region.ecosystem_type).trim().toLowerCase() !== 'unknown' ? region.ecosystem_type : 'Marine')}
                            </p>
                            <p className="text-xs text-text-secondary">Index: {(region.biodiversity_index || 0).toFixed(1)}</p>
                          </div>
                          <p className="text-xs text-text-secondary mt-1">
                            {(region.total_species || region.species_count || 0).toLocaleString()} species | {(region.total_observations || region.observation_count || 0).toLocaleString()} observations
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </GlassCard>
              </div>

              <GlassCard>
                <h3 className="text-xl font-bold text-text-primary mb-2">Conservation Status Intelligence</h3>
                <p className="text-sm text-text-secondary mb-3">
                  Source integration: {enriched?.source_integration?.mode || (enriched?.iucn_enabled ? 'GBIF + IUCN Red List' : 'GBIF')}.
                </p>
                {(enriched?.species || []).length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    Conservation enrichment is initializing. Species records will appear as biodiversity observations and taxonomy matches are resolved.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {(enriched?.species || []).slice(0, 20).map((row) => (
                      <div key={row.name} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-text-primary">{row.name}</p>
                          <p className="text-xs text-text-secondary">IUCN: {row.iucn_red_list_category || 'Not available'}</p>
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                          Observations: {row.observation_count.toLocaleString()} | Kingdom: {row.gbif?.kingdom || 'Unclassified'} | Rank: {row.gbif?.rank || 'Unranked'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard>
                <h3 className="text-xl font-bold text-text-primary mb-2">Resolution Confidence & Data Quality</h3>
                <p className="text-sm text-text-secondary mb-3">
                  Species-level confidence is derived from taxonomic resolution completeness and source consistency checks across ingested biodiversity datasets.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">Resolution Confidence</p>
                    <p className="mt-1 text-lg font-bold text-text-primary">{Number(enriched?.data_quality?.resolution_confidence_pct || 0).toFixed(1)}%</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">Taxonomy Resolution</p>
                    <p className="mt-1 text-lg font-bold text-text-primary">{Number(enriched?.data_quality?.taxonomy_resolution_pct || 0).toFixed(1)}%</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">Source Consistency</p>
                    <p className="mt-1 text-lg font-bold text-text-primary">{Number(enriched?.data_quality?.source_consistency_pct || 0).toFixed(1)}%</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">IUCN Coverage</p>
                    <p className="mt-1 text-lg font-bold text-text-primary">{Number(enriched?.data_quality?.iucn_coverage_pct || 0).toFixed(1)}%</p>
                  </div>
                </div>
              </GlassCard>
            </>
          )}
        </div>
      </section>
    </RootContainer>
  );
}
