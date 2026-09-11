/**
 * Common Master Detail Page (Phase 8)
 * Deep technical inspection of a Common Material Master record,
 * member CPSE provenance trail, consolidated attributes, and human governance actions.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Database,
  Building2,
  ShieldCheck,
  AlertTriangle,
  Layers,
  FileCode,
  Key,
  Hash,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import { commonMasterService, CommonMaterialRecord } from '@/services/commonMasterService';
import { useDataset } from '@/contexts/DatasetContext';
import { toast } from 'sonner';

export default function CommonMasterDetail() {
  const { commonCode } = useParams<{ commonCode: string }>();
  const { activeDatasetId } = useDataset();
  const [material, setMaterial] = useState<CommonMaterialRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetail = async () => {
    if (!commonCode) return;
    try {
      setLoading(true);
      const data = await commonMasterService.getDetail(commonCode, activeDatasetId);
      setMaterial(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load common material details';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [commonCode, activeDatasetId]);

  const handleGovernanceApproval = async () => {
    if (!material) return;
    if (!rationale.trim() || rationale.trim().length < 10) {
      toast.error('Mandatory governance justification required (minimum 10 characters)');
      return;
    }

    try {
      setSubmitting(true);
      const updated = await commonMasterService.updateGovernanceStatus(
        material.common_material_id,
        {
          new_status: 'APPROVED_MASTER',
          rationale: rationale.trim(),
        }
      );
      setMaterial(updated);
      setRationale('');
      toast.success(`Common Material ${updated.common_code} approved as APPROVED_MASTER`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Governance sign-off failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="py-24 text-center text-muted-foreground">
          Loading common material master provenance...
        </div>
      </AppLayout>
    );
  }

  if (!material) {
    return (
      <AppLayout>
        <div className="space-y-4 py-12 text-center">
          <div className="text-xl font-semibold text-foreground">Common Material Record Not Found</div>
          <Button asChild variant="outline">
            <Link to="/common-master">Back to Catalog</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Link to="/common-master">
              <ArrowLeft className="h-4 w-4" />
              Back to Catalog
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-mono text-primary">
                {material.common_code}
              </h1>
              <Badge
                className={`font-mono text-xs ${
                  material.governance_status === 'APPROVED_MASTER'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                }`}
              >
                {material.governance_status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">{material.common_description}</p>
          </div>
        </div>

        {/* Identity & Technical Attributes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border bg-card md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Consolidated Technical Specifications
              </CardTitle>
              <CardDescription>
                Authoritative parameters derived deterministically without probabilistic invention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm font-mono">
                <div className="p-2.5 rounded bg-muted/30 border border-border">
                  <div className="text-[11px] text-muted-foreground uppercase">Family</div>
                  <div className="font-semibold mt-0.5">{material.material_family || '—'}</div>
                </div>
                <div className="p-2.5 rounded bg-muted/30 border border-border">
                  <div className="text-[11px] text-muted-foreground uppercase">Type</div>
                  <div className="font-semibold mt-0.5">{material.material_type || '—'}</div>
                </div>
                <div className="p-2.5 rounded bg-muted/30 border border-border">
                  <div className="text-[11px] text-muted-foreground uppercase">Grade</div>
                  <div className="font-semibold mt-0.5">{material.material_grade || '—'}</div>
                </div>
                <div className="p-2.5 rounded bg-muted/30 border border-border">
                  <div className="text-[11px] text-muted-foreground uppercase">Size</div>
                  <div className="font-semibold mt-0.5">{material.nominal_size || '—'}</div>
                </div>
                <div className="p-2.5 rounded bg-muted/30 border border-border">
                  <div className="text-[11px] text-muted-foreground uppercase">Pressure / Rating</div>
                  <div className="font-semibold mt-0.5">{material.pressure_rating || '—'}</div>
                </div>
                <div className="p-2.5 rounded bg-muted/30 border border-border">
                  <div className="text-[11px] text-muted-foreground uppercase">Standard / Spec</div>
                  <div className="font-semibold mt-0.5">{material.standard_spec || '—'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                Governance & Cryptographic Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs font-mono">
              <div>
                <div className="text-muted-foreground">Identity Hash:</div>
                <div className="truncate text-foreground font-mono bg-muted/50 p-1.5 rounded mt-0.5">
                  {material.group_identity_hash}
                </div>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Contributing CPSEs:</span>
                <span className="font-semibold">
                  {Array.isArray(material.cpse_coverage)
                    ? material.cpse_coverage.join(', ')
                    : String(material.cpse_coverage || 'N/A')}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Mapped Members:</span>
                <span className="font-semibold">{material.member_count} item(s)</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Confidence Score:</span>
                <span className="font-semibold">{material.group_confidence.toFixed(3)}</span>
              </div>
              {material.approved_by && (
                <div className="pt-1">
                  <div className="text-emerald-400 font-semibold flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Signed Off By:
                  </div>
                  <div className="text-muted-foreground truncate">{material.approved_by}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{material.approved_at}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Member Materials Provenance Table */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Source Material Members & Decision Provenance
            </CardTitle>
            <CardDescription>
              Complete lineage tracking every member code back to original CPSE records, Phase 7 human reviewers, and evidence snapshot hashes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold text-xs uppercase">Source Code</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">CPSE</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Original Description</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Membership</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Phase 7 Reviewers</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Evidence Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {material.members.map((mem) => (
                    <TableRow key={mem.id} className="font-mono text-xs">
                      <TableCell className="font-bold text-primary">{mem.source_material_code}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{mem.source_cpse}</Badge>
                      </TableCell>
                      <TableCell className="font-sans max-w-xs">{mem.source_description}</TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] ${
                            mem.membership_type === 'DIRECT_ACCEPTED'
                              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                              : mem.membership_type === 'TRANSITIVE_VERIFIED'
                              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {mem.membership_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {mem.reviewer_ids.length > 0 ? mem.reviewer_ids.join(', ') : 'Direct Master Profile'}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-muted-foreground">
                        {mem.evidence_snapshot_hashes.length > 0
                          ? mem.evidence_snapshot_hashes[0]
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Human Governance Sign-Off Action Panel */}
        {material.governance_status !== 'APPROVED_MASTER' && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Phase 8 Human Governance Sign-Off
              </CardTitle>
              <CardDescription>
                Authorized lead domain engineers and governance admins may grant formal APPROVED_MASTER sign-off
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Governance Approval Rationale (Mandatory, minimum 10 characters):
                </label>
                <Textarea
                  placeholder="Enter engineering justification for certifying this common material as approved golden catalog master..."
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  className="font-sans text-sm min-h-[80px]"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleGovernanceApproval}
                  disabled={submitting || rationale.trim().length < 10}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Certify as APPROVED_MASTER
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
