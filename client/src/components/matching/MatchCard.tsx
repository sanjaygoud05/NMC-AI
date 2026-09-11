import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Calendar, Check, X, Eye, Percent } from 'lucide-react';
import { format } from 'date-fns';
import type { MaterialMatch, Material } from '@/types';

interface MatchCardProps {
  match: MaterialMatch;
  sourceMaterial?: Material | null;
  candidateMaterial?: Material | null;
  onAccept?: () => void;
  onReject?: () => void;
  onViewDetails?: () => void;
  isProcessing?: boolean;
}

export function MatchCard({
  match,
  sourceMaterial,
  candidateMaterial,
  onAccept,
  onReject,
  onViewDetails,
  isProcessing = false,
}: MatchCardProps) {
  const formattedDate = format(new Date(match.createdAt), 'MMM d, yyyy');
  
  return (
    <Card className="p-4 space-y-4 border-border bg-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-medium">
              {sourceMaterial?.materialCode || 'Unknown'}
            </Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="text-xs font-medium">
              {candidateMaterial?.materialCode || 'Unknown'}
            </Badge>
            <StatusBadge status={match.decision} />
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Percent className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {Math.round(match.confidenceScore * 100)}% confidence
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {sourceMaterial?.cpseId || 'Unknown'}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          size="sm"
          variant="default"
          onClick={onAccept}
          disabled={isProcessing}
          className="gap-1 flex-1"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onReject}
          disabled={isProcessing}
          className="gap-1 flex-1"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onViewDetails}
          className="gap-1"
        >
          <Eye className="h-3.5 w-3.5" />
          Details
        </Button>
      </div>
    </Card>
  );
}