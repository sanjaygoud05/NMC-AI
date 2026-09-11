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
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="matching" className="gap-2">
              <Sliders className="h-4 w-4" />
              Matching & AI Thresholds
            </TabsTrigger>
            <TabsTrigger value="endpoints" className="gap-2">
              <Server className="h-4 w-4" />
              API & Microservices
            </TabsTrigger>
            <TabsTrigger value="connectors" className="gap-2">
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

          {/* CPSE ERP Connectors */}
          <TabsContent value="connectors" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Registered Enterprise Systems & ERP Schemas
                  </div>
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/20 bg-amber-500/10">
                    Architectural Templates
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Pre-configured SAP S/4HANA, SAP ECC 6.0, and Oracle MM integration connectors for enterprise rollout
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-muted-foreground flex items-start gap-2.5">
                  <span className="font-semibold text-amber-400 shrink-0">Note:</span>
                  <span>
                    In this prototype, material datasets are ingested directly via CSV uploads and baseline benchmarks. These connectors represent the target integration endpoints ready for live Ministry deployment.
                  </span>
                </div>

                {[
                  { name: 'CPCL — Chennai Petroleum Corp Ltd', erp: 'SAP S/4HANA Material Master', status: 'Integration Ready (Simulated)' },
                  { name: 'IOCL — Indian Oil Corporation Ltd', erp: 'SAP ECC 6.0 MM Module', status: 'Integration Ready (Simulated)' },
                  { name: 'ONGC — Oil & Natural Gas Corp', erp: 'SAP S/4HANA Enterprise', status: 'Integration Ready (Simulated)' },
                  { name: 'GAIL — Gas Authority of India Ltd', erp: 'SAP MM / SRM', status: 'Integration Ready (Simulated)' },
                  { name: 'BPCL — Bharat Petroleum Corp Ltd', erp: 'SAP ECC 6.0', status: 'Integration Ready (Simulated)' },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.erp}</div>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground border-border bg-muted/30">
                      {item.status}
                    </Badge>
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
