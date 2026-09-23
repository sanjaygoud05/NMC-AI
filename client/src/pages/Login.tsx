import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Shield, Key, AlertCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginAdmin, loginReviewer } = useAuth();

  const [adminPassword, setAdminPassword] = useState('');
  const [reviewerKey, setReviewerKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminDestination = (location.state as any)?.from || '/dashboard';
  const reviewerDestination = '/review';

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginAdmin(adminPassword);
      toast.success('Admin authentication successful');
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
      await loginReviewer(reviewerKey);
      toast.success('Reviewer key accepted');
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
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-lg mb-2">
            NMC
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            National Material Code
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-Driven Standardization & Harmonization Platform
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

            <Tabs defaultValue="admin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="admin" className="gap-2" onClick={() => setError(null)}>
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </TabsTrigger>
                <TabsTrigger value="reviewer" className="gap-2" onClick={() => setError(null)}>
                  <Key className="h-3.5 w-3.5" />
                  Reviewer
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
                    {loading ? 'Authenticating...' : 'Sign in as Admin'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="reviewer">
                <form onSubmit={handleReviewerSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rev-key">Reviewer Key</Label>
                    <Input
                      id="rev-key"
                      type="text"
                      placeholder="Enter reviewer key"
                      value={reviewerKey}
                      onChange={(e) => setReviewerKey(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white" disabled={loading}>
                    {loading ? 'Validating...' : 'Access Review Queue'}
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
