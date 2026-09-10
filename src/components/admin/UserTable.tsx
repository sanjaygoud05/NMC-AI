import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { UserWithRole } from '@/hooks/useUsers';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreakpoint } from '@/hooks/use-mobile';

interface UserTableProps {
  users: UserWithRole[];
  isLoading: boolean;
  onEditUser: (user: UserWithRole) => void;
}

function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'admin':
      return 'default';
    case 'manager':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getStatusColor(status: string): string {
  return status === 'active' 
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
    : 'bg-muted text-muted-foreground';
}

function formatName(firstName: string | null, lastName: string | null, email: string): string {
  const name = [firstName, lastName].filter(Boolean).join(' ');
  return name || email.split('@')[0];
}

function UserCard({ user, onEdit }: { user: UserWithRole; onEdit: () => void }) {
  return (
    <Card className="p-4 border-border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground truncate">
              {formatName(user.first_name, user.last_name, user.email)}
            </span>
            <Badge 
              variant={getRoleBadgeVariant(user.role)}
              className="capitalize text-xs"
            >
              {user.role}
            </Badge>
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${getStatusColor(user.status)}`}>
              {user.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            Manager: {user.manager ? user.manager.name : <span className="italic">Not assigned</span>}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8 shrink-0"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit user</span>
        </Button>
      </div>
    </Card>
  );
}

export function UserTable({ users, isLoading, onEditUser }: UserTableProps) {
  const { isMobileOrTablet } = useBreakpoint();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  // Mobile/Tablet: Card layout
  if (isMobileOrTablet) {
    return (
      <div className="space-y-3">
        {users.map((user) => (
          <UserCard 
            key={user.id} 
            user={user} 
            onEdit={() => onEditUser(user)} 
          />
        ))}
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className="border border-border rounded-none overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-medium">User</TableHead>
            <TableHead className="font-medium">Email</TableHead>
            <TableHead className="font-medium">Role</TableHead>
            <TableHead className="font-medium">Manager</TableHead>
            <TableHead className="font-medium">Status</TableHead>
            <TableHead className="font-medium w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">
                {formatName(user.first_name, user.last_name, user.email)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.email}
              </TableCell>
              <TableCell>
                <Badge 
                  variant={getRoleBadgeVariant(user.role)}
                  className="capitalize"
                >
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.manager ? user.manager.name : (
                  <span className="text-muted-foreground/60 italic">Not assigned</span>
                )}
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-none ${getStatusColor(user.status)}`}>
                  {user.status}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEditUser(user)}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit user</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
