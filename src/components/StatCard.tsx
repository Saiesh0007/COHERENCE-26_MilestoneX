import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  accent?: boolean;
}

export function StatCard({ title, value, icon, subtitle, accent }: StatCardProps) {
  return (
    <Card className={`glass-card-elevated hover:shadow-md transition-all duration-300 group ${accent ? "stat-glow" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <div className={`p-2 rounded-lg ${accent ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"} transition-colors group-hover:bg-primary/15 group-hover:text-primary`}>
            {icon}
          </div>
        </div>
        <div className="text-3xl font-bold text-foreground tracking-tight">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1.5 font-medium">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
