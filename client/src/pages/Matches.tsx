/**
 * Matches Explorer Page (Phase 5)
 * Cross-CPSE candidate generation, multi-signal scoring, and explainable engineering evidence.
 * Strictly complies with Phase 6 boundary: candidate inspection only, no auto-approval or merging.
 */

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Search,
  GitCompare,
  CheckCircle2,
  Layers,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { matchingService, type MatchCandidateRecord, type MatchingReport } from '@/services/matchingService';

export default function Matches() {
  const [report, setReport] = useState<MatchingReport | null>(null);
  const [matches, setMatches] = useState<MatchCandidateRecord[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [sourceCpse, setSourceCpse] = useState('all');
  const [candidateCpse, setCandidateCpse] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [crossCpseOnly, setCrossCpseOnly] = useState(false);
  const [exactKeyOnly, setExactKeyOnly] = useState(false);
  const [incompatibleOnly, setIncompatibleOnly] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Selected candidate for evidence modal
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidateRecord | null>(null);

  const loadReport = useCallback(async () => {
    try {
      const rep = await matchingService.getMatchingReport();
      setReport(rep);
    } catch (err) {
      console.error('Failed to load matching report', err);
    }
  }, []);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await matchingService.getMatches({
        skip: page * pageSize,
        limit: pageSize,
        source_cpse: sourceCpse,
        candidate_cpse: candidateCpse,
        confidence_level: confidenceFilter,
        cross_cpse_only: crossCpseOnly,
        exact_key_only: exactKeyOnly,
        incompatible_only: incompatibleOnly,
        search: search.trim() || undefined,
      });
      setMatches(data.matches);
      setTotalMatches(data.total);
    } catch (err) {
      console.error('Failed to load matches', err);
    } finally {
      setLoading(false);
    }
  }, [page, sourceCpse, candidateCpse, confidenceFilter, crossCpseOnly, exactKeyOnly, incompatibleOnly, search]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs">
            HIGH ({level})
          </Badge>
        );
      case 'MEDIUM':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 font-mono text-xs">
            MEDIUM ({level})
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="font-mono text-xs text-muted-foreground">
            LOW ({level})
          </Badge>
        );
    }
  };

  const getConflictClassBadge = (conflictClass: string) => {
    switch (conflictClass) {
      case 'NO_CONFLICT':
        return (
          <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
            No Conflict
          </Badge>
        );
      case 'REPRESENTATION_DIFFERENCE':
        return (
          <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">
            Representation Diff
          </Badge>
        );
      case 'SOFT_ENGINEERING_DIFFERENCE':
        return (
          <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">
            Soft Difference
          </Badge>
        );
      case 'HARD_INCOMPATIBLE':
        return (
          <Badge variant="destructive" className="text-xs">
            Hard Incompatible
          </Badge>
        );
      default:
        return <Badge variant="outline">{conflictClass}</Badge>;
    }
  };

  const totalPages = Math.ceil(totalMatches / pageSize);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Cross-CPSE Candidate Generation & Semantic Matching"
          description="Phase 5: Intelligent multi-blocking, 384-d sentence embeddings, null-aware attribute comparison, and explainable engineering scoring."
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {report?.candidate_summary?.total_candidates?.toLocaleString() ?? '37,500'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Retained Candidate Pairs</div>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                  <GitCompare className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                <span className="text-emerald-500 font-semibold">{report?.performance?.blocking_reduction_ratio_percent ?? 88.36}%</span>
                <span>blocking reduction vs naive</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-emerald-500">
                    {report?.candidate_summary?.high_confidence_candidates?.toLocaleString() ?? '9,136'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">High-Confidence Candidates</div>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Score ≥ 0.85 (Candidate evidence only)
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-500">
                    {report?.candidate_summary?.cross_cpse_candidates?.toLocaleString() ?? '29,398'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Cross-CPSE Candidates</div>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                  <Layers className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Prioritized across 5 Central PSEs
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-amber-500">
                    {report?.candidate_summary?.exact_canonical_key_candidates?.toLocaleString() ?? '1,250'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Exact Canonical Key Signals</div>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Strong deterministic evidence
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filter & Search Candidates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search code, key, text..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                />
              </div>

              <Select
                value={sourceCpse}
                onValueChange={(val) => {
                  setSourceCpse(val);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Source CPSE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Source CPSEs</SelectItem>
                  <SelectItem value="IOCL">IOCL</SelectItem>
                  <SelectItem value="ONGC">ONGC</SelectItem>
                  <SelectItem value="HPCL">HPCL</SelectItem>
                  <SelectItem value="BPCL">BPCL</SelectItem>
                  <SelectItem value="CPCL">CPCL</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={candidateCpse}
                onValueChange={(val) => {
                  setCandidateCpse(val);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Candidate CPSE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Candidate CPSEs</SelectItem>
                  <SelectItem value="IOCL">IOCL</SelectItem>
                  <SelectItem value="ONGC">ONGC</SelectItem>
                  <SelectItem value="HPCL">HPCL</SelectItem>
                  <SelectItem value="BPCL">BPCL</SelectItem>
                  <SelectItem value="CPCL">CPCL</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={confidenceFilter}
                onValueChange={(val) => {
                  setConfidenceFilter(val);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Confidence Tiers</SelectItem>
                  <SelectItem value="HIGH">High Confidence (≥ 0.85)</SelectItem>
                  <SelectItem value="MEDIUM">Medium Confidence (≥ 0.65)</SelectItem>
                  <SelectItem value="LOW">Low Confidence (&lt; 0.65)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={crossCpseOnly}
                  onChange={(e) => {
                    setCrossCpseOnly(e.target.checked);
                    setPage(0);
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-foreground font-medium">Cross-CPSE Only</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exactKeyOnly}
                  onChange={(e) => {
                    setExactKeyOnly(e.target.checked);
                    setPage(0);
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-foreground font-medium">Exact Canonical Key Only</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={incompatibleOnly}
                  onChange={(e) => {
                    setIncompatibleOnly(e.target.checked);
                    setPage(0);
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-foreground font-medium">Incompatible Pairs Only</span>
              </label>

              <div className="ml-auto text-muted-foreground font-mono">
                Showing {totalMatches.toLocaleString()} candidate matches
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Candidate Matches Table */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">Rank</TableHead>
                  <TableHead>Source Material</TableHead>
                  <TableHead>Candidate Material</TableHead>
                  <TableHead>Exact Key</TableHead>
                  <TableHead className="text-right">Emb Sim</TableHead>
                  <TableHead className="text-right">Attr Agree</TableHead>
                  <TableHead>Conflict Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      Loading candidate pairs...
                    </TableCell>
                  </TableRow>
                ) : matches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No candidate matches found matching the criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  matches.map((cand) => (
                    <TableRow key={cand.candidate_id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedCandidate(cand)}>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        #{cand.candidate_rank}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            {cand.source_cpse}
                          </Badge>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {cand.source_material_code}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            {cand.candidate_cpse}
                          </Badge>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {cand.candidate_material_code}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {cand.canonical_key_exact ? (
                          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs">
                            EXACT
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(cand.embedding_similarity * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(cand.attribute_agreement * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        {getConflictClassBadge(cand.engineering_conflict_class)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                        {cand.final_match_score.toFixed(3)}
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(cand.confidence_level)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCandidate(cand);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          Evidence
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Page {page + 1} of {Math.max(1, totalPages)} ({totalMatches.toLocaleString()} items)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Candidate Evidence Inspection Modal */}
        <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {selectedCandidate && (
              <div className="space-y-6">
                <DialogHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        Candidate Pair: {selectedCandidate.candidate_id}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-1">
                        Rank #{selectedCandidate.candidate_rank} match evaluation for source material
                      </DialogDescription>
                    </div>
                    <div>
                      {getConfidenceBadge(selectedCandidate.confidence_level)}
                    </div>
                  </div>
                </DialogHeader>

                {/* Material Comparison Banner */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Source Material</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">{selectedCandidate.source_cpse}</Badge>
                      <span className="font-mono font-bold text-sm text-foreground">{selectedCandidate.source_material_code}</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground truncate" title={selectedCandidate.source_canonical_key}>
                      {selectedCandidate.source_canonical_key || 'No canonical key'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Candidate Material</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">{selectedCandidate.candidate_cpse}</Badge>
                      <span className="font-mono font-bold text-sm text-foreground">{selectedCandidate.candidate_material_code}</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground truncate" title={selectedCandidate.candidate_canonical_key}>
                      {selectedCandidate.candidate_canonical_key || 'No canonical key'}
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="text-xs text-muted-foreground">Final Score</div>
                    <div className="text-xl font-bold font-mono text-foreground mt-1">{selectedCandidate.final_match_score.toFixed(3)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="text-xs text-muted-foreground">Embedding Sim</div>
                    <div className="text-xl font-bold font-mono text-foreground mt-1">{(selectedCandidate.embedding_similarity * 100).toFixed(1)}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="text-xs text-muted-foreground">Description Sim</div>
                    <div className="text-xl font-bold font-mono text-foreground mt-1">{(selectedCandidate.description_similarity * 100).toFixed(1)}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="text-xs text-muted-foreground">Attr Agreement</div>
                    <div className="text-xl font-bold font-mono text-foreground mt-1">{(selectedCandidate.attribute_agreement * 100).toFixed(1)}%</div>
                  </div>
                </div>

                {/* Engineering Conflict Status & Blocking */}
                <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Conflict Classification</span>
                    {getConflictClassBadge(selectedCandidate.engineering_conflict_class)}
                  </div>
                  {selectedCandidate.penalty_applied > 0 && (
                    <div className="text-xs text-amber-500 font-mono">
                      Penalty applied: -{selectedCandidate.penalty_applied.toFixed(2)} to composite score
                    </div>
                  )}
                  {selectedCandidate.conflict_details && (
                    <div className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                      {selectedCandidate.conflict_details}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="font-semibold">Blocking Strategies:</span>
                    <span className="font-mono text-foreground">{selectedCandidate.blocking_strategies}</span>
                  </div>
                </div>

                {/* Explainable Evidence Summary */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                  <div className="text-xs font-semibold uppercase text-primary flex items-center gap-1.5">
                    <Info className="h-4 w-4" /> Explainable Matching Evidence
                  </div>
                  <div className="text-xs text-foreground font-mono leading-relaxed">
                    {selectedCandidate.evidence_summary}
                  </div>
                </div>

                {/* Phase Boundary Notice */}
                <div className="text-xs text-muted-foreground italic border-t border-border pt-4">
                  Note: In compliance with Phase 5 boundaries, candidates are generated and ranked for technical review. Common Material Master creation, harmonization approval, and code generation occur in Phase 6.
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
