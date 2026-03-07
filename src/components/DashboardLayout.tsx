import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Separator } from "@/components/ui/separator";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border bg-card/70 backdrop-blur-sm px-4 shrink-0 sticky top-0 z-10">
            <SidebarTrigger className="mr-3 hover:bg-accent rounded-lg transition-colors" />
            <Separator orientation="vertical" className="h-5 mr-3" />
            <span className="text-sm text-muted-foreground font-medium">AI Clinical Trial Matching Engine</span>
          </header>
          <main className="flex-1 overflow-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-background pattern-dots relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="relative">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
