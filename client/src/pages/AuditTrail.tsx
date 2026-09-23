import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { nmcApi } from '@/services/nmcApi';
import { ShieldCheck, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export default function AuditTrail() {
  const [selectedActor, setSelectedActor] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['nmc', 'audit-logs', selectedActor, selectedAction, page],
    queryFn: () =>
      nmcApi.audit.list({
        actor: selectedActor === 'ALL' ? undefined : selectedActor,
        action: selectedAction === 'ALL' ? undefined : selectedAction,
        page,
        page_size: pageSize,
      }),
  });

  return (
    <AppLayout requireReviewer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Platform Governance & Audit Trail
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Append-only immutable record of all CPSE uploads, normalization runs, AI matching triggers, and reviewer decisions.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="border-border/60">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedActor}
                onValueChange={(val) => {
                  setSelectedActor(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px] h-9 text-xs">
                  <SelectValue placeholder="Actor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actors</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="System">System</SelectItem>
                  <SelectItem value="Reviewer">Reviewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select
              value={selectedAction}
              onValueChange={(val) => {
                setSelectedAction(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px] h-9 text-xs">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Actions</SelectItem>
                <SelectItem value="CPSE_CREATED">CPSE_CREATED</SelectItem>
                <SelectItem value="DATASET_UPLOADED">DATASET_UPLOADED</SelectItem>
                <SelectItem value="DATASET_NORMALIZED">DATASET_NORMALIZED</SelectItem>
                <SelectItem value="MATCHING_STARTED">MATCHING_STARTED</SelectItem>
                <SelectItem value="MATCHING_COMPLETED">MATCHING_COMPLETED</SelectItem>
                <SelectItem value="MATCH_ACCEPTED">MATCH_ACCEPTED</SelectItem>
                <SelectItem value="MATCH_REJECTED">MATCH_REJECTED</SelectItem>
                <SelectItem value="MATCH_DIFFERENT">MATCH_DIFFERENT</SelectItem>
                <SelectItem value="CMM_CREATED">CMM_CREATED</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-xs text-muted-foreground">
              Total Log Entries: <strong className="text-foreground">{auditData?.total || 0}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card className="border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3 w-36">Timestamp</th>
                  <th className="p-3 w-24">Actor</th>
                  <th className="p-3 w-24">CPSE</th>
                  <th className="p-3 w-40">Action</th>
                  <th className="p-3 w-32">Material</th>
                  <th className="p-3 w-40">Status Transition</th>
                  <th className="p-3 min-w-[200px]">Reason / Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Loading audit records...
                    </td>
                  </tr>
                ) : !auditData?.items || auditData.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No audit log records found.
                    </td>
                  </tr>
                ) : (
                  auditData.items.map((log: any) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-muted-foreground font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            log.actor === 'Admin'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : log.actor === 'Reviewer'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {log.actor}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">{log.cpse_code || '—'}</td>
                      <td className="p-3 font-semibold font-mono text-foreground">{log.action}</td>
                      <td className="p-3 font-mono text-xs">{log.material_code || '—'}</td>
                      <td className="p-3 text-[11px]">
                        {log.previous_status || log.new_status ? (
                          <span className="font-mono">
                            {log.previous_status || 'NONE'} &rarr; <span className="font-bold text-foreground">{log.new_status}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground max-w-[320px] truncate">
                        {log.metadata?.override_outcome && (
                          <span className="font-bold text-purple-600 dark:text-purple-400 mr-1.5">
                            [{log.metadata.override_outcome}]
                          </span>
                        )}
                        {log.reason ? log.reason : log.metadata ? JSON.stringify(log.metadata) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {auditData && auditData.total_pages > 1 && (
            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
              <span>
                Page {page} of {auditData.total_pages} ({auditData.total} entries)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= auditData.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

