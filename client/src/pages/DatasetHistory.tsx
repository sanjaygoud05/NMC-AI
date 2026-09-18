import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  History,
  CheckCircle,
  Clock,
  Upload,
  Database,
  Hash,
  ArrowRight,
  RefreshCw,
  Search,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Copy,
  Check,
  Table as TableIcon,
  LayoutGrid,
  ShieldCheck,
} from 'lucide-react';
import { useDataset } from '@/contexts/DatasetContext';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function DatasetHistory() {
  const { activeDatasetId, datasets, selectDataset, refreshDatasets } = useDataset();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'baseline' | 'uploads' | 'active'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshDatasets();
      toast.success('Dataset registry refreshed');
    } catch {
      toast.error('Failed to refresh dataset registry');
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    toast.success('SHA-256 hash copied to clipboard');
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredDatasets = datasets.filter((ds) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      ds.dataset_id.toLowerCase().includes(q) ||
      ds.file_name.toLowerCase().includes(q) ||
      ds.status.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (filterType === 'baseline') return ds.is_baseline;
    if (filterType === 'uploads') return !ds.is_baseline;
    if (filterType === 'active') return ds.dataset_id === activeDatasetId;
    return true;
  });

  const activeDataset = datasets.find((d) => d.dataset_id === activeDatasetId);
  const totalDatasets = datasets.length;
  const completedDatasets = datasets.filter((d) => d.status === 'COMPLETED').length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
          <PageHeader
            title="Dataset Registry & History"
            description="Complete audit trail, persistent dataset scopes, and pipeline execution states"
          />
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-1.5 text-xs h-9 bg-card hover:bg-muted border-border flex-1 sm:flex-initial shadow-none"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild size="sm" className="gap-1.5 text-xs h-9 font-medium shadow-none bg-emerald-600 hover:bg-emerald-500 text-white flex-1 sm:flex-initial">
              <Link to="/ingest">
                <Upload className="h-3.5 w-3.5" />
                Upload New Dataset
              </Link>
            </Button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Registered Datasets
                </CardDescription>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Database className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-mono mt-1 text-emerald-400">
                {totalDatasets}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                {completedDatasets} fully processed &amp; verified
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Scope
                </CardDescription>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-mono text-emerald-400 mt-1 truncate">
                {activeDatasetId || 'BASELINE'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground truncate font-mono">
                {activeDataset?.file_name || 'CPSE_Material_Master_cleaned.csv'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Materials
                </CardDescription>
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-mono mt-1 text-foreground tabular-nums">
                {(activeDataset?.row_count ?? 2200).toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground">
                {activeDataset?.column_count ?? 20} standard schema columns
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Active CPSEs
                </CardDescription>
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-mono mt-1 text-foreground">
                {Object.keys(activeDataset?.cpse_summary || {}).length || 8} CPSEs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground truncate font-mono" title={Object.keys(activeDataset?.cpse_summary || {}).join(' · ')}>
                {Object.keys(activeDataset?.cpse_summary || {}).join(' · ') || 'BHEL · Coal India · HPCL · IOCL · NMDC · NTPC · ONGC · SAIL'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Toolbar & View Toggle */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search dataset ID, filename, status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border-border h-9 text-xs w-full font-mono"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50 text-xs overflow-x-auto scrollbar-none shrink-0">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  filterType === 'all'
                    ? 'bg-background font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({datasets.length})
              </button>
              <button
                onClick={() => setFilterType('baseline')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  filterType === 'baseline'
                    ? 'bg-background font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Baseline
              </button>
              <button
                onClick={() => setFilterType('uploads')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  filterType === 'uploads'
                    ? 'bg-background font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Uploads ({datasets.filter((d) => !d.is_baseline).length})
              </button>
              <button
                onClick={() => setFilterType('active')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  filterType === 'active'
                    ? 'bg-background font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Active
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 self-end md:self-center border border-border/60 rounded-lg p-1 bg-background shrink-0">
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('cards')}
              className="h-7 w-7"
              aria-label="Card View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('table')}
              className="h-7 w-7"
              aria-label="Table View"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Dataset List / Table */}
        {filteredDatasets.length === 0 ? (
          <Card className="border-border bg-card p-12 text-center">
            <History className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-base font-semibold text-foreground">No Datasets Found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchTerm
                ? `No datasets match "${searchTerm}". Try resetting your search filter.`
                : 'Upload a material dataset via the Data Ingestion tab to register a new dataset.'}
            </p>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline" className="text-xs">
                <Link to="/ingest">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Go to Data Ingestion
                </Link>
              </Button>
            </div>
          </Card>
        ) : viewMode === 'table' ? (
          /* Table View - Properly Aligned Columns & Crisp Typography */
          <Card className="border-border bg-card overflow-hidden w-full shadow-none">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[920px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-semibold text-foreground text-xs">
                    <th className="py-3 px-4 w-[220px] text-left">Dataset ID</th>
                    <th className="py-3 px-3 min-w-[220px] text-left">Source File</th>
                    <th className="py-3 px-3 w-[120px] text-right">Records</th>
                    <th className="py-3 px-3 w-[260px] text-left">CPSE Breakdown</th>
                    <th className="py-3 px-3 w-[120px] text-center">Status</th>
                    <th className="py-3 px-3 w-[110px] text-center">Uploaded</th>
                    <th className="py-3 pr-4 pl-3 w-[100px] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredDatasets.map((ds) => {
                    const isActive = ds.dataset_id === activeDatasetId;
                    const cpseEntries = Object.entries(ds.cpse_summary || {});
                    return (
                      <tr
                        key={ds.dataset_id}
                        className={`hover:bg-muted/20 transition-colors ${
                          isActive ? 'bg-emerald-500/[0.03]' : ''
                        }`}
                      >
                        {/* Dataset ID with proper font style and alignment */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-2">
                            {isActive ? (
                              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Active Scope" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
                            )}
                            <span
                              className="font-mono text-xs font-bold text-emerald-400 tracking-wide truncate max-w-[150px]"
                              title={ds.dataset_id}
                            >
                              {ds.dataset_id}
                            </span>
                            {ds.is_baseline && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1.5 font-mono font-semibold shrink-0">
                                BASELINE
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Source File */}
                        <td className="py-3.5 px-3 align-middle">
                          <div className="font-mono text-xs text-foreground truncate max-w-[240px]" title={ds.file_name}>
                            {ds.file_name}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground/70 truncate">
                            SHA: {ds.file_hash.substring(0, 16)}...
                          </div>
                        </td>

                        {/* Records - Aligned Right */}
                        <td className="py-3.5 px-3 align-middle text-right">
                          <div className="font-mono font-bold text-xs text-foreground tabular-nums">
                            {ds.row_count.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {ds.column_count} cols
                          </div>
                        </td>

                        {/* CPSE Breakdown */}
                        <td className="py-3.5 px-3 align-middle">
                          {cpseEntries.length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : cpseEntries.length <= 3 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {cpseEntries.map(([cpse, count]) => (
                                <span
                                  key={cpse}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border border-border/80 bg-muted/40 text-foreground font-medium"
                                >
                                  {cpse}:{count}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-nowrap">
                              {cpseEntries.slice(0, 2).map(([cpse, count]) => (
                                <span
                                  key={cpse}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border border-border/80 bg-muted/40 text-foreground font-medium shrink-0"
                                >
                                  {cpse}:{count}
                                </span>
                              ))}
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border border-border bg-muted/60 text-muted-foreground font-medium shrink-0 cursor-help hover:text-foreground transition-colors"
                                title={`All CPSEs:\n${cpseEntries.map(([c, cnt]) => `${c}: ${cnt}`).join('\n')}`}
                              >
                                +{cpseEntries.length - 2} more
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Status - Aligned Center */}
                        <td className="py-3.5 px-3 align-middle text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono border font-semibold uppercase tracking-wider ${
                              ds.status === 'COMPLETED'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                : ds.status === 'PROCESSING' || ds.status === 'VALIDATING'
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                                : 'border-destructive/30 bg-destructive/10 text-destructive'
                            }`}
                          >
                            {ds.status}
                          </span>
                        </td>

                        {/* Uploaded Date - Aligned Center */}
                        <td className="py-3.5 px-3 align-middle text-center text-muted-foreground font-mono text-xs">
                          {new Date(ds.uploaded_at).toLocaleDateString()}
                        </td>

                        {/* Action - Aligned Right */}
                        <td className="py-3.5 pr-4 pl-3 align-middle text-right">
                          {isActive ? (
                            <span className="inline-block px-2.5 py-1 rounded text-[11px] font-mono font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                              ACTIVE
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2.5 border-border hover:border-emerald-500/40 hover:text-emerald-400 transition-colors shadow-none"
                              onClick={() => {
                                selectDataset(ds.dataset_id);
                                toast.success(`Active dataset set to ${ds.dataset_id}`);
                              }}
                            >
                              Activate
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          /* Cards View */
          <div className="space-y-3.5">
            {filteredDatasets.map((ds) => {
              const isActive = ds.dataset_id === activeDatasetId;
              return (
                <Card
                  key={ds.dataset_id}
                  className={`border transition-all duration-200 shadow-none ${
                    isActive
                      ? 'border-emerald-500/50 bg-card'
                      : 'border-border bg-card hover:border-border/80'
                  }`}
                >
                  <CardHeader className="p-4 sm:p-5 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`p-2.5 rounded-xl border shrink-0 ${
                            isActive
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-muted/40 border-border text-muted-foreground'
                          }`}
                        >
                          {ds.is_baseline ? (
                            <ShieldCheck className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <Database className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm sm:text-base text-emerald-400 tracking-wide truncate">
                              {ds.dataset_id}
                            </span>
                            {ds.is_baseline && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-semibold">
                                FROZEN BASELINE
                              </Badge>
                            )}
                            {isActive && (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-mono font-semibold shadow-none">
                                CURRENT ACTIVE SCOPE
                              </Badge>
                            )}
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono border font-semibold uppercase tracking-wider ${
                                ds.status === 'COMPLETED'
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                  : ds.status === 'PROCESSING'
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                                  : 'border-destructive/30 bg-destructive/10 text-destructive'
                              }`}
                            >
                              {ds.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap font-mono">
                            <span className="font-semibold text-foreground truncate max-w-[220px] sm:max-w-none">{ds.file_name}</span>
                            <span>·</span>
                            <span className="text-emerald-400 font-bold">{ds.row_count.toLocaleString()} materials</span>
                            <span>·</span>
                            <span>{ds.column_count} columns</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap sm:flex-nowrap pt-1 sm:pt-0">
                        {!isActive && ds.status === 'COMPLETED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-medium bg-background hover:bg-muted border-border shadow-none"
                            onClick={() => {
                              selectDataset(ds.dataset_id);
                              toast.success(`Active scope set to ${ds.dataset_id}`);
                            }}
                          >
                            Activate Dataset
                          </Button>
                        )}
                        <Button
                          size="sm"
                          asChild
                          variant={isActive ? 'default' : 'secondary'}
                          className="h-8 text-xs font-medium shadow-none"
                        >
                          <Link to="/materials">
                            Explore Materials
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                    {/* Checksum & Time Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-muted/20 p-3 rounded-lg border border-border/60">
                      <div className="flex items-center gap-2 text-muted-foreground font-mono min-w-0 overflow-hidden">
                        <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="shrink-0 text-muted-foreground">SHA256:</span>
                        <span className="truncate text-emerald-400 font-semibold flex-1 min-w-0">
                          {ds.file_hash}
                        </span>
                        <button
                          onClick={() => copyToClipboard(ds.file_hash, ds.dataset_id)}
                          className="shrink-0 text-muted-foreground hover:text-foreground p-1 transition-colors"
                          title="Copy SHA256"
                        >
                          {copiedHash === ds.dataset_id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground md:justify-end min-w-0 font-mono text-[11px]">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="truncate">Registered: {new Date(ds.uploaded_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* CPSE Distribution Chips */}
                    {Object.keys(ds.cpse_summary || {}).length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                        <span className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
                          CPSE Breakdown:
                        </span>
                        {Object.entries(ds.cpse_summary).map(([cpse, count]) => {
                          const percent = Math.round(((count as number) / (ds.row_count || 1)) * 100);
                          return (
                            <span
                              key={cpse}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border border-border/80 bg-muted/30 text-foreground"
                            >
                              <span className="font-semibold">{cpse}</span>
                              <span className="text-muted-foreground font-normal">
                                {count} ({percent}%)
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
