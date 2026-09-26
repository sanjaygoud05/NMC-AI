import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { nmcApi } from '@/services/nmcApi';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ShieldCheck,
  UserCheck,
  Building2,
  Search,
  Plus,
  Mail,
  CheckCircle2,
  AlertCircle,
  Power,
  Trash2,
  Users,
  Award,
  Sparkles,
  Eye,
  EyeOff,
  MoreVertical,
  KeyRound,
  UserCog,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

export function ReviewerDirectory() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedCpse, setSelectedCpse] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Add Reviewer Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [cpseCode, setCpseCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sendCredentials, setSendCredentials] = useState(true);

  // Profile & Reset Password Dialogs
  const [profileReviewer, setProfileReviewer] = useState<any | null>(null);
  const [resetReviewer, setResetReviewer] = useState<any | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Fetch Reviewers List
  const { data, isLoading } = useQuery({
    queryKey: ['nmc', 'reviewers-list', selectedCpse, statusFilter, search],
    queryFn: () =>
      nmcApi.reviewers.list({
        cpse_code: selectedCpse === 'ALL' ? undefined : selectedCpse,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search ? search : undefined,
      }),
  });

  // Fetch CPSEs for dropdown
  const { data: cpses } = useQuery({
    queryKey: ['nmc', 'cpses-list'],
    queryFn: () => nmcApi.cpses.list(),
  });

  // Create Reviewer Mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      cpse_code: string;
      designation?: string;
      domain?: string;
      email?: string;
      id?: string;
      password?: string;
    }) => nmcApi.reviewers.create(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Reviewer added to roster');
      if (sendCredentials && email.trim()) {
        toast.info(`Credentials will be sent to ${email.trim()}`);
      }
      setCreateOpen(false);
      setName('');
      setCpseCode('');
      setDesignation('');
      setDomain('');
      setEmail('');
      setReviewerId('');
      setPassword('');
      setShowPassword(false);
      setSendCredentials(true);
      queryClient.invalidateQueries({ queryKey: ['nmc', 'reviewers-list'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add reviewer');
    },
  });

  // Update Status Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      nmcApi.reviewers.update(id, { status }),
    onSuccess: (res) => {
      toast.success(res.message || 'Reviewer status updated');
      queryClient.invalidateQueries({ queryKey: ['nmc', 'reviewers-list'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update reviewer');
    },
  });

  // Revoke Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => nmcApi.reviewers.delete(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Reviewer certification revoked');
      queryClient.invalidateQueries({ queryKey: ['nmc', 'reviewers-list'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to revoke reviewer');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cpseCode) return;
    createMutation.mutate({
      name: name.trim(),
      cpse_code: cpseCode,
      designation: designation.trim() || 'Domain Materials Reviewer',
      domain: domain.trim() || 'Materials Management',
      email: email.trim() || undefined,
      id: reviewerId.trim() || undefined,
      password: password.trim() || undefined,
    });
  };

  const items = data?.items || [];
  const activeCount = data?.active_count ?? items.filter((r: any) => r.status === 'ACTIVE').length;
  const totalCpses = data?.total_cpses ?? new Set(items.map((r: any) => r.cpse_code)).size;
  const totalDecisions = items.reduce((sum: number, r: any) => sum + (r.decisions_count || 0), 0);

  return (
    <div className="space-y-4">

      {/* ── Summary Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/70 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Certified Officers</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">{data?.total ?? items.length}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>Registered Reviewer</span>
          </div>
        </Card>

        <Card className="border-border/70 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Status</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Authorized for review</span>
          </div>
        </Card>

        <Card className="border-border/70 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Covered CPSEs</span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-foreground">{totalCpses}</div>
          <div className="text-[11px] text-muted-foreground">100% enterprise coverage</div>
        </Card>

        <Card className="border-border/70 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Reviews Completed</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-foreground">{totalDecisions}</div>
          <div className="text-[11px] text-muted-foreground">decisions recorded</div>
        </Card>
      </div>

      {/* ── Toolbar: Search + CPSE Filter + Add Reviewer ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reviewer name, CPSE, or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* CPSE Filter */}
          <Select value={selectedCpse} onValueChange={setSelectedCpse}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="All CPSEs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All CPSEs</SelectItem>
              {cpses?.map((c: any) => (
                <SelectItem key={c.id} value={c.code} className="text-xs">
                  {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Status</SelectItem>
              <SelectItem value="ACTIVE" className="text-xs">Active</SelectItem>
              <SelectItem value="SUSPENDED" className="text-xs">Suspended</SelectItem>
            </SelectContent>
          </Select>

          {/* Add Reviewer Button */}
          <Button
            size="sm"
            className="h-9 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Reviewer
          </Button>
        </div>
      </div>

      {/* ── Reviewer Roster Table ── */}
      <Card className="border-border/60 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            Loading reviewer roster...
          </div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Users className="h-8 w-8 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-semibold text-foreground">No reviewers found</p>
            <p className="text-xs text-muted-foreground">Try clearing your filters or create a new reviewer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold text-xs">
                <tr>
                  <th className="py-3 px-4 w-52">Reviewer</th>
                  <th className="py-3 px-4 w-44">CPSE</th>
                  <th className="py-3 px-4 min-w-[220px]">Designation & Domain</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 w-24 text-right">Reviews</th>
                  <th className="py-3 px-4 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((r: any) => {
                  const isActive = r.status === 'ACTIVE';

                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      {/* Reviewer Name & ID */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground text-sm leading-snug">
                          {r.name}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {r.id}
                        </div>
                      </td>

                      {/* CPSE */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground text-xs">
                          {r.cpse_code}
                        </div>
                        {r.cpse_name && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[190px]" title={r.cpse_name}>
                            {r.cpse_name}
                          </div>
                        )}
                      </td>

                      {/* Designation & Domain */}
                      <td className="py-3 px-4">
                        <div className="text-xs text-foreground font-medium">
                          {r.designation}
                          {r.domain && (
                            <span className="text-muted-foreground font-normal"> • {r.domain}</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isActive ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span
                            className={`text-xs font-semibold ${
                              isActive
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {isActive ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                      </td>

                      {/* Reviews */}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground text-xs">
                        {r.decisions_count ?? 0}
                      </td>

                      {/* Actions ⋮ */}
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                              aria-label="Reviewer actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              className="gap-2 text-xs cursor-pointer"
                              onClick={() => setProfileReviewer(r)}
                            >
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-xs cursor-pointer"
                              onClick={() => {
                                setResetReviewer(r);
                                setTempPassword('');
                              }}
                            >
                              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className={`gap-2 text-xs cursor-pointer ${
                                isActive
                                  ? 'text-amber-600 dark:text-amber-400 focus:text-amber-600'
                                  : 'text-emerald-600 dark:text-emerald-400 focus:text-emerald-600'
                              }`}
                              onClick={() =>
                                updateMutation.mutate({
                                  id: r.id,
                                  status: isActive ? 'SUSPENDED' : 'ACTIVE',
                                })
                              }
                              disabled={updateMutation.isPending}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {isActive ? 'Suspend Reviewer' : 'Reactivate Reviewer'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
                              onClick={() => deleteMutation.mutate(r.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove Reviewer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Dialog: View Reviewer Profile ── */}
      <Dialog open={!!profileReviewer} onOpenChange={(open) => !open && setProfileReviewer(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <User className="h-4 w-4 text-primary" />
              Reviewer Profile
            </DialogTitle>
            <DialogDescription className="text-xs">
              Authorized CPSE domain officer details and access status.
            </DialogDescription>
          </DialogHeader>

          {profileReviewer && (
            <div className="space-y-4 py-1 text-xs">
              <div className="bg-muted/40 p-3.5 rounded-lg space-y-2 border border-border/50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{profileReviewer.name}</h3>
                    <p className="font-mono text-[11px] text-muted-foreground">{profileReviewer.id}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded border border-border">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        profileReviewer.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="font-semibold text-[11px]">
                      {profileReviewer.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">CPSE Enterprise</span>
                  <span className="font-semibold text-foreground text-right">
                    {profileReviewer.cpse_code} — {profileReviewer.cpse_name}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Designation</span>
                  <span className="font-medium text-foreground text-right">{profileReviewer.designation}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Domain Expertise</span>
                  <span className="font-medium text-foreground text-right">{profileReviewer.domain}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Enterprise Email</span>
                  <span className="font-mono text-foreground text-right">{profileReviewer.email || 'Not specified'}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Certified Date</span>
                  <span className="text-foreground text-right">{profileReviewer.certified_date || 'N/A'}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Reviews Recorded</span>
                  <span className="font-mono font-bold text-foreground text-right">{profileReviewer.decisions_count ?? 0}</span>
                </div>
              </div>

              <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto h-9 text-xs"
                  onClick={() => {
                    const r = profileReviewer;
                    setProfileReviewer(null);
                    setResetReviewer(r);
                    setTempPassword('');
                  }}
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1" />
                  Reset Password
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full sm:w-auto h-9 text-xs"
                  onClick={() => setProfileReviewer(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Reset Password ── */}
      <Dialog open={!!resetReviewer} onOpenChange={(open) => !open && setResetReviewer(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <KeyRound className="h-4 w-4 text-primary" />
              Reset Reviewer Password
            </DialogTitle>
            <DialogDescription className="text-xs">
              Set a new temporary password for {resetReviewer?.name} ({resetReviewer?.id}).
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!tempPassword.trim()) return;
              toast.success(`Temporary password updated for ${resetReviewer?.name}`);
              if (resetReviewer?.email) {
                toast.info(`New credentials notification sent to ${resetReviewer.email}`);
              }
              setResetReviewer(null);
              setTempPassword('');
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">New Temporary Password</Label>
              <div className="relative">
                <Input
                  type={showResetPassword ? 'text' : 'password'}
                  placeholder="Enter new temporary password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="h-9 text-sm pr-9 font-mono"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto h-9 text-xs"
                onClick={() => setResetReviewer(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!tempPassword.trim()}
                className="w-full sm:w-auto h-9 text-xs"
              >
                Update Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Certify New Reviewer ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl max-h-[90dvh] overflow-y-auto sm:max-h-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Create CPSE Reviewer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Register an authorized CPSE officer to the reviewer roster.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3 py-1 px-0.5">

            {/* Officer Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Officer Full Name</Label>
              <Input
                placeholder="e.g. Rajesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>

            {/* CPSE */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">CPSE</Label>
              <Select value={cpseCode} onValueChange={setCpseCode}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select enterprise" />
                </SelectTrigger>
                <SelectContent>
                  {cpses && cpses.length > 0 ? (
                    cpses.map((c: any) => (
                      <SelectItem key={c.id} value={c.code} className="text-sm">
                        {c.code} — {c.name}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="HPCL">HPCL — Hindustan Petroleum Corporation</SelectItem>
                      <SelectItem value="IOCL">IOCL — Indian Oil Corporation</SelectItem>
                      <SelectItem value="ONGC">ONGC — Oil and Natural Gas Corporation</SelectItem>
                      <SelectItem value="GAIL">GAIL — GAIL (India) Limited</SelectItem>
                      <SelectItem value="BHEL">BHEL — Bharat Heavy Electricals</SelectItem>
                      <SelectItem value="NTPC">NTPC — National Thermal Power Corporation</SelectItem>
                      <SelectItem value="BPCL">BPCL — Bharat Petroleum Corporation</SelectItem>
                      <SelectItem value="CIL">CIL — Coal India Limited</SelectItem>
                      <SelectItem value="SAIL">SAIL — Steel Authority of India</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Official Designation */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Official Designation</Label>
              <Input
                placeholder="e.g. Chief Manager (Materials)"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Domain Expertise */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Domain Expertise</Label>
              <Input
                placeholder="e.g. Valves, Pumps & Static Equipment"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Official Enterprise Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Official Enterprise Email</Label>
              <Input
                type="email"
                placeholder="e.g. rajesh.kumar@hpcl.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="h-9 text-sm"
              />
            </div>

            {/* ── Reviewer Login Credentials divider ── */}
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Reviewer Login Credentials</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Reviewer ID */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Reviewer ID</Label>
                <Input
                  placeholder="e.g. HPCL-REV-009"
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                  className="h-9 text-sm font-mono"
                />
              </div>

              {/* Password with eye toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Temporary password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-9 text-sm pr-9"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Send Credentials Checkbox */}
            <label className="flex items-center gap-2.5 cursor-pointer group select-none pt-0.5">
              <div
                role="checkbox"
                aria-checked={sendCredentials}
                tabIndex={0}
                onClick={() => setSendCredentials(!sendCredentials)}
                onKeyDown={(e) => e.key === ' ' && setSendCredentials(!sendCredentials)}
                className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                  sendCredentials
                    ? 'bg-primary border-primary'
                    : 'border-border bg-background group-hover:border-primary/50'
                }`}
              >
                {sendCredentials && (
                  <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-foreground">
                Send login credentials to official email
                {email.trim() && (
                  <span className="ml-1.5 text-muted-foreground font-mono text-[11px]">({email.trim()})</span>
                )}
              </span>
            </label>

            <DialogFooter className="pt-3 flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
                className="w-full sm:w-auto h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || !name.trim() || !cpseCode}
                className="w-full sm:w-auto h-9"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Reviewer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
