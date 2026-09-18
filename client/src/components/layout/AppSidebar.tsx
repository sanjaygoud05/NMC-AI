import {
  LayoutDashboard,
  Upload,
  Search,
  GitMerge,
  CheckSquare,
  Database,
  BarChart3,
  Settings,
  LogOut,
  Activity,
  History,
  Layers,
  FlaskConical,
  Map,
  ShoppingCart,
  Sliders,
  Plug,
  FileBarChart,
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'DATA PIPELINE',
    items: [
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
        title: 'Standardization',
        url: '/standardization',
        icon: Sliders,
      },
      {
        title: 'Data Quality',
        url: '/data-quality',
        icon: BarChart3,
      },
    ],
  },
  {
    label: 'AI INTELLIGENCE',
    items: [
      {
        title: 'AI Matching',
        url: '/matches',
        icon: GitMerge,
      },
      {
        title: 'Review Queue',
        url: '/review',
        icon: CheckSquare,
      },
    ],
  },
  {
    label: 'MASTER DATA',
    items: [
      {
        title: 'Common Material Master',
        url: '/common-master',
        icon: Database,
      },
      {
        title: 'Legacy Mapping',
        url: '/legacy-mapping',
        icon: Map,
      },
    ],
  },
  {
    label: 'ANALYTICS & INSIGHTS',
    items: [
      {
        title: 'Procurement Intelligence',
        url: '/procurement',
        icon: ShoppingCart,
      },
      {
        title: 'CPSE Analytics',
        url: '/cpse-analytics',
        icon: Activity,
      },
      {
        title: 'Evaluation',
        url: '/evaluation',
        icon: FlaskConical,
      },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      {
        title: 'SAP / ERP Integration',
        url: '/settings',
        icon: Plug,
      },
      {
        title: 'Settings',
        url: '/settings',
        icon: Settings,
      },
    ],
  },
];

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

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
          <img
            src="/favicon.png"
            alt="NMC Logo"
            className="h-10 w-10 object-contain"
          />
          <div>
            <h1 className="font-semibold text-sidebar-foreground leading-tight">NMC-AI</h1>
            <p className="text-xs text-muted-foreground leading-tight">Material Harmonization</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-0 overflow-y-auto">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-0">
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground px-5 pt-4 pb-1">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {group.items.map((item, index) => (
                  <SidebarMenuItem
                    key={item.title}
                    className="animate-slide-in-left opacity-0 [animation-fill-mode:forwards] m-0 p-0"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <SidebarMenuButton asChild className="h-9 m-0 p-0">
                      <NavLink
                        to={item.url}
                        onClick={handleNavClick}
                        className="flex items-center justify-start gap-3 px-5 h-9 w-full rounded-none text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
                        activeClassName="bg-sidebar-accent text-primary font-medium border-l-2 border-primary"
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
            <div className="mx-5 border-b border-sidebar-border mt-2" />
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-0">
        <Link
          to="/profile"
          onClick={handleNavClick}
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

