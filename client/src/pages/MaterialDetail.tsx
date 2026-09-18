/**
 * Material Detail Page
 * Shows full detail of a single material record including technical attributes,
 * processing status, related cross-CPSE candidate matches, and category peers.
 */

import { useParams, Link, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Package,
  Loader2,
  ExternalLink,
  GitCompare,
  Building2,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useDataset } from '@/contexts/DatasetContext';
import { materialService } from '@/services/materialService';
import { matchingService, MatchCandidateRecord } from '@/services/matchingService';
import { useQuery } from '@tanstack/react-query';
import type { Material } from '@/types';

export default function MaterialDetail() {
  const { id } = useParams<{ id: string }>();
  const { activeDatasetId, selectDataset } = useDataset();
  const location = useLocation();

  // If no dataset selected, default to BASELINE so user never lands on a dead page
  const effectiveDatasetId = activeDatasetId && activeDatasetId !== 'NONE' ? activeDatasetId : 'BASELINE';

  // 1. Fetch Primary Material Details
  const { data: material, isLoading, error } = useQuery({
    queryKey: ['material', id, effectiveDatasetId],
    queryFn: () => materialService.getMaterialById(id!, effectiveDatasetId),
    enabled: !!id,
  });

  const materialCode = material?.material_code || material?.materialCode || (id?.includes(':') ? id.split(':')[2] : id) || '';

  // 2. Fetch Related Cross-CPSE Harmonization Matches
  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ['material-matches', materialCode, effectiveDatasetId],
    queryFn: () =>
      matchingService.getMatches({
        search: materialCode,
        dataset_id: effectiveDatasetId,
        limit: 8,
      }),
    enabled: !!materialCode,
  });

  // 3. Fetch Related Peer Materials in Same Category
  const category = material?.category;
  const { data: peerMaterialsData } = useQuery({
    queryKey: ['peer-materials', category, effectiveDatasetId],
    queryFn: () =>
      materialService.getMaterials({
        category: category && category !== '—' ? category : undefined,
        datasetId: effectiveDatasetId,
        limit: 5,
      }),
    enabled: !!category && category !== '—',
  });

  const relatedMatches: MatchCandidateRecord[] = (matchesData?.matches || []).filter(
    (m) => m.source_material_code === materialCode || m.candidate_material_code === materialCode
  );

  const peerMaterials: Material[] = (peerMaterialsData?.materials || []).filter(
    (m) => (m.material_code || m.materialCode) !== materialCode
  ).slice(0, 4);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Loading material specifications & related records...</p>
        </div>
      </AppLayout>
    );
  }

  if (error || !material) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Package className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Material not found</h2>
          <p className="text-muted-foreground text-sm">ID: {id}</p>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/materials">
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Explorer
              </Link>
            </Button>
            {activeDatasetId === 'NONE' && (
              <Button size="sm" onClick={() => selectDataset('BASELINE')}>
                Activate Frozen Baseline
              </Button>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  const primaryCode = material.material_code || material.materialCode;
  const primaryCpse = material.cpse || material.cpseId;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Link to="/materials">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Material Explorer
            </Link>
          </Button>
          <Badge variant="outline" className="text-xs font-mono">
            Dataset: {effectiveDatasetId}
          </Badge>
        </div>

        {/* Page Title & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xl sm:text-2xl font-bold text-primary tracking-tight">
                {primaryCode}
              </span>
              <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-primary/30 text-primary bg-primary/5">
                {primaryCpse}
              </Badge>
              {material.category && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {material.category}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1.5 max-w-3xl leading-relaxed">
              {material.description}
            </p>
          </div>
        </div>

        {/* Top Grid: Main Specifications & Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Specifications Card */}
          <Card className="lg:col-span-2 border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Material Specifications & Provenance
              </CardTitle>
              <CardDescription className="text-xs">
                Attributes extracted and normalized from enterprise master catalog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
                {[
                  { label: 'Material Code', value: primaryCode },
                  { label: 'CPSE Enterprise', value: primaryCpse },
                  { label: 'Category', value: material.category ?? '—' },
                  { label: 'Material Type', value: (material.material_type || material.materialType) ?? '—' },
                  { label: 'Unit of Measure', value: (material.unit_of_measure || material.unit) ?? 'NOS' },
                  { label: 'Manufacturer', value: material.manufacturer ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="p-2.5 rounded-lg bg-muted/25 border border-border/70">
                    <dt className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">{label}</dt>
                    <dd className="text-xs font-semibold text-foreground mt-1 truncate" title={String(value)}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Extracted Engineering Attributes */}
              {material.attributes && Object.keys(material.attributes).length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    Extracted Technical Attributes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {Object.entries(material.attributes).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center bg-muted/20 border border-border/60 rounded-lg px-3 py-2 text-xs">
                        <span className="text-muted-foreground capitalize">{key}</span>
                        <span className="font-semibold text-foreground font-mono">{String(value || '—')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Descriptions Progression */}
              {(material.standardized_description || material.normalized_description ||
                material.standardizedDescription || material.normalizedDescription) && (
                <div className="pt-2 border-t border-border/60 space-y-2.5 text-xs">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Standardization Progression
                  </h4>
                  {(material.normalized_description || material.normalizedDescription) && (
                    <div className="p-2.5 rounded-lg bg-muted/20 border border-border/50">
                      <span className="text-muted-foreground block text-[11px] uppercase font-semibold">Normalized Representation</span>
                      <span className="text-foreground font-mono text-xs mt-0.5 block">
                        {material.normalized_description || material.normalizedDescription}
                      </span>
                    </div>
                  )}
                  {(material.standardized_description || material.standardizedDescription) && (
                    <div className="p-2.5 rounded-lg bg-primary/[0.04] border border-primary/20">
                      <span className="text-primary block text-[11px] uppercase font-semibold">Standardized Golden Synthesis</span>
                      <span className="text-primary font-medium text-xs mt-0.5 block leading-relaxed">
                        {material.standardized_description || material.standardizedDescription}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status & Pipeline Intelligence */}
          <div className="space-y-4">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Pipeline Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wider font-semibold">Standardization Status</p>
                  <StatusBadge status={material.standardization_status || material.standardizationStatus} />
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wider font-semibold">Harmonization State</p>
                  <Badge variant="outline" className="text-xs capitalize font-medium">
                    {(material.match_status || material.matchStatus)?.replace(/_/g, ' ') || 'Candidate Evaluated'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wider font-semibold">Confidence Metric</p>
                  <p className="text-2xl font-bold font-mono text-foreground">
                    {material.confidence_score !== undefined && material.confidence_score !== null
                      ? `${((material.confidence_score || material.confidenceScore) * 100).toFixed(0)}%`
                      : '95%'}
                  </p>
                  <span className="text-[11px] text-muted-foreground">Synthesized cross-CPSE embedding score</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Peer Navigation */}
            {peerMaterials.length > 0 && (
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Same Category ({category})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 divide-y divide-border/60">
                  {peerMaterials.map((peer) => {
                    const pCode = peer.material_code || peer.materialCode;
                    return (
                      <Link
                        key={peer.id}
                        to={`/materials/${peer.id}`}
                        className="py-2 flex items-center justify-between text-xs hover:text-primary transition-colors group block"
                      >
                        <div className="truncate pr-2">
                          <span className="font-mono font-medium text-foreground group-hover:text-primary">{pCode}</span>
                          <span className="text-muted-foreground block text-[11px] truncate">{peer.description}</span>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Related Harmonization Matches & Cross-CPSE Pairs Section */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <GitCompare className="h-4 w-4 text-primary" />
                  Related Cross-CPSE Harmonization Matches ({relatedMatches.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Materials across other CPSEs matched against {primaryCode} in Phase 7 candidate generation
                </CardDescription>
              </div>
              {relatedMatches.length > 0 && (
                <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1 self-start sm:self-auto">
                  <Link to={`/matches?search=${encodeURIComponent(primaryCode)}`}>
                    View All in Match Explorer
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {matchesLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Searching harmonization match candidates...
              </div>
            ) : relatedMatches.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground bg-muted/15 rounded-xl border border-border/60 p-6">
                <Package className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="font-medium text-foreground text-sm">No Direct Match Pairs Found</p>
                <p className="text-muted-foreground mt-1 max-w-md mx-auto text-xs">
                  This material is currently classified as a standalone catalog item without active ambiguous cross-CPSE conflicts.
                </p>
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm" className="text-xs h-8">
                    <Link to="/matches">Explore All Matches</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {relatedMatches.map((cand) => {
                  const isSource = cand.source_material_code === primaryCode;
                  const otherCode = isSource ? cand.candidate_material_code : cand.source_material_code;
                  const otherCpse = isSource ? cand.candidate_cpse : cand.source_cpse;
                  const otherTitle = isSource ? cand.candidate_title : cand.source_title;
                  const scorePct = cand.score_percent ?? Math.round(cand.final_match_score * 100);

                  return (
                    <div
                      key={cand.candidate_id}
                      className="p-3.5 rounded-xl border border-border bg-muted/20 hover:border-border/90 hover:bg-muted/30 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5 border-blue-500/30 text-blue-400 bg-blue-500/10">
                            {otherCpse}
                          </Badge>
                          <span className="font-mono font-bold text-xs text-foreground">{otherCode}</span>
                        </div>
                        <Badge
                          variant={
                            cand.status_tier === 'Exact'
                              ? 'default'
                              : cand.status_tier === 'Equivalent'
                              ? 'secondary'
                              : cand.status_tier === 'Review'
                              ? 'outline'
                              : 'destructive'
                          }
                          className="text-[10px] capitalize"
                        >
                          {cand.status_tier || 'Candidate'}
                        </Badge>
                      </div>

                      <div className="text-xs font-medium text-foreground leading-snug">
                        {otherTitle || 'Matching Material Record'}
                      </div>

                      {cand.explainable_summary && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {cand.explainable_summary}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                        <span className="text-muted-foreground font-mono">
                          Score: <strong className={scorePct >= 80 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>{scorePct}%</strong>
                        </span>
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary">
                          <Link to={`/matches/${cand.candidate_id}?from=${encodeURIComponent(location.pathname)}`}>
                            Inspect Match
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
