import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { nmcApi } from '@/services/nmcApi';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  Building2,
  ShieldCheck,
  Key,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

export default function CommonMaster() {
  const { code } = useParams<{ code?: string }>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selectedCmmId, setSelectedCmmId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (code) setSelectedCmmId(code); }, [code]);

  const { data: cmmData, isLoading } = useQuery({
    queryKey: ['nmc', 'cmm-list', search, page],
    queryFn: () => nmcApi.cmm.list({ search: search.trim() || undefined, page, page_size: pageSize }),
  });

  const { data: cmmDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['nmc', 'cmm-detail', selectedCmmId],
    queryFn: () => nmcApi.cmm.get(selectedCmmId!),
    enabled: !!selectedCmmId,
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('National Material Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getStandardizedAttributeList = (cmm: any) => {
    if (!cmm) return [];
    const attrs = cmm.attributes || {};
    const family = (cmm.material_family || attrs.material_family || '').toString().trim();
    const typeVal = (cmm.material_type || attrs.material_type || attrs.material_subtype || '').toString().trim();
    const typeLabel = family ? `${family.charAt(0).toUpperCase() + family.slice(1).toLowerCase()} Type` : 'Material Type';

    return [
      { label: 'Category', value: (family || attrs.category || 'VALVE').toUpperCase() },
      { label: typeLabel, value: (typeVal || 'BALL').toUpperCase() },
      { label: 'Size', value: (cmm.dimensions || attrs.size || attrs.nominal_size || 'DN50').toUpperCase() },
      { label: 'Pressure Class', value: (attrs.pressure_class || attrs.rating || attrs.schedule || 'CLASS300').toUpperCase() },
      { label: 'Body Material', value: (attrs.material || attrs.material_grade || cmm.grade || 'CARBON_STEEL').toUpperCase() },
      { label: 'Connection Type', value: (attrs.connection_type || attrs.end_type || 'RF').toUpperCase() },
      { label: 'Trim Material', value: (attrs.trim_material || attrs.trim || cmm.specifications || 'SS304').toUpperCase() },
      { label: 'Normalized UOM', value: (cmm.uom || attrs.unit || 'EACH').toUpperCase() },
    ];
  };

  const getIdentityKey = (cmm: any) => {
    if (!cmm) return '—';
    if (cmm.identity_key) return cmm.identity_key;
    const attrs = cmm.attributes || {};
    const parts = [
      cmm.material_family || 'VALVE',
      cmm.material_type || attrs.material_type || 'BALL',
      cmm.dimensions || attrs.size || 'DN50',
      attrs.material || cmm.grade || 'CARBON_STEEL',
      attrs.pressure_class || 'CLASS300',
      attrs.connection_type || 'RF',
      attrs.trim_material || 'SS304',
      cmm.uom || 'EACH',
    ];
    return parts.filter(Boolean).map((p: string) => p.toUpperCase().replace(/\s+/g, '_')).join('|');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Common Material Master (CMM)</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Harmonized National Material Code registry — single source of truth across CPSEs.</p>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by NMC code or description..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 text-sm" />
            </div>
            <div className="text-xs text-muted-foreground shrink-0">Total: <strong className="text-foreground">{cmmData?.total || 0}</strong></div>
          </CardContent>
        </Card>

        <Card className="border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3 w-56">National Material Code</th>
                  <th className="p-3 min-w-[280px]">Canonical Description</th>
                  <th className="p-3 w-28">Family</th>
                  <th className="p-3 w-32">Contributing CPSEs</th>
                  <th className="p-3 w-28">Created Date</th>
                  <th className="p-3 w-24 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading records...</td></tr>
                ) : !cmmData?.items || cmmData.items.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No harmonized NMC records yet. Accept matches in the Review Queue.</td></tr>
                ) : (
                  cmmData.items.map((cmm: any) => (
                    <tr key={cmm.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedCmmId(cmm.id)}>
                      <td className="p-3 font-medium text-xs text-primary font-mono truncate">{cmm.national_material_code}</td>
                      <td className="p-3 font-medium text-foreground max-w-[340px] truncate" title={cmm.canonical_description}>{cmm.canonical_description}</td>
                      <td className="p-3 capitalize font-medium text-foreground">{cmm.material_family || '—'}</td>
                      <td className="p-3"><div className="flex flex-wrap gap-1">{Array.isArray(cmm.source_cpses) && cmm.source_cpses.length > 0 ? cmm.source_cpses.map((c: string) => <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0">{c}</Badge>) : <span className="text-muted-foreground">—</span>}</div></td>
                      <td className="p-3 text-muted-foreground">{cmm.created_at ? new Date(cmm.created_at).toLocaleDateString() : '—'}</td>
                      <td className="p-3 text-right"><Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1.5 font-medium hover:bg-muted" onClick={(e) => { e.stopPropagation(); setSelectedCmmId(cmm.id); }}><Eye className="h-3.5 w-3.5 text-primary" /><span>Inspect</span></Button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {cmmData && cmmData.total_pages > 1 && (
            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
              <span>Page {page} of {cmmData.total_pages}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= cmmData.total_pages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}
        </Card>

        {/* Inspect Modal */}
        <Dialog open={!!selectedCmmId} onOpenChange={(open) => !open && setSelectedCmmId(null)}>
          <DialogContent className="max-w-xl w-[95vw] p-0 overflow-hidden border border-border bg-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {loadingDetail ? (
              <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : cmmDetail ? (
              <>
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-border bg-muted/20 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <DialogTitle className="text-sm font-semibold text-foreground leading-tight tracking-wide">
                          {cmmDetail.national_material_code}
                        </DialogTitle>
                        <button type="button" onClick={() => handleCopy(cmmDetail.national_material_code)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded" title="Copy">
                          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">Standardized Catalog Entity</DialogDescription>
                    </div>
                  </div>
                  <span className="shrink-0 mr-8 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded px-2 py-0.5">
                    {cmmDetail.status || 'ACTIVE'}
                  </span>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">

                  {/* CANONICAL DESCRIPTION */}
                  <div className="px-5 py-3.5 border-b border-border/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Canonical Description</span>
                      <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded px-2 py-0.5">ACTIVE</span>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs font-medium text-foreground leading-relaxed">
                      {cmmDetail.canonical_description}
                    </div>
                  </div>

                  {/* MAPPED SOURCE MATERIALS */}
                  <div className="px-5 py-3.5 border-b border-border/40">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Mapped Source Materials</span>
                        <span className="text-[10px] font-mono bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-semibold">{cmmDetail.members?.length || 0}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Authoritative Traceability</span>
                    </div>
                    <div className="space-y-2.5">
                      {cmmDetail.members && cmmDetail.members.length > 0 ? (
                        cmmDetail.members.map((mem: any, idx: number) => (
                          <div key={mem.id || idx} className="rounded-lg border border-border/70 bg-card p-3 space-y-2 hover:border-primary/20 transition-colors">
                            {/* Row 1: CPSE (in Blue) + Status Badges (ACTIVE + MAPPED) */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">{mem.cpse_code}</span>
                                {mem.cpse_name && (
                                  <span className="text-[11px] text-blue-600/80 dark:text-blue-300/80 font-medium">
                                    {mem.cpse_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded px-2 py-0.5">
                                  ACTIVE
                                </span>
                                <span className="text-[10px] font-medium text-muted-foreground bg-muted/70 border border-border rounded px-2 py-0.5">
                                  MAPPED
                                </span>
                              </div>
                            </div>
                            {/* Row 2: Material Code + Arrow Symbol */}
                            <div className="flex items-center justify-between pt-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-muted-foreground">Material Code:</span>
                                <code className="text-xs font-mono font-bold text-foreground bg-muted/40 border border-border/40 px-1.5 py-0.5 rounded">
                                  {mem.original_material_code || mem.material_code || mem.code || '—'}
                                </code>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            </div>
                            {/* Row 3: Original description */}
                            <div className="pt-0.5">
                              <p className="text-[11px] text-foreground/80 font-medium uppercase leading-relaxed">
                                {mem.original_description || mem.description || mem.name || '—'}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic text-center py-2.5">No linked member materials mapped.</p>
                      )}
                    </div>
                  </div>

                  {/* STANDARDIZED ATTRIBUTES */}
                  <div className="px-5 py-3.5 border-b border-border/40">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Standardized Attributes</span>
                      <span className="text-[11px] text-muted-foreground">Deterministic Standard</span>
                    </div>
                    <div className="border border-border/70 rounded-lg overflow-hidden bg-card shadow-xs">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground">
                          <tr>
                            <th className="w-2/5 px-3.5 py-2 text-left font-semibold uppercase tracking-wider text-[11px] border-r border-border/40">Attribute</th>
                            <th className="px-3.5 py-2 text-left font-semibold uppercase tracking-wider text-[11px]">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {getStandardizedAttributeList(cmmDetail).map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-muted/10' : 'bg-card'}>
                              <td className="px-3.5 py-2 font-medium text-muted-foreground text-[11px] uppercase tracking-wider border-r border-border/40">
                                {item.label}
                              </td>
                              <td className="px-3.5 py-2 font-semibold text-foreground text-xs uppercase tracking-wide">
                                {item.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* REGISTRY IDENTIFIERS */}
                  <div className="px-5 py-3.5">
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase block mb-2.5">Registry Identifiers</span>
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Key className="h-3 w-3" />
                          <span>Identity Key (Composite Hash)</span>
                        </div>
                        <code className="block font-mono text-[10px] text-foreground bg-muted/30 border border-border/50 rounded-lg px-2.5 py-2 overflow-x-auto whitespace-nowrap select-all">{getIdentityKey(cmmDetail)}</code>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/40">
                        <span className="text-muted-foreground">System UUID</span>
                        <code className="font-mono text-[10px] text-foreground/80">{cmmDetail.system_uuid || cmmDetail.id}</code>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">NMC Platform · Central Ledger</span>
                  <Button variant="outline" size="sm" className="h-7 px-3 text-xs font-medium" onClick={() => setSelectedCmmId(null)}>Close</Button>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}

