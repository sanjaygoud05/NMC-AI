/**
 * Common Material Master Catalog Page (Phase 8)
 * Unified golden catalog of governed Common Material Master records across CPSEs
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
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
  Search,
  Database,
  ExternalLink,
  Layers,
  Building2,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { commonMasterService, CommonMaterialRecord, CommonMasterStats } from '@/services/commonMasterService';
import { useDataset } from '@/contexts/DatasetContext';
import { toast } from 'sonner';

export default function CommonMaster() {
  const { activeDatasetId } = useDataset();
  const [materials, setMaterials] = useState<CommonMaterialRecord[]>([]);
  const [stats, setStats] = useState<CommonMasterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const [catData, statsData] = await Promise.all([
        commonMasterService.getCatalog({
          search,
          family: familyFilter,
          governance_status: statusFilter,
          dataset_id: activeDatasetId,
          page,
          page_size: 20,
        }),
        commonMasterService.getStats(activeDatasetId).catch(() => null),
      ]);

      setMaterials(catData.items || []);
      setTotal(catData.total || 0);
      setTotalPages(catData.total_pages || 1);
      if (statsData) setStats(statsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load common material catalog';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [search, familyFilter, statusFilter, page, activeDatasetId]);

  const getGovernanceBadge = (status: string) => {
    switch (status) {
      case 'APPROVED_MASTER':
        return (
          <Badge className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 gap-1 font-mono text-[11px]">
            <ShieldCheck className="h-3 w-3" /> APPROVED MASTER
          </Badge>
        );
      case 'VERIFIED_HARMONIZED':
        return (
          <Badge className="bg-blue-600/20 text-blue-400 border border-blue-500/30 gap-1 font-mono text-[11px]">
            <CheckCircle2 className="h-3 w-3" /> VERIFIED HARMONIZED
          </Badge>
        );
      case 'STANDALONE_CANDIDATE':
        return (
          <Badge className="bg-muted text-muted-foreground border border-border gap-1 font-mono text-[11px]">
            <Layers className="h-3 w-3" /> STANDALONE CANDIDATE
          </Badge>
        );
      case 'AMBIGUOUS_REVIEW_REQUIRED':
        return (
          <Badge className="bg-amber-600/20 text-amber-400 border border-amber-500/30 gap-1 font-mono text-[11px]">
            <AlertTriangle className="h-3 w-3" /> REVIEW REQUIRED
          </Badge>
        );
      case 'SPLIT_CONFLICT':
        return (
          <Badge className="bg-red-600/20 text-red-400 border border-red-500/30 gap-1 font-mono text-[11px]">
            <RotateCcw className="h-3 w-3" /> SPLIT CONFLICT
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Common Material Master Catalog"
          description="Governed multi-CPSE canonical material catalog derived from Phase 7 verified human decisions"
        />

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground font-mono">
                    {stats ? stats.total_common_materials.toLocaleString() : '...'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Total Common Groups</div>
                </div>
                <Database className="h-7 w-7 text-primary/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">
                    {stats ? stats.multi_cpse_harmonized.toLocaleString() : '...'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Multi-CPSE Harmonized</div>
                </div>
                <Building2 className="h-7 w-7 text-emerald-400/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-400 font-mono">
                    {stats ? stats.verified_harmonized.toLocaleString() : '...'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Verified Harmonized</div>
                </div>
                <CheckCircle2 className="h-7 w-7 text-blue-400/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-muted-foreground font-mono">
                    {stats ? stats.total_members_mapped.toLocaleString() : '...'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Source Items Mapped (100%)</div>
                </div>
                <FileSpreadsheet className="h-7 w-7 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Common Code, description, family..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <Select
            value={familyFilter}
            onValueChange={(val) => {
              setFamilyFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Families" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Families</SelectItem>
              {stats?.unique_families.map((fam) => (
                <SelectItem key={fam} value={fam}>
                  {fam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Governance Statuses</SelectItem>
              <SelectItem value="VERIFIED_HARMONIZED">VERIFIED_HARMONIZED</SelectItem>
              <SelectItem value="STANDALONE_CANDIDATE">STANDALONE_CANDIDATE</SelectItem>
              <SelectItem value="AMBIGUOUS_REVIEW_REQUIRED">AMBIGUOUS_REVIEW_REQUIRED</SelectItem>
              <SelectItem value="SPLIT_CONFLICT">SPLIT_CONFLICT</SelectItem>
              <SelectItem value="APPROVED_MASTER">APPROVED_MASTER</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Table */}
        <Card className="border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Common Code</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Synthesized Description</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Family</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">CPSE Coverage</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Members</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Governance Status</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Loading Common Material Master catalog...
                    </TableCell>
                  </TableRow>
                ) : materials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No Common Material records match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  materials.map((m) => (
                    <TableRow key={m.common_material_id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono font-medium text-primary text-xs">
                        <Link
                          to={`/common-master/${encodeURIComponent(m.common_code)}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          {m.common_code}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="text-sm font-medium text-foreground line-clamp-2">
                          {m.common_description}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {m.material_grade && <span className="mr-2">Grade: {m.material_grade}</span>}
                          {m.nominal_size && <span className="mr-2">Size: {m.nominal_size}</span>}
                          {m.standard_spec && <span>Std: {m.standard_spec}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {m.material_family}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.cpse_coverage.map((cpse) => (
                            <Badge
                              key={cpse}
                              className="text-[10px] bg-secondary/80 text-secondary-foreground font-mono px-1.5 py-0"
                            >
                              {cpse}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-medium">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs ${
                            m.member_count > 1
                              ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {m.member_count}
                        </span>
                      </TableCell>
                      <TableCell>{getGovernanceBadge(m.governance_status)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                          <Link to={`/common-master/${encodeURIComponent(m.common_code)}`}>
                            View Provenance
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Showing {materials.length} of {total.toLocaleString()} common material records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs font-mono text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
