import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { nmcApi } from '@/services/nmcApi';
import { Filter, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

function parseUtcDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  let str = dateStr.trim();
  // If the ISO string doesn't have a timezone designator, append 'Z' so it parses as UTC
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('-', 10)) {
    str = str + 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatAuditTimestamp(d: Date | null, rawFallback: string): string {
  if (!d) return rawFallback || '—';
  try {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const month = monthNames[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${month} ${day}, ${year} at ${hours}:${minutes}:${seconds} ${ampm}`;
  } catch {
    return rawFallback || '—';
  }
}

function getRelativeTime(d: Date | null): string {
  if (!d) return '';
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}

function normalizeActor(actor?: string): string {
  if (!actor) return 'system_harmonization';
  const a = actor.toLowerCase();
  if (a === 'system' || a.includes('system') || a === 'system_harmonization') {
    return 'system_harmonization';
  }
  if (a === 'reviewer' || a.includes('reviewer') || a === 'human_reviewer') {
    return 'human_reviewer';
  }
  if (a === 'admin') {
    return 'admin';
  }
  return actor;
}

function resolveAction(rawAction: string): { displayAction: string; badgeStyle: string } {
  const act = rawAction.toUpperCase();
  if (act === 'MARK_DIFFERENT' || act === 'MATCH_DIFFERENT') {
    return {
      displayAction: 'MARK_DIFFERENT',
      badgeStyle:
        'border border-amber-400/80 bg-amber-50/70 text-amber-700 dark:border-amber-600/70 dark:bg-amber-950/40 dark:text-amber-300',
    };
  }
  if (act === 'CREATE_MAPPING' || act === 'MATCH_ACCEPTED') {
    return {
      displayAction: 'CREATE_MAPPING',
      badgeStyle:
        'border border-slate-300 bg-slate-100/80 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
    };
  }
  if (
    act === 'CREATE_NATIONAL_MATERIAL' ||
    act === 'CMM_CREATED' ||
    act === 'CMM_UPDATED'
  ) {
    return {
      displayAction: 'CREATE_NATIONAL_MATERIAL',
      badgeStyle:
        'border border-emerald-300/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    };
  }
  if (act === 'OVERRIDE_MATCH' || act === 'MATCH_OVERRIDDEN') {
    return {
      displayAction: 'OVERRIDE_MATCH',
      badgeStyle:
        'border border-purple-300/80 bg-purple-50/80 text-purple-700 dark:border-purple-600 dark:bg-purple-950/40 dark:text-purple-300',
    };
  }
  if (act === 'REJECT_MATCH' || act === 'MATCH_REJECTED') {
    return {
      displayAction: 'REJECT_MATCH',
      badgeStyle:
        'border border-rose-300/80 bg-rose-50/80 text-rose-700 dark:border-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
    };
  }
  if (act === 'MATCHING_STARTED' || act === 'MATCHING_COMPLETED' || act === 'RUN_HARMONIZATION') {
    return {
      displayAction: 'RUN_HARMONIZATION',
      badgeStyle:
        'border border-blue-300/80 bg-blue-50/80 text-blue-700 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    };
  }
  return {
    displayAction: rawAction,
    badgeStyle:
      'border border-border bg-muted/60 text-foreground font-mono',
  };
}

function resolveEntityType(action: string, metadata?: any): string {
  const act = action.toUpperCase();
  if (
    act === 'MARK_DIFFERENT' ||
    act === 'MATCH_DIFFERENT' ||
    act === 'REJECT_MATCH' ||
    act === 'MATCH_REJECTED' ||
    act === 'OVERRIDE_MATCH' ||
    act === 'MATCH_OVERRIDDEN'
  ) {
    return 'MATCH_RECOMMENDATION';
  }
  if (act === 'CREATE_MAPPING' || act === 'MATCH_ACCEPTED') {
    return 'MATERIAL_NATIONAL_MAPPING';
  }
  if (
    act === 'CREATE_NATIONAL_MATERIAL' ||
    act === 'CMM_CREATED' ||
    act === 'CMM_UPDATED'
  ) {
    return 'NATIONAL_MATERIAL';
  }
  if (act.includes('DATASET')) {
    return 'MATERIAL_DATASET';
  }
  if (act.includes('MATCHING') || act.includes('HARMONIZATION')) {
    return 'HARMONIZATION_RUN';
  }
  if (act.includes('CPSE')) {
    return 'CPSE_ENTERPRISE';
  }
  if (metadata?.entity_type) {
    return metadata.entity_type;
  }
  return 'MATCH_RECOMMENDATION';
}

function resolveReasonNotes(log: any): string {
  if (log.reason && log.reason.trim()) {
    return log.reason;
  }
  const meta = log.metadata || log.extra_metadata;
  if (meta) {
    if (meta.reason && typeof meta.reason === 'string') {
      return meta.reason;
    }
    if (meta.match_id) {
      if (log.action === 'CREATE_MAPPING' || log.action === 'MATCH_ACCEPTED') {
        return `Auto-mapped based on SAME recommendation ${meta.match_id}...`;
      }
      return `Processed match recommendation ${meta.match_id}`;
    }
  }
  if (log.material_code) {
    if (
      log.action === 'CREATE_NATIONAL_MATERIAL' ||
      log.action === 'CMM_CREATED'
    ) {
      return `Auto-created from Material ${log.material_code}`;
    }
    return `Referenced material ${log.material_code}`;
  }
  return 'System governance record recorded.';
}

export default function AuditTrail() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('ALL');
  const [uuidInput, setUuidInput] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [appliedEntityType, setAppliedEntityType] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  const {
    data: auditData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['nmc', 'audit-trail', appliedEntityType, appliedSearch, page],
    queryFn: () =>
      nmcApi.audit.list({
        entity_type: appliedEntityType === 'ALL' ? undefined : appliedEntityType,
        search: appliedSearch.trim() || undefined,
        page,
        page_size: pageSize,
      }),
    refetchInterval: 10000, // live polling every 10 seconds
  });

  const handleApply = () => {
    setAppliedEntityType(entityTypeFilter);
    setAppliedSearch(uuidInput);
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  return (
    <AppLayout requireReviewer>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Audit Trail
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              System and governance history
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 w-8 rounded-md border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Refresh Audit Trail"
          >
            <RotateCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="bg-card border border-border/70 rounded-md p-2.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-muted-foreground pl-1">
              <Filter className="h-3.5 w-3.5" />
              <span>Filters:</span>
            </div>

            <Select
              value={entityTypeFilter}
              onValueChange={(val) => setEntityTypeFilter(val)}
            >
              <SelectTrigger className="w-[190px] h-8 text-xs bg-background border-border/70">
                <SelectValue placeholder="All Entity Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Entity Types</SelectItem>
                <SelectItem value="MATCH_RECOMMENDATION">MATCH_RECOMMENDATION</SelectItem>
                <SelectItem value="MATERIAL_NATIONAL_MAPPING">
                  MATERIAL_NATIONAL_MAPPING
                </SelectItem>
                <SelectItem value="NATIONAL_MATERIAL">NATIONAL_MATERIAL</SelectItem>
                <SelectItem value="CPSE_ENTERPRISE">CPSE_ENTERPRISE</SelectItem>
                <SelectItem value="MATERIAL_DATASET">MATERIAL_DATASET</SelectItem>
                <SelectItem value="HARMONIZATION_RUN">HARMONIZATION_RUN</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="text"
              placeholder="Filter by Entity UUID..."
              value={uuidInput}
              onChange={(e) => setUuidInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-64 text-xs bg-background border-border/70 placeholder:text-muted-foreground/60"
            />

            <Button
              onClick={handleApply}
              className="h-8 px-4 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 rounded-md"
            >
              Apply
            </Button>
          </div>
        </div>

        {/* Audit Trail Table */}
        <div className="bg-card border border-border/70 rounded-md overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-56">TIMESTAMP</th>
                  <th className="py-2.5 px-3 w-44">ACTOR</th>
                  <th className="py-2.5 px-3 w-48">ACTION</th>
                  <th className="py-2.5 px-3 w-56">ENTITY TYPE</th>
                  <th className="py-2.5 px-3 min-w-[280px]">REASON / NOTES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RotateCw className="h-4 w-4 animate-spin text-primary" />
                        <span>Loading audit records...</span>
                      </div>
                    </td>
                  </tr>
                ) : !auditData?.items || auditData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No audit records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  auditData.items.map((log: any, idx: number) => {
                    const rowIndex = (page - 1) * pageSize + idx + 1;
                    const parsedDate = parseUtcDate(log.timestamp);
                    const formattedTimestamp = formatAuditTimestamp(parsedDate, log.timestamp);
                    const relativeTime = getRelativeTime(parsedDate);
                    const actorName = normalizeActor(log.actor);
                    const { displayAction, badgeStyle } = resolveAction(log.action);
                    const entityType = resolveEntityType(log.action, log.metadata || log.extra_metadata);
                    const reasonNotes = resolveReasonNotes(log);

                    return (
                      <tr
                        key={log.id || rowIndex}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center text-muted-foreground/70 font-mono text-[11px]">
                          {rowIndex}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-sans text-foreground/90 font-medium">
                              {formattedTimestamp}
                            </span>
                            {relativeTime && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted/70 text-muted-foreground font-mono">
                                {relativeTime}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-foreground/80 font-medium whitespace-nowrap">
                          {actorName}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${badgeStyle}`}
                          >
                            {displayAction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border border-border/70 bg-muted/60 text-muted-foreground font-medium">
                            {entityType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground font-sans truncate max-w-lg">
                          {reasonNotes}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          {auditData && auditData.total > 0 && (
            <div className="px-4 py-2.5 border-t border-border/60 bg-muted/15 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing{' '}
                <strong className="text-foreground">
                  {(page - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-foreground">
                  {Math.min(page * pageSize, auditData.total)}
                </strong>{' '}
                of <strong className="text-foreground">{auditData.total}</strong> records
              </span>
              {auditData.total_pages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs border-border/70"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Button>
                  <span className="px-2 text-xs">
                    {page} / {auditData.total_pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs border-border/70"
                    disabled={page >= auditData.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
