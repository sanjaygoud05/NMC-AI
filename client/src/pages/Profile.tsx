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
import { User, Mail, Building, Users, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const nameSchema = z
  .string()
  .trim()
  .max(50, 'Must be less than 50 characters');

export default function Profile() {
  const { profile, role, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
  }, [profile]);

  const getInitials = () => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case 'admin': return 'default';
      case 'manager': return 'secondary';
      default: return 'outline';
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const firstResult = nameSchema.safeParse(firstName);
    const lastResult = nameSchema.safeParse(lastName);
    if (!firstResult.success || !lastResult.success) {
      toast.error('Validation Error', {
        description:
          (firstResult.success ? lastResult : firstResult).error.errors[0].message,
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstResult.data,
          last_name: lastResult.data,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh the profile in the global context
      await refreshProfile();

      toast.success('Profile updated', {
        description: 'Your profile has been saved successfully.',
      });
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to update profile. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = firstName && lastName 
    ? `${firstName} ${lastName}` 
    : profile?.email || 'User';

  const roleLabel = role 
    ? role.charAt(0).toUpperCase() + role.slice(1) 
    : 'Employee';

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-up opacity-0 [animation-fill-mode:forwards]">
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and update your personal information
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Overview Card */}
          <Card className="lg:col-span-1 animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: '50ms' }}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 mb-4">
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-lg font-medium text-foreground">{displayName}</h2>
                <p className="text-sm text-muted-foreground mb-3 break-all">{profile?.email}</p>
                <Badge variant={getRoleBadgeVariant(role)}>
                  {roleLabel}
                </Badge>
                
                <Separator className="my-4 w-full bg-border" />
                
                <div className="w-full space-y-3 text-left">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground truncate">{profile?.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">
                      {profile?.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information Card */}
          <Card className="lg:col-span-2 animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details here
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-foreground">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-foreground">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    className="bg-input border-border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email Address</Label>
                <Input
                  id="email"
                  value={profile?.email || ''}
                  disabled
                  className="bg-muted border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact an administrator if you need to update it.
                </p>
              </div>

              <Separator className="bg-border" />

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Work Information Card */}
          <Card className="lg:col-span-3 animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: '150ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Users className="h-5 w-5" />
                Work Information
              </CardTitle>
              <CardDescription>
                Your role and organizational details (read-only)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-foreground">Role</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted">
                    <Badge variant={getRoleBadgeVariant(role)} className="font-normal">
                      {roleLabel}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Status</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted">
                    <Badge 
                      variant={profile?.status === 'active' ? 'default' : 'secondary'}
                      className="font-normal"
                    >
                      {profile?.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label className="text-foreground">Manager</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted text-sm text-muted-foreground">
                    {profile?.manager_id ? 'Assigned' : 'Not assigned'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
