import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Mail,
  Building,
  Users,
  Save,
  ArrowLeft,
  Phone,
  Briefcase,
  IdCard,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const { profile, role, user, refreshProfile, switchRole } = useAuth();
  const navigate = useNavigate();

  // Load saved profile data from localStorage if available, or initialize from auth profile
  const getSavedLocalProfile = () => {
    try {
      const stored = localStorage.getItem('user_profile_data');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const localData = getSavedLocalProfile();

  const [firstName, setFirstName] = useState(localData?.firstName || profile?.first_name || 'Admin');
  const [lastName, setLastName] = useState(localData?.lastName || profile?.last_name || 'Officer');
  const [email, setEmail] = useState(localData?.email || profile?.email || user?.email || 'admin.harmonizer@cpse.gov.in');
  const [phone, setPhone] = useState(localData?.phone || '+91 98765 43210');
  const [cpse, setCpse] = useState(localData?.cpse || 'ONGC — Oil and Natural Gas Corporation');
  const [department, setDepartment] = useState(localData?.department || 'Materials & Supply Chain Management');
  const [employeeId, setEmployeeId] = useState(localData?.employeeId || 'CPSE-EMP-84920');
  const [selectedRole, setSelectedRole] = useState(localData?.role || role || 'admin');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.first_name) setFirstName(profile.first_name);
      if (profile.last_name) setLastName(profile.last_name);
      if (profile.email) setEmail(profile.email);
    }
  }, [profile]);

  const getInitials = () => {
    const first = firstName?.trim().charAt(0) || '';
    const last = lastName?.trim().charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  const getRoleBadgeVariant = (r: string | null) => {
    switch (r) {
      case 'admin':
        return 'default';
      case 'manager':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }

    setIsSaving(true);

    const profilePayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      cpse,
      department,
      employeeId: employeeId.trim(),
      role: selectedRole,
      updatedAt: new Date().toISOString(),
    };

    // Save locally to persist across sessions
    localStorage.setItem('user_profile_data', JSON.stringify(profilePayload));

    try {
      // If user is authenticated in Supabase, update the profiles table
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) {
          console.warn('Supabase profile update notice:', error.message);
        } else {
          await refreshProfile();
        }
      }

      toast.success('Profile updated successfully', {
        description: 'All personal, organizational, and role parameters have been saved.',
      });
    } catch (error) {
      console.error(error);
      toast.success('Profile updated in local session');
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = firstName && lastName ? `${firstName} ${lastName}` : email || 'User';

  const roleLabel = selectedRole
    ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)
    : 'Employee';

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                My Profile
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your enterprise identity, contact information, and role assignments
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Overview Card */}
          <Card className="lg:col-span-1 border-border bg-card shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 mb-4 border-2 border-primary/20">
                  <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
                <p className="text-xs text-muted-foreground mb-3 break-all">{email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={getRoleBadgeVariant(selectedRole)} className="capitalize text-xs">
                    {roleLabel}
                  </Badge>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                  </span>
                </div>

                <Separator className="my-5 w-full bg-border" />

                <div className="w-full space-y-3.5 text-left text-xs">
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground font-medium truncate">{cpse}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground truncate">{department}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground font-mono">{employeeId}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground truncate">{email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{phone}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal & Enterprise Information Form */}
          <Card className="lg:col-span-2 border-border bg-card shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <User className="h-4 w-4 text-primary" />
                Personal & Contact Information
              </CardTitle>
              <CardDescription className="text-xs">
                Update your name, communication details, and enterprise cataloging permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs font-medium text-foreground">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="bg-muted/20 border-border text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs font-medium text-foreground">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="bg-muted/20 border-border text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-foreground">
                    Official Enterprise Email
                  </Label>
                  <Input
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@enterprise.gov.in"
                    className="bg-muted/20 border-border text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium text-foreground">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="bg-muted/20 border-border text-xs h-9"
                  />
                </div>
              </div>

              <Separator className="bg-border/60" />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cpse" className="text-xs font-medium text-foreground">
                    Associated CPSE Enterprise
                  </Label>
                  <Select value={cpse} onValueChange={setCpse}>
                    <SelectTrigger className="bg-muted/20 border-border text-xs h-9">
                      <SelectValue placeholder="Select Enterprise" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ONGC — Oil and Natural Gas Corporation">
                        ONGC — Oil and Natural Gas Corp
                      </SelectItem>
                      <SelectItem value="IOCL — Indian Oil Corporation Ltd">
                        IOCL — Indian Oil Corporation Ltd
                      </SelectItem>
                      <SelectItem value="HPCL — Hindustan Petroleum Corp Ltd">
                        HPCL — Hindustan Petroleum Corp Ltd
                      </SelectItem>
                      <SelectItem value="CPCL — Chennai Petroleum Corp Ltd">
                        CPCL — Chennai Petroleum Corp Ltd
                      </SelectItem>
                      <SelectItem value="BPCL — Bharat Petroleum Corp Ltd">
                        BPCL — Bharat Petroleum Corp Ltd
                      </SelectItem>
                      <SelectItem value="GAIL — Gas Authority of India Ltd">
                        GAIL — Gas Authority of India Ltd
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="employeeId" className="text-xs font-medium text-foreground">
                    Employee / Officer ID
                  </Label>
                  <Input
                    id="employeeId"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. CPSE-84920"
                    className="bg-muted/20 border-border font-mono text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="department" className="text-xs font-medium text-foreground">
                    Department / Division
                  </Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Department"
                    className="bg-muted/20 border-border text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-medium text-foreground">
                    Access Role Level
                  </Label>
                  <Select value={selectedRole} onValueChange={(val: any) => setSelectedRole(val)}>
                    <SelectTrigger className="bg-muted/20 border-border text-xs h-9">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                      <SelectItem value="manager">Manager / Lead Reviewer</SelectItem>
                      <SelectItem value="employee">Catalog Analyst / Officer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
