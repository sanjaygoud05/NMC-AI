import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  Users, 
  Settings,
  ClipboardCheck,
  LogOut,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ('admin' | 'manager' | 'employee')[];
}

const getMainNavItems = (isAdmin: boolean): NavItem[] => [
  { 
    title: 'Dashboard', 
    url: '/dashboard', 
    icon: LayoutDashboard 
  },
  { 
    title: isAdmin ? 'All Requests' : 'My Requests', 
    url: '/requests', 
    icon: FileText 
  },
  { 
    title: 'Pending Approvals', 
    url: '/approvals', 
    icon: CheckSquare,
    roles: ['admin', 'manager']
  },
];

const adminNavItems: NavItem[] = [
  { 
    title: 'User Management', 
    url: '/admin/users', 
    icon: Users,
    roles: ['admin']
  },
  { 
    title: 'Settings', 
    url: '/admin/settings', 
    icon: Settings,
    roles: ['admin']
  },
];

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();

  const filterByRole = (items: NavItem[]) => {
    return items.filter(item => {
      if (!item.roles) return true;
      return role && item.roles.includes(role);
    });
  };

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email || 'User';

  const roleLabel = role 
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : 'Employee';

  return (
    <Sidebar className="bg-sidebar-background">
      <SidebarHeader className="h-14 px-4 flex items-center justify-start border-b border-sidebar-border w-full">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground leading-tight">Request Tracker</h1>
            <p className="text-xs text-muted-foreground leading-tight">Approvals & Workflow</p>
          </div>
        </div>
      </SidebarHeader>

      

      <SidebarContent className="px-0">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-5">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0">
              {filterByRole(getMainNavItems(role === 'admin')).map((item, index) => (
                <SidebarMenuItem key={item.title} className="animate-slide-in-left opacity-0 [animation-fill-mode:forwards] border-b border-sidebar-border m-0 p-0" style={{ animationDelay: `${index * 50}ms` }}>
                  <SidebarMenuButton asChild className="h-10 m-0 p-0">
                    <NavLink 
                      to={item.url} 
                      className="flex items-center justify-start gap-3 px-5 h-10 w-full rounded-none text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === 'admin' && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-5">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0">
                  {filterByRole(adminNavItems).map((item, index) => (
                    <SidebarMenuItem key={item.title} className="animate-slide-in-left opacity-0 [animation-fill-mode:forwards] border-b border-sidebar-border m-0 p-0" style={{ animationDelay: `${(index + 3) * 50}ms` }}>
                      <SidebarMenuButton asChild className="h-10 m-0 p-0">
                        <NavLink 
                          to={item.url} 
                          className="flex items-center justify-start gap-3 px-5 h-10 w-full rounded-none text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
                          activeClassName="bg-sidebar-accent text-primary font-medium"
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-0">
        {/* Profile Section */}
        <Link 
          to="/profile" 
          className="flex items-center gap-3 p-4 hover:bg-sidebar-accent transition-colors"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground">{roleLabel}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={(e) => { e.preventDefault(); signOut(); }}
            className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent shrink-0"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
