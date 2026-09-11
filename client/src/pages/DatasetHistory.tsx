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
  AlertTriangle,
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
  Sparkles,
  ChevronRight,
  Table as TableIcon,
  LayoutGrid,
  ShieldCheck,
  SlidersHorizontal,
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
  const totalRecords = datasets.reduce((sum, d) => sum + (d.row_count || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
          <PageHeader
            title="Dataset Registry & History"
            description="Complete audit trail, persistent dataset scopes, and pipeline execution states"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-1.5 text-xs h-9 bg-card hover:bg-muted border-border"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild size="sm" className="gap-1.5 text-xs h-9 font-medium shadow-sm">
              <Link to="/ingest">
                <Upload className="h-3.5 w-3.5" />
                Upload New Dataset
              </Link>
            </Button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Registered Datasets
                </CardDescription>
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Database className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold mt-1 text-foreground">
                {totalDatasets}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                {completedDatasets} fully processed & verified
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Scope
                </CardDescription>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-mono text-primary mt-1 truncate">
                {activeDatasetId || 'NONE'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground truncate">
                {activeDataset?.file_name || 'No dataset selected'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Materials
                </CardDescription>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold mt-1 text-foreground">
                {activeDataset?.row_count?.toLocaleString() ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground">
                {activeDataset?.column_count ?? 18} standard schema columns
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active CPSEs
                </CardDescription>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold mt-1 text-foreground">
                {Object.keys(activeDataset?.cpse_summary || {}).length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground truncate font-mono">
                {Object.keys(activeDataset?.cpse_summary || {}).join(' · ') || 'None'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Toolbar & View Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search dataset ID, filename, status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border-border h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50 text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterType === 'all'
                    ? 'bg-background font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({datasets.length})
              </button>
              <button
                onClick={() => setFilterType('baseline')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterType === 'baseline'
                    ? 'bg-background font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Baseline
              </button>
              <button
                onClick={() => setFilterType('uploads')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterType === 'uploads'
                    ? 'bg-background font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Uploads ({datasets.filter((d) => !d.is_baseline).length})
              </button>
              <button
                onClick={() => setFilterType('active')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterType === 'active'
                    ? 'bg-background font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Active
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-center border border-border/60 rounded-lg p-1 bg-background">
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
          /* Table View */
          <Card className="border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                    <th className="p-3 pl-4">Dataset ID</th>
                    <th className="p-3">Source File</th>
                    <th className="p-3">Records</th>
                    <th className="p-3">CPSE Breakdown</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Uploaded</th>
                    <th className="p-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDatasets.map((ds) => {
                    const isActive = ds.dataset_id === activeDatasetId;
                    return (
                      <tr
                        key={ds.dataset_id}
                        className={`hover:bg-muted/20 transition-colors ${
                          isActive ? 'bg-primary/[0.03]' : ''
                        }`}
                      >
                        <td className="p-3 pl-4 font-mono font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            {isActive && (
                              <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                            )}
                            <span>{ds.dataset_id}</span>
                            {ds.is_baseline && (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] py-0 px-1.5">
                                BASELINE
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground font-medium">
                          {ds.file_name}
                        </td>
                        <td className="p-3 font-semibold text-foreground">
                          {ds.row_count.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {Object.entries(ds.cpse_summary || {}).map(([cpse, count]) => (
                              <Badge
                                key={cpse}
                                variant="outline"
                                className="text-[10px] py-0 px-1 font-mono"
                              >
                                {cpse}:{count}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              ds.status === 'COMPLETED'
                                ? 'default'
                                : ds.status === 'PROCESSING'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-[10px] capitalize"
                          >
                            {ds.status.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(ds.uploaded_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 pr-4 text-right">
                          {isActive ? (
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                              ACTIVE
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2.5"
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
          <div className="space-y-4">
            {filteredDatasets.map((ds) => {
              const isActive = ds.dataset_id === activeDatasetId;
              return (
                <Card
                  key={ds.dataset_id}
                  className={`border transition-all duration-200 ${
                    isActive
                      ? 'border-primary/50 shadow-md bg-gradient-to-r from-card via-card to-primary/[0.03]'
                      : 'border-border bg-card hover:border-border/80 shadow-xs'
                  }`}
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <div
                          className={`p-2.5 rounded-xl border shrink-0 ${
                            isActive
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-muted/40 border-border text-muted-foreground'
                          }`}
                        >
                          {ds.is_baseline ? (
                            <ShieldCheck className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Database className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-base text-foreground tracking-tight">
                              {ds.dataset_id}
                            </span>
                            {ds.is_baseline && (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px] font-semibold">
                                FROZEN BASELINE
                              </Badge>
                            )}
                            {isActive && (
                              <Badge className="bg-primary text-primary-foreground text-[11px] font-semibold shadow-xs">
                                CURRENT ACTIVE SCOPE
                              </Badge>
                            )}
                            <Badge
                              variant={
                                ds.status === 'COMPLETED'
                                  ? 'default'
                                  : ds.status === 'PROCESSING'
                                  ? 'secondary'
                                  : ds.status === 'FAILED'
                                  ? 'destructive'
                                  : 'outline'
                              }
                              className="text-[11px] capitalize"
                            >
                              {ds.status.toLowerCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="font-medium text-foreground">{ds.file_name}</span>
                            <span>·</span>
                            <span>{ds.row_count.toLocaleString()} materials</span>
                            <span>·</span>
                            <span>{ds.column_count} columns</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {!isActive && ds.status === 'COMPLETED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold bg-background hover:bg-muted"
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
                          className="h-8 text-xs font-medium"
                        >
                          <Link to="/materials">
                            Explore Materials
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-3">
                    {/* Checksum & Time Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-muted/25 p-3 rounded-lg border border-border/60">
                      <div className="flex items-center gap-2 text-muted-foreground font-mono truncate">
                        <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="shrink-0 text-muted-foreground">SHA256:</span>
                        <span className="truncate text-foreground font-semibold">
                          {ds.file_hash}
                        </span>
                        <button
                          onClick={() => copyToClipboard(ds.file_hash, ds.dataset_id)}
                          className="shrink-0 text-muted-foreground hover:text-foreground p-1 transition-colors"
                          title="Copy SHA256"
                        >
                          {copiedHash === ds.dataset_id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground md:justify-end">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>Registered: {new Date(ds.uploaded_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* CPSE Distribution Chips */}
                    {Object.keys(ds.cpse_summary || {}).length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                        <span className="text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                          CPSE Breakdown:
                        </span>
                        {Object.entries(ds.cpse_summary).map(([cpse, count]) => {
                          const percent = Math.round(((count as number) / (ds.row_count || 1)) * 100);
                          return (
                            <Badge
                              key={cpse}
                              variant="outline"
                              className="font-mono text-xs px-2.5 py-1 bg-background border-border/80 flex items-center gap-1.5"
                            >
                              <span className="font-semibold text-foreground">{cpse}</span>
                              <span className="text-muted-foreground font-normal">
                                {count} ({percent}%)
                              </span>
                            </Badge>
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
