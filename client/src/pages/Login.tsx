import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Shield, Key, AlertCircle, ArrowRight, UserCheck, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_REVIEWERS: Record<string, { name: string; id: string; domain: string }> = {
  HPCL: { name: 'Rajesh Kumar', id: 'HPCL-REV-001', domain: 'Materials Management' },
  IOCL: { name: 'Amit Sharma', id: 'IOCL-REV-002', domain: 'Refinery Maintenance' },
  ONGC: { name: 'Priya Verma', id: 'ONGC-REV-003', domain: 'Drilling & Equipment' },
  CIL:  { name: 'Sunil Murthy', id: 'CIL-REV-004', domain: 'Mining Machinery' },
  SAIL: { name: 'Ananya Roy', id: 'SAIL-REV-005', domain: 'Steel & Metallurgy' },
  BHEL: { name: 'Vikram Joshi', id: 'BHEL-REV-006', domain: 'Turbine & Electrical' },
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginAdmin, loginReviewer } = useAuth();

  const locationState = location.state as any;
  // If coming from the Review Queue gate, auto-open the Reviewer tab
  const defaultTab = locationState?.tab === 'reviewer' ? 'reviewer' : 'admin';

  const [adminPassword, setAdminPassword] = useState('nmc-admin-2026');
  const [reviewerCpse, setReviewerCpse] = useState('HPCL');
  const [reviewerName, setReviewerName] = useState('Rajesh Kumar');
  const [reviewerId, setReviewerId] = useState('HPCL-REV-001');
  const [reviewerKey, setReviewerKey] = useState('nmc-reviewer-key');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminDestination = locationState?.from || '/dashboard';
  const reviewerDestination = '/review';

  const handleCpseChange = (cpseCode: string) => {
    setReviewerCpse(cpseCode);
    const assigned = DEFAULT_REVIEWERS[cpseCode] || {
      name: `${cpseCode} Domain Reviewer`,
      id: `${cpseCode}-REV-01`,
      domain: 'Materials Management',
    };
    setReviewerName(assigned.name);
    setReviewerId(assigned.id);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginAdmin(adminPassword);
      toast.success('Central Administrator authenticated');
      navigate(adminDestination, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid admin credentials');
      toast.error('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginReviewer(reviewerKey, reviewerName, reviewerCpse);
      toast.success(`Welcome, ${reviewerName} (${reviewerCpse} Domain Expert)`);
      navigate(reviewerDestination, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid reviewer key');
      toast.error('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full overflow-hidden bg-white shadow-lg mb-2">
            <img src="/favicon.png" alt="NMC Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            NMC-AI
          </h1>
          <p className="text-sm text-muted-foreground">
            National Material Catalog & Harmonization Platform
          </p>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Platform Access</CardTitle>
            <CardDescription>
              Select your access role to sign in to the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="admin" className="gap-2" onClick={() => setError(null)}>
                  <Shield className="h-3.5 w-3.5" />
                  Central Admin
                </TabsTrigger>
                <TabsTrigger value="reviewer" className="gap-2" onClick={() => setError(null)}>
                  <Key className="h-3.5 w-3.5" />
                  CPSE Reviewer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="admin">
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-pass">Admin Password</Label>
                    <Input
                      id="admin-pass"
                      type="password"
                      placeholder="Enter admin password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? 'Authenticating...' : 'Sign in as Central Admin'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="reviewer">
                <form onSubmit={handleReviewerSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="rev-cpse" className="text-xs">Enterprise Organization</Label>
                    <select
                      id="rev-cpse"
                      value={reviewerCpse}
                      onChange={(e) => handleCpseChange(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="HPCL">HPCL — Hindustan Petroleum Corporation</option>
                      <option value="IOCL">IOCL — Indian Oil Corporation</option>
                      <option value="ONGC">ONGC — Oil and Natural Gas Corporation</option>
                      <option value="CIL">CIL — Coal India Limited</option>
                      <option value="SAIL">SAIL — Steel Authority of India</option>
                      <option value="BHEL">BHEL — Bharat Heavy Electricals</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="rev-name" className="text-xs">Authorized Reviewer</Label>
                      <Input
                        id="rev-name"
                        type="text"
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rev-id" className="text-xs">Reviewer ID</Label>
                      <Input
                        id="rev-id"
                        type="text"
                        value={reviewerId}
                        onChange={(e) => setReviewerId(e.target.value)}
                        className="h-9 text-xs font-mono text-muted-foreground"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="rev-key" className="text-xs">Security Access Key</Label>
                      <span className="text-[10px] text-muted-foreground">Pre-configured</span>
                    </div>
                    <Input
                      id="rev-key"
                      type="password"
                      placeholder="Enter reviewer key"
                      value={reviewerKey}
                      onChange={(e) => setReviewerKey(e.target.value)}
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] leading-snug">
                      Authorized to evaluate & verify material equivalence for <strong>{reviewerCpse}</strong>.
                    </span>
                  </div>

                  <Button type="submit" className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white" disabled={loading}>
                    {loading ? 'Authenticating...' : `Sign in as ${reviewerCpse} Reviewer`}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
