import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Input } from '@/components/ui/input';
import { Users as UsersIcon, Search } from 'lucide-react';
import { useAllUsers, UserWithRole } from '@/hooks/useUsers';
import { UserTable } from '@/components/admin/UserTable';
import { EditUserDialog } from '@/components/admin/EditUserDialog';

export default function Users() {
  const { data: users, isLoading } = useAllUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.email.toLowerCase().includes(query) ||
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleEditUser = (user: UserWithRole) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingUser(null);
    }
  };

  return (
    <AppLayout requireRole={['admin']}>
      <div className="space-y-8">
        <PageHeader
          title="User Management"
          description={`Manage users, roles, and manager assignments${users ? ` • ${users.length} user${users.length !== 1 ? 's' : ''}` : ''}`}
        />

        <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card rounded-none" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-foreground">All Users</CardTitle>
                <CardDescription>
                  View and manage all system users, their roles, and reporting structure
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-none"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!isLoading && filteredUsers.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title={searchQuery ? 'No users found' : 'No users yet'}
                description={searchQuery 
                  ? 'Try adjusting your search query' 
                  : 'Users will appear here once they sign up'
                }
              />
            ) : (
              <UserTable 
                users={filteredUsers} 
                isLoading={isLoading} 
                onEditUser={handleEditUser}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <EditUserDialog
        user={editingUser}
        open={dialogOpen}
        onOpenChange={handleDialogChange}
      />
    </AppLayout>
  );
}
