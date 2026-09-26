import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Search,
  CheckSquare,
  Database,
  ShieldCheck,
  BarChart3,
  LogIn,
  LogOut,
  GitCompare,
  ShoppingCart,
  UserCheck,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Link, useNavigate } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  /** If set, only show this group when the predicate is true */
  showWhen?: boolean;
}

export function AppSidebar() {
  const { role, isAdmin, isReviewer, canViewReviewQueue, canSubmitDecisions, isAuthenticated, logout, reviewerName, reviewerCpse, reviewerId } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : 'Unauthenticated';

  // ----- Admin-only navigation -----
  const adminGroups: NavGroup[] = [
    {
      label: 'PLATFORM',
      showWhen: isAdmin,
      items: [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
        { title: 'Manage CPSEs', url: '/manage-cpses', icon: Building2 },
        { title: 'Reviewer Directory', url: '/manage-cpses?tab=reviewers', icon: UserCheck },
        { title: 'Material Explorer', url: '/materials', icon: Search },
        { title: 'Common Material Master', url: '/common-master', icon: Database },
      ],
    },
    {
      label: 'REVIEW WORKFLOW',
      showWhen: isAdmin,
      items: [
        { title: 'Review Queue', url: '/review', icon: CheckSquare },
      ],
    },
    {
      label: 'GOVERNANCE & INSIGHTS',
      showWhen: isAdmin,
      items: [
        { title: 'Audit Trail', url: '/audit', icon: ShieldCheck },
        { title: 'Analytics', url: '/analytics', icon: BarChart3 },
      ],
    },
    {
      label: 'PROCUREMENT INTELLIGENCE',
      showWhen: isAdmin,
      items: [
        { title: 'Procurement Intelligence', url: '/procurement-intelligence', icon: ShoppingCart },
      ],
    },
  ];

  // ----- Reviewer-only navigation -----
  const reviewerGroups: NavGroup[] = [
    {
      label: 'REVIEW WORKFLOW',
      showWhen: isReviewer,
      items: [
        { title: 'Review Queue', url: '/review', icon: CheckSquare },
        { title: 'Common Material Master', url: '/common-master', icon: Database },
        { title: 'Material Explorer', url: '/materials', icon: Search },
      ],
    },
    {
      label: 'GOVERNANCE & INSIGHTS',
      showWhen: isReviewer,
      items: [
        { title: 'Audit Trail', url: '/audit', icon: ShieldCheck },
        { title: 'Analytics', url: '/analytics', icon: BarChart3 },
      ],
    },
  ];

  // Pick the correct group list based on role
  const navGroups = isAdmin ? adminGroups : isReviewer ? reviewerGroups : [];

  return (
    <Sidebar className="bg-sidebar border-r border-sidebar-border">
      <SidebarHeader className="h-16 px-4 flex items-center justify-start border-b border-sidebar-border w-full">
        <Link to={isAdmin ? '/dashboard' : isReviewer ? '/review' : '/login'} className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-full overflow-hidden shrink-0 group-hover:scale-105 transition-transform bg-white">
            <img src="/favicon.png" alt="NMC Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-sidebar-foreground leading-tight">
              NMC-AI
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight font-medium">
              National Material Catalog
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-0 overflow-y-auto py-2">
        {navGroups
          .filter((group) => group.showWhen !== false)
          .map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-wider text-muted-foreground px-4 py-1.5 uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5 px-2">
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="h-9 px-3 rounded-md">
                        <NavLink
                          to={item.url}
                          onClick={handleNavClick}
                          className="flex items-center justify-between w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                          activeClassName="bg-primary/10 text-primary font-medium"
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm">{item.title}</span>
                          </div>
                          {item.badge && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {item.badge}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

        {/* Show login prompt if not authenticated */}
        {!isAuthenticated && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground mb-3">
              Sign in to access the platform.
            </p>
            <Link to="/login">
              <Button size="sm" variant="outline" className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10">
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Button>
            </Link>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
              {isAdmin ? (
                <ShieldCheck className="h-4 w-4 text-primary" />
              ) : reviewerName ? (
                reviewerName.charAt(0).toUpperCase()
              ) : (
                <UserCheck className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1 leading-tight">
              <span className="text-xs font-semibold text-sidebar-foreground truncate capitalize">
                {isAuthenticated
                  ? isAdmin
                    ? 'Central Admin'
                    : (reviewerName || 'Reviewer')
                  : 'Not Signed In'}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {isAuthenticated
                  ? isAdmin
                    ? 'National Platform'
                    : reviewerCpse
                      ? `${reviewerCpse} Reviewer`
                      : 'Verified Reviewer'
                  : 'Please sign in'}
              </span>
            </div>
          </div>

          {isAuthenticated ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Link to="/login">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-medium"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Button>
            </Link>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
