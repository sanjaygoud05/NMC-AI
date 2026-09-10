import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { UserWithRole, useUpdateUserRole, useUpdateUserManager, useUpdateUserProfile, useEligibleManagers } from '@/hooks/useUsers';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type AppRole = Database['public']['Enums']['app_role'];

interface EditUserDialogProps {
  user: UserWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('active');
  
  // Access fields
  const [selectedRole, setSelectedRole] = useState<AppRole>('employee');
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateRole = useUpdateUserRole();
  const updateManager = useUpdateUserManager();
  const updateProfile = useUpdateUserProfile();
  const eligibleManagers = useEligibleManagers(user?.id);

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email);
      setStatus(user.status);
      setSelectedRole(user.role);
      setSelectedManagerId(user.manager?.id || null);
    }
  }, [user]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSave = async () => {
    if (!user) return;

    const trimmedEmail = email.trim();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!validateEmail(trimmedEmail) || trimmedEmail.length > 254) {
      toast.error('Invalid email', {
        description: 'Please enter a valid email address.',
      });
      return;
    }
    if (trimmedFirst.length > 50 || trimmedLast.length > 50) {
      toast.error('Name too long', {
        description: 'First and last name must be 50 characters or fewer.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const promises: Promise<void>[] = [];

      // Check if profile fields changed
      const profileChanged = 
        firstName !== (user.first_name || '') ||
        lastName !== (user.last_name || '') ||
        email !== user.email ||
        status !== user.status;

      if (profileChanged) {
        promises.push(updateProfile.mutateAsync({
          profileId: user.id,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: trimmedEmail,
          status,
        }));
      }

      // Update role if changed
      if (selectedRole !== user.role) {
        promises.push(updateRole.mutateAsync({ userId: user.user_id, newRole: selectedRole }));
      }

      // Update manager if changed
      const currentManagerId = user.manager?.id || null;
      if (selectedManagerId !== currentManagerId) {
        promises.push(updateManager.mutateAsync({ profileId: user.id, managerId: selectedManagerId }));
      }

      await Promise.all(promises);

      toast.success('User updated', {
        description: `Successfully updated ${firstName || email}'s profile.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to update user. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatUserName = (u: UserWithRole) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
    return name || u.email;
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-none">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update profile for {formatUserName(user)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Personal Information Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Personal Information</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="rounded-none"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="rounded-none"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="rounded-none"
              />
              <p className="text-xs text-muted-foreground">
                This updates the display email only. Login credentials remain unchanged.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="rounded-none">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Inactive users may have restricted access to the system.
              </p>
            </div>
          </div>

          {/* Access & Reporting Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Access & Reporting</h4>
            
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
                <SelectTrigger id="role" className="rounded-none">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admins have full access. Managers can approve requests from their direct reports.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manager">Manager</Label>
              <Select 
                value={selectedManagerId || 'none'} 
                onValueChange={(value) => setSelectedManagerId(value === 'none' ? null : value)}
              >
                <SelectTrigger id="manager" className="rounded-none">
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="none">No manager assigned</SelectItem>
                  {eligibleManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {formatUserName(manager)} ({manager.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The manager will receive approval requests from this user.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-none"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSubmitting}
            className="rounded-none"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
