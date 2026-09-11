import {
  LayoutDashboard,
  Upload,
  Search,
  GitMerge,
  CheckSquare,
  Database,
  BarChart3,
  Settings,
  ClipboardCheck,
  LogOut,
  Activity,
  History,
  Layers,
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
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ('admin' | 'manager' | 'employee')[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Data Ingestion',
    url: '/ingest',
    icon: Upload,
  },
  {
    title: 'Dataset History',
    url: '/dataset-history',
    icon: History,
  },
  {
    title: 'Material Explorer',
    url: '/materials',
    icon: Search,
  },
  {
    title: 'Matching & Harmonization',
    url: '/matches',
    icon: GitMerge,
  },
  {
    title: 'Review Queue',
    url: '/review',
    icon: CheckSquare,
  },
  {
    title: 'Common Material Master',
    url: '/common-master',
    icon: Database,
  },
  {
    title: 'Data Quality',
    url: '/data-quality',
    icon: BarChart3,
  },
  {
    title: 'CPSE Analytics',
    url: '/cpse-analytics',
    icon: Activity,
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
  },
];

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();

  const localProfile = (() => {
    try {
      const stored = localStorage.getItem('user_profile_data');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  })();

  const displayName = localProfile?.firstName && localProfile?.lastName
    ? `${localProfile.firstName} ${localProfile.lastName}`
    : profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : localProfile?.email || profile?.email || 'Admin Officer';

  const userInitials = localProfile?.firstName && localProfile?.lastName
    ? `${localProfile.firstName.charAt(0)}${localProfile.lastName.charAt(0)}`.toUpperCase()
    : displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AD';

  const roleLabel = localProfile?.role
    ? localProfile.role.charAt(0).toUpperCase() + localProfile.role.slice(1)
    : role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : 'Admin';

  return (
    <Sidebar className="bg-sidebar-background">
      <SidebarHeader className="h-14 px-4 flex items-center justify-start border-b border-sidebar-border w-full">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground leading-tight">NMC-AI</h1>
            <p className="text-xs text-muted-foreground leading-tight">Material Harmonization</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-0">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-5">
            NAVIGATION
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0">
              {navItems.map((item, index) => (
                <SidebarMenuItem
                  key={item.title}
                  className="animate-slide-in-left opacity-0 [animation-fill-mode:forwards] border-b border-sidebar-border m-0 p-0"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-0">
        <Link
          to="/profile"
          className="flex items-center gap-3 p-4 hover:bg-sidebar-accent transition-colors"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {userInitials}
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
            onClick={(e) => {
              e.preventDefault();
              signOut();
            }}
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
