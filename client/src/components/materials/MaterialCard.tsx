import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Material } from '@/types';

interface MaterialCardProps {
  material: Material;
  onClick?: () => void;
  showCPSE?: boolean;
}

export function MaterialCard({ material, onClick, showCPSE = false }: MaterialCardProps) {
  const formattedDate = format(new Date(material.createdAt), 'MMM d, yyyy');
  
  return (
    <Card 
      className="p-4 flex flex-col gap-3 cursor-pointer card-interactive border-border bg-card"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs font-medium">
            {material.materialCode}
          </Badge>
          <StatusBadge status={material.standardizationStatus} />
        </div>
        
        <p className="text-sm text-foreground truncate">
          {material.description || 'No description provided'}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {showCPSE && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {material.cpseId}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
          {material.category && (
            <span className="text-muted-foreground/70">
              {material.category}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}