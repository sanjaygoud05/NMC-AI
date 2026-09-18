/**
 * System Settings Page
 * Configure AI matching thresholds, API endpoints, CPSE data connectors, and pipeline parameters.
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon,
  Sliders,
  Server,
  Building2,
  Save,
  CheckCircle2,
  Database,
  Cpu,
  Radio,
  Activity,
  RefreshCw,
  FileCode,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function Settings() {
  const [semanticThreshold, setSemanticThreshold] = useState([85]);
  const [fuzzyThreshold, setFuzzyThreshold] = useState([80]);
  const [autoAcceptCutoff, setAutoAcceptCutoff] = useState([92]);
  const [enableGeminiExtraction, setEnableGeminiExtraction] = useState(true);
  const [enableBatchParallelism, setEnableBatchParallelism] = useState(true);
  const [fastApiEndpoint, setFastApiEndpoint] = useState('http://localhost:8000');

  const handleSave = () => {
    toast.success('Configuration parameters saved successfully');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="System & Pipeline Settings"
            description="Fine-tune machine learning hyperparameters, microservice endpoints, and CPSE integrations"
          />
          <Button onClick={handleSave} className="gap-2 shrink-0 bg-primary text-primary-foreground">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="matching" className="space-y-6">
          <TabsList className="w-full flex overflow-x-auto justify-start sm:justify-center bg-muted/50 border border-border scrollbar-none p-1">
            <TabsTrigger value="matching" className="gap-2 shrink-0 text-xs sm:text-sm">
              <Sliders className="h-4 w-4" />
              Matching & AI Thresholds
            </TabsTrigger>
            <TabsTrigger value="endpoints" className="gap-2 shrink-0 text-xs sm:text-sm">
              <Server className="h-4 w-4" />
              API & Microservices
            </TabsTrigger>
            <TabsTrigger value="connectors" className="gap-2 shrink-0 text-xs sm:text-sm">
              <Building2 className="h-4 w-4" />
              CPSE ERP Connectors
            </TabsTrigger>
          </TabsList>

          {/* Matching & AI Thresholds */}
          <TabsContent value="matching" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  Harmonization Sensitivity Parameters
                </CardTitle>
                <CardDescription>
                  Configure automated decision boundaries and multi-model consensus weights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Semantic Cosine Similarity Cutoff</span>
                    <span className="font-mono text-primary font-bold">{semanticThreshold[0]}%</span>
                  </div>
                  <Slider
                    value={semanticThreshold}
                    onValueChange={setSemanticThreshold}
                    min={60}
                    max={98}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Dense vector similarity threshold (all-MiniLM-L6-v2 / BAAI embeddings)
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Fuzzy Levenshtein Token Ratio</span>
                    <span className="font-mono text-primary font-bold">{fuzzyThreshold[0]}%</span>
                  </div>
                  <Slider
                    value={fuzzyThreshold}
                    onValueChange={setFuzzyThreshold}
                    min={50}
                    max={95}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    RapidFuzz token-sort ratio for handling character permutations and abbreviations
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Direct Auto-Accept Consensus Threshold</span>
                    <span className="font-mono text-emerald-500 font-bold">{autoAcceptCutoff[0]}%</span>
                  </div>
                  <Slider
                    value={autoAcceptCutoff}
                    onValueChange={setAutoAcceptCutoff}
                    min={85}
                    max={99}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Pairs scoring at or above this threshold bypass manual human review
                  </p>
                </div>

                <div className="pt-4 border-t border-border/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">LLM-Assisted Attribute Extraction</div>
                      <div className="text-xs text-muted-foreground">
                        Utilize structured LLM prompt chains for complex chemical & mechanical grades
                      </div>
                    </div>
                    <Switch
                      checked={enableGeminiExtraction}
                      onCheckedChange={setEnableGeminiExtraction}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Parallel Asynchronous Batch Processing</div>
                      <div className="text-xs text-muted-foreground">
                        Distribute candidate matching across multiple CPU/GPU worker threads
                      </div>
                    </div>
                    <Switch
                      checked={enableBatchParallelism}
                      onCheckedChange={setEnableBatchParallelism}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API & Microservices */}
          <TabsContent value="endpoints" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  FastAPI Backend Service Connection
                </CardTitle>
                <CardDescription>
                  Configuration for the NMC-AI Python FastAPI backend service
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Backend API Base URL</label>
                  <Input
                    className="mt-1 font-mono text-sm max-w-md"
                    value={fastApiEndpoint}
                    onChange={(e) => setFastApiEndpoint(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
                  <Database className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground">PostgreSQL / Supabase Storage</div>
                    <div className="text-[11px] text-muted-foreground">
                      Ready for PostgreSQL connection string configuration
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/20">
                    Ready
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CPSE ERP & SRP Connectors */}
          <TabsContent value="connectors" className="space-y-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                      <Building2 className="h-4 w-4 text-emerald-400" />
                      CPSE Enterprise ERP Gateways
                    </CardTitle>
                    <CardDescription>
                      Bi-directional connector adapters for SAP S/4HANA, SAP ECC 6.0, and Oracle MM modules
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-border"
                      onClick={() => {
                        toast.promise(new Promise((res) => setTimeout(res, 500)), {
                          loading: 'Pinging all 5 enterprise gateways...',
                          success: 'All 5 CPSE ERP Gateways online (Avg Latency: 26ms)',
                          error: 'Ping failed',
                        });
                      }}
                    >
                      <Activity className="h-3.5 w-3.5 text-emerald-400" />
                      Ping All ERPs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'ONGC — Oil & Natural Gas Corp', system: 'SAP S/4HANA 2023 Enterprise', protocol: 'OData v4 / RFC BAPI', latency: '24ms', endpoint: 'https://s4hana.ongc.co.in/sap/opu/odata/mm' },
                  { name: 'IOCL — Indian Oil Corporation Ltd', system: 'SAP ECC 6.0 EHP8 MM Module', protocol: 'RFC IDoc (MATMAS05)', latency: '31ms', endpoint: 'https://erp.indianoil.in:8443/sap/rfc' },
                  { name: 'HPCL — Hindustan Petroleum Corp', system: 'Oracle Cloud ERP (SCM)', protocol: 'REST JSON / OIC Adapter', latency: '42ms', endpoint: 'https://hpcl.oraclecloud.com/fscmRestApi' },
                  { name: 'SAIL — Steel Authority of India', system: 'SAP S/4HANA Metals', protocol: 'OData v4 Service', latency: '28ms', endpoint: 'https://s4.sail.co.in/sap/opu/odata' },
                  { name: 'Coal India Ltd (CIL)', system: 'SAP ERP Central Component', protocol: 'RFC BAPI Interface', latency: '37ms', endpoint: 'https://sap.coalindia.in/sap/bc/bapi' },
                ].map((item) => (
                  <div key={item.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/70 bg-background/50 hover:bg-muted/20 transition-colors gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{item.name}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Online ({item.latency})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
                        <span>System: {item.system}</span>
                        <span>•</span>
                        <span>Protocol: {item.protocol}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1 border-border"
                        onClick={() => toast.success(`${item.name}: Ping Successful (${item.latency} — HTTP 200 OK)`)}
                      >
                        <Activity className="h-3 w-3 text-emerald-400" />
                        <span>Ping</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1 border-border hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                        onClick={() => toast.success(`${item.name}: Synchronized 1,250 CMM Master records!`)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Sync Now</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* SRP & e-Procurement Portals */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <Radio className="h-4 w-4 text-emerald-400" />
                  National SRP & e-Procurement Portals (Supplier Relationship Systems)
                </CardTitle>
                <CardDescription>
                  Centralized tender consolidation and demand publishing into GeM, CPPP, and Ariba networks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'GeM — Government e-Marketplace Portal', agency: 'Ministry of Commerce & Industry', protocol: 'GeM Catalog Integration API v2.4 (OData/JSON)', status: 'Synchronized', isGem: true },
                  { name: 'CPPP — Central Public Procurement Portal', agency: 'National Informatics Centre (NIC)', protocol: 'NIC e-Procurement XML Gateway', status: 'Ready', isGem: false },
                  { name: 'SAP Ariba CPSE Sourcing Network', agency: 'Ministry of Petroleum Sourcing Hub', protocol: 'Ariba cXML / Cloud Integration Gateway', status: 'Connected', isGem: false },
                ].map((s) => (
                  <div key={s.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/70 bg-background/50 hover:bg-muted/20 transition-colors gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{s.name}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          {s.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {s.agency} · {s.protocol}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {s.isGem ? (
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                          onClick={() => {
                            toast.promise(new Promise((res) => setTimeout(res, 800)), {
                              loading: 'Publishing harmonized CMM specifications to GeM SRP...',
                              success: 'Successfully published to GeM Portal! 1,249 CMM items updated.',
                              error: 'Publish failed',
                            });
                          }}
                        >
                          <Zap className="h-3 w-3" />
                          Publish to GeM
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 border-border"
                          onClick={() => toast.success(`${s.name}: Sourcing gateway synchronized.`)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Sync Specs
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
