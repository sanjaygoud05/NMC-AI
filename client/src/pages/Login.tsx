import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Shield, Key, AlertCircle, ArrowRight, Eye, EyeOff, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const CPSE_NAMES: Record<string, string> = {
  HPCL: 'Hindustan Petroleum Corporation Limited',
  IOCL: 'Indian Oil Corporation Limited',
  ONGC: 'Oil and Natural Gas Corporation Limited',
  BPCL: 'Bharat Petroleum Corporation Limited',
  GAIL: 'GAIL (India) Limited',
  BHEL: 'Bharat Heavy Electricals Limited',
  NTPC: 'NTPC Limited',
  CIL: 'Coal India Limited',
  SAIL: 'Steel Authority of India Limited',
};

function deriveEnterprise(reviewerId: string): { code: string; name: string } | null {
  if (!reviewerId.trim()) return null;
  // Match prefix like HPCL, IOCL, ONGC etc (2-6 uppercase letters) before a dash
  const match = reviewerId.toUpperCase().match(/^([A-Z]{2,6})(?:-|$)/);
  if (!match) return null;
  const code = match[1];
  const name = CPSE_NAMES[code];
  if (!name) return null;
  return { code, name };
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginAdmin, loginReviewer } = useAuth();

  const locationState = location.state as any;
  // If coming from the Review Queue gate, auto-open the Reviewer tab
  const defaultTab = locationState?.tab === 'reviewer' ? 'reviewer' : 'admin';

  const [adminPassword, setAdminPassword] = useState('nmc-admin-2026');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [reviewerId, setReviewerId] = useState('');
  const [reviewerPassword, setReviewerPassword] = useState('');
  const [showReviewerPassword, setShowReviewerPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminDestination = locationState?.from || '/dashboard';
  const reviewerDestination = '/review';

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
      await loginReviewer({ reviewerId, password: reviewerPassword });
      toast.success(`Welcome, Reviewer (${reviewerId})`);
      navigate(reviewerDestination, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid reviewer credentials');
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
                  Reviewer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="admin">
                <form onSubmit={handleAdminSubmit} className="space-y-4" autoComplete="off">
                  {/* Decoy fields to capture aggressive browser autofill */}
                  <input type="text" name="fake_admin_user" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="username" />
                  <input type="password" name="fake_admin_pass" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="current-password" />

                  <div className="space-y-2">
                    <Label htmlFor="admin-pass">Admin Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-pass"
                        name="admin_master_key"
                        type={showAdminPassword ? "text" : "password"}
                        placeholder="Enter admin password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        autoComplete="new-password"
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center focus:outline-none"
                        onClick={() => setShowAdminPassword((prev) => !prev)}
                        title={showAdminPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? 'Authenticating...' : 'Sign in as Central Admin'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="reviewer">
                <form onSubmit={handleReviewerSubmit} className="space-y-4" autoComplete="off">
                  {/* Decoy fields to capture aggressive browser autofill */}
                  <input type="text" name="fake_reviewer_user" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="username" />
                  <input type="password" name="fake_reviewer_pass" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="current-password" />

                  <div className="space-y-2">
                    <Label htmlFor="rev-id">Reviewer ID</Label>
                    <Input
                      id="rev-id"
                      name="reviewer_code_identifier"
                      type="text"
                      placeholder="Enter Reviewer ID"
                      value={reviewerId}
                      onChange={(e) => setReviewerId(e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                    />
                  </div>

                  {/* Enterprise Organisation — auto-derived from Reviewer ID prefix, read-only */}
                  {(() => {
                    const enterprise = deriveEnterprise(reviewerId);
                    return enterprise ? (
                      <div className="space-y-2">
                        <Label htmlFor="rev-org" className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          Enterprise Organisation
                        </Label>
                        <div className="relative">
                          <Input
                            id="rev-org"
                            type="text"
                            value={`${enterprise.code} — ${enterprise.name}`}
                            readOnly
                            tabIndex={-1}
                            className="bg-muted text-muted-foreground cursor-not-allowed select-none pr-16"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">
                            {enterprise.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          CPSE scope is automatically bound to your Reviewer ID.
                        </p>
                      </div>
                    ) : null;
                  })()}

                  <div className="space-y-2">
                    <Label htmlFor="rev-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="rev-password"
                        name="reviewer_secret_access_key"
                        type={showReviewerPassword ? "text" : "password"}
                        placeholder="Enter reviewer password"
                        value={reviewerPassword}
                        onChange={(e) => setReviewerPassword(e.target.value)}
                        autoComplete="new-password"
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center focus:outline-none"
                        onClick={() => setShowReviewerPassword((prev) => !prev)}
                        title={showReviewerPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showReviewerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white" disabled={loading}>
                    {loading ? 'Authenticating...' : 'Sign in as Reviewer'}
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
