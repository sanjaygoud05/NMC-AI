import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileQuestion } from 'lucide-react';
import type { RequestType } from '@/hooks/useRequestTypes';

interface RequestTypeSelectorProps {
  requestTypes: RequestType[];
  isLoading: boolean;
  onSelect: (type: RequestType) => void;
}

export function RequestTypeSelector({ requestTypes, isLoading, onSelect }: RequestTypeSelectorProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (requestTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-muted mb-4">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">No Request Types Available</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          There are no active request types configured. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requestTypes.map((type) => (
        <Card
          key={type.id}
          interactive
          className="p-4 cursor-pointer"
          onClick={() => onSelect(type)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground">{type.name}</h4>
              {type.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {type.description}
                </p>
              )}
            </div>
            {type.category && (
              <Badge variant="outline" className="shrink-0 text-xs">
                {type.category}
              </Badge>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
