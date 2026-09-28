import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Shield, Key, AlertCircle, ArrowRight, Eye, EyeOff, Building2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { CPSE_PRESETS, getCpseLogo } from '@/lib/cpseLogos';

const enterpriseParticipants = CPSE_PRESETS.map((p, idx) => ({
  id: idx + 1,
  name: p.code,
  designation: p.fullName,
  image: p.logo,
}));

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
  // Controlled tab state — initialized once so re-renders cannot reset it unexpectedly
  const [activeTab, setActiveTab] = useState<'admin' | 'reviewer'>(
    locationState?.tab === 'reviewer' ? 'reviewer' : 'admin'
  );

  // Initial password should be empty (no prefill)
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [reviewerId, setReviewerId] = useState('');
  const [reviewerPassword, setReviewerPassword] = useState('');
  const [showReviewerPassword, setShowReviewerPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSubmissionRef = useRef<'admin' | 'reviewer' | null>(null);

  const adminDestination = locationState?.from || '/dashboard';
  const reviewerDestination = '/review';

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setError('Please enter the admin password');
      return;
    }
    setError(null);
    setLoading(true);
    activeSubmissionRef.current = 'admin';

    try {
      await loginAdmin(adminPassword);
      if (activeSubmissionRef.current !== 'admin') return;

      toast.success('Central Administrator authenticated');
      // Route Central Admin directly to /dashboard, avoiding reviewer gates or circular login loops
      const dest = (adminDestination && adminDestination !== '/login' && adminDestination !== '/review')
        ? adminDestination
        : '/dashboard';
      navigate(dest, { replace: true, state: {} });
    } catch (err: any) {
      if (activeSubmissionRef.current !== 'admin') return;
      setError(err.message || 'Invalid admin credentials');
      toast.error('Authentication failed');
    } finally {
      if (activeSubmissionRef.current === 'admin') {
        setLoading(false);
        activeSubmissionRef.current = null;
      }
    }
  };

  const handleReviewerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewerId.trim()) {
      setError('Please enter your Reviewer ID');
      return;
    }
    if (!reviewerPassword.trim()) {
      setError('Please enter your reviewer password');
      return;
    }
    setError(null);
    setLoading(true);
    activeSubmissionRef.current = 'reviewer';

    try {
      await loginReviewer({ reviewerId, password: reviewerPassword });
      if (activeSubmissionRef.current !== 'reviewer') return;

      toast.success(`Welcome, Reviewer (${reviewerId})`);
      navigate(reviewerDestination, { replace: true, state: {} });
    } catch (err: any) {
      if (activeSubmissionRef.current !== 'reviewer') return;
      setError(err.message || 'Invalid reviewer credentials');
      toast.error('Authentication failed');
    } finally {
      if (activeSubmissionRef.current === 'reviewer') {
        setLoading(false);
        activeSubmissionRef.current = null;
      }
    }
  };  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 bg-muted/20">
      {/* ── Container: Single-column on mobile, dual-column on desktop ── */}
      <div className="w-full max-w-md lg:max-w-[1040px] bg-card border border-border/80 shadow-2xl rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 items-stretch lg:min-h-[580px]">
        {/* ── Left Side: Pure Full Image (Hidden in mobile view, visible on lg screens) ── */}
        <div className="hidden lg:flex relative w-full h-full min-h-[580px] bg-muted/20 border-r border-border/70 items-center justify-center overflow-hidden">
          <img
            src="/auth.jpeg"
            alt="National Material Harmonization Platform"
            className="w-full h-full object-cover select-none"
          />
        </div>

        {/* ── Right Side: Credentials & Participating Enterprises (Full width on mobile) ── */}
        <div className="relative w-full p-5 sm:p-6 lg:p-7 flex flex-col justify-between bg-card min-h-[520px] lg:min-h-[580px]">
          <div className="w-full max-w-sm mx-auto space-y-3 my-auto">
            {/* Above Logo and Title attached directly to login form */}
            <div className="text-center space-y-1">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full overflow-hidden bg-white shadow-sm border border-border/80 p-0.5 mb-0.5">
                <img src="/favicon.png" alt="NMC Logo" className="h-full w-full object-contain rounded-full scale-[1.45]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Sign In to NMC-AI
              </h1>
              <p className="text-xs text-muted-foreground">
                National Material Catalog & Cross-CPSE Harmonization
              </p>
            </div>

            {/* Login Card */}
            <Card className="border-border/70 shadow-sm rounded-xl">
              <CardContent className="p-4 sm:p-4.5">
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Tabs
                  value={activeTab}
                  onValueChange={(val) => {
                    if (!loading) {
                      setError(null);
                      setActiveTab(val as 'admin' | 'reviewer');
                    }
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger
                      value="admin"
                      className="gap-2 transition-opacity"
                      disabled={loading}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Central Admin
                    </TabsTrigger>
                    <TabsTrigger
                      value="reviewer"
                      className="gap-2 transition-opacity"
                      disabled={loading}
                    >
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
                        <Label htmlFor="admin-pass" className="text-xs font-semibold">Admin Password</Label>
                        <div className="relative">
                          <Input
                            id="admin-pass"
                            name="admin_master_key"
                            type={showAdminPassword ? "text" : "password"}
                            placeholder="Enter admin password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            autoComplete="new-password"
                            className="pr-10 text-xs h-9"
                            disabled={loading}
                            required
                          />
                          <button
                            type="button"
                            className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center focus:outline-none"
                            onClick={() => setShowAdminPassword((prev) => !prev)}
                            title={showAdminPassword ? "Hide password" : "Show password"}
                            tabIndex={-1}
                            disabled={loading}
                          >
                            {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full gap-2 text-xs font-semibold h-9" disabled={loading || !adminPassword.trim()}>
                        {loading ? (
                          <>
                            <RotateCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Authenticating as Central Admin...</span>
                          </>
                        ) : (
                          <>
                            <span>Sign in as Central Admin</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="reviewer">
                    <form onSubmit={handleReviewerSubmit} className="space-y-4" autoComplete="off">
                      {/* Decoy fields to capture aggressive browser autofill */}
                      <input type="text" name="fake_reviewer_user" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="username" />
                      <input type="password" name="fake_reviewer_pass" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="current-password" />

                      <div className="space-y-2">
                        <Label htmlFor="rev-id" className="text-xs font-semibold">Reviewer ID</Label>
                        <Input
                          id="rev-id"
                          name="reviewer_code_identifier"
                          type="text"
                          placeholder="Enter Reviewer ID (e.g. HPCL-REV-001)"
                          value={reviewerId}
                          onChange={(e) => setReviewerId(e.target.value)}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          disabled={loading}
                          className="text-xs h-9 font-mono"
                          required
                        />
                      </div>

                      {/* Enterprise Organisation — auto-derived from Reviewer ID prefix, read-only */}
                      {(() => {
                        const enterprise = deriveEnterprise(reviewerId);
                        const logo = enterprise ? getCpseLogo(enterprise.code, enterprise.name) : null;
                        return enterprise ? (
                          <div className="space-y-1.5">
                            <Label htmlFor="rev-org" className="flex items-center gap-1.5 text-xs font-semibold">
                              {logo ? (
                                <span className="h-4 w-4 rounded-full overflow-hidden border border-border/80 bg-white inline-flex items-center justify-center shrink-0 p-0.5 shadow-2xs">
                                  <img src={logo} alt="" className="h-full w-full object-contain rounded-full" />
                                </span>
                              ) : (
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              Enterprise Organisation
                            </Label>
                            <div className="relative">
                              <Input
                                id="rev-org"
                                type="text"
                                value={`${enterprise.code} — ${enterprise.name}`}
                                readOnly
                                tabIndex={-1}
                                className="bg-muted text-muted-foreground cursor-not-allowed select-none pr-20 text-xs h-9 font-medium"
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                {logo && (
                                  <span className="h-4 w-4 rounded-full overflow-hidden border border-border/60 bg-white inline-flex items-center justify-center shrink-0 p-0.5">
                                    <img src={logo} alt="" className="h-full w-full object-contain rounded-full" />
                                  </span>
                                )}
                                <span className="text-[10px] font-bold font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">
                                  {enterprise.code}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      <div className="space-y-2">
                        <Label htmlFor="rev-password" className="text-xs font-semibold">Password</Label>
                        <div className="relative">
                          <Input
                            id="rev-password"
                            name="reviewer_secret_access_key"
                            type={showReviewerPassword ? "text" : "password"}
                            placeholder="Enter reviewer password"
                            value={reviewerPassword}
                            onChange={(e) => setReviewerPassword(e.target.value)}
                            autoComplete="new-password"
                            className="pr-10 text-xs h-9"
                            disabled={loading}
                            required
                          />
                          <button
                            type="button"
                            className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center focus:outline-none"
                            onClick={() => setShowReviewerPassword((prev) => !prev)}
                            title={showReviewerPassword ? "Hide password" : "Show password"}
                            tabIndex={-1}
                            disabled={loading}
                          >
                            {showReviewerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-9"
                        disabled={loading || !reviewerId.trim() || !reviewerPassword.trim()}
                      >
                        {loading ? (
                          <>
                            <RotateCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Authenticating Reviewer...</span>
                          </>
                        ) : (
                          <>
                            <span>Sign in as Reviewer</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* ── Participating Enterprises under Credentials ── */}
            <div className="pt-2.5 text-center space-y-1.5 border-t border-border/60">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Participating Enterprises
              </span>
              <div className="flex items-center justify-center -space-x-1.5 py-0.5">
                {enterpriseParticipants.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-full overflow-hidden h-9 w-9 border-2 border-background bg-white shadow-sm flex items-center justify-center p-0.5"
                    title={item.name}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="object-contain h-full w-full rounded-full scale-115"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Security footer */}
          <div className="pt-2 text-center text-[10px] text-muted-foreground/70 border-t border-border/40 mt-1">
            Protected National Infrastructure • Authorized Access Only
          </div>
        </div>
      </div>
    </div>
  );
}
