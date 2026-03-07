import logo from "@/assets/zentrix-logo.png";
import {
  LayoutDashboard,
  Upload,
  FileSearch,
  Users,
  FlaskConical,
  Brain,
  BarChart3,
  Settings2,
  LogOut,
  Shield,
  FileText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const baseNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "My Submissions", url: "/my-submissions", icon: FileText },
  { title: "Upload Data", url: "/upload", icon: Upload },
  { title: "Upload And Match", url: "/upload-and-match", icon: FileSearch },
  { title: "Patient Matching", url: "/patient-matching", icon: Users },
  { title: "Trial Explorer", url: "/trial-explorer", icon: FlaskConical },
  { title: "Explainable AI", url: "/explainable-ai", icon: Brain },
  { title: "Insights", url: "/insights", icon: BarChart3 },
  { title: "System Overview", url: "/system-overview", icon: Settings2 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = user?.role === "admin"
    ? [{ title: "Admin Panel", url: "/admin", icon: Shield }, ...baseNavItems]
    : baseNavItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center shadow-lg shadow-sidebar-primary/20">
            <img src={logo} alt="Zentrix logo" className="h-8 w-8 rounded-lg" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-sidebar-primary-foreground leading-none tracking-tight">Zentrix</p>
              <p className="text-[11px] text-sidebar-foreground/60 mt-0.5 font-medium">Intelligent Clinical Trial Matching</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="pt-3 px-2">
        <SidebarGroup>
          {!collapsed && (
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold px-3 mb-2">Navigation</p>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isExactActive = item.url === "/" ? location.pathname === "/" : location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`rounded-lg transition-all duration-200 ${
                          isExactActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        }`}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className={`mr-2.5 h-4 w-4 shrink-0 ${isExactActive ? "text-sidebar-primary" : ""}`} />
                        {!collapsed && <span className="text-[13px]">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {!collapsed && (
          <div className="space-y-3">
            <div className="px-2">
              <p className="text-[12px] text-sidebar-primary-foreground/90 font-semibold truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">{user?.email || ""}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void logout()}
              className="w-full justify-start text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
            <div className="flex items-center gap-2 px-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse-slow" />
              <span className="text-[11px] text-sidebar-foreground/50 font-medium">System Online</span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
