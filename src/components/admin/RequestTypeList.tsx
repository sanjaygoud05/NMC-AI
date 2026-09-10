import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/EmptyState';
import { RequestTypeDialog } from './RequestTypeDialog';
import {
  useAllRequestTypes,
  useToggleRequestTypeActive,
  RequestType,
} from '@/hooks/useRequestTypesAdmin';
import { Plus, Pencil, FileText } from 'lucide-react';
import { Json } from '@/integrations/supabase/types';
import { useBreakpoint } from '@/hooks/use-mobile';

function countFormFields(schema: Json | null): number {
  if (!schema || !Array.isArray(schema)) return 0;
  return schema.length;
}

// Card component for mobile/tablet view
function RequestTypeCard({ 
  type, 
  onEdit, 
  onToggleActive, 
  isToggling 
}: { 
  type: RequestType; 
  onEdit: () => void; 
  onToggleActive: () => void;
  isToggling: boolean;
}) {
  return (
    <Card className="p-4 border-border bg-card">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {type.category && (
              <Badge variant="secondary" className="text-xs">{type.category}</Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {countFormFields(type.form_schema)} fields
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={type.is_active}
              onCheckedChange={onToggleActive}
              disabled={isToggling}
              aria-label={`Toggle ${type.name} active status`}
            />
          </div>
        </div>
        <div>
          <p className="font-medium text-foreground">{type.name}</p>
          {type.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {type.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {type.is_active ? 'Active' : 'Inactive'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function RequestTypeList() {
  const { data: requestTypes, isLoading, error } = useAllRequestTypes();
  const toggleActiveMutation = useToggleRequestTypeActive();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<RequestType | null>(null);
  const { isMobileOrTablet } = useBreakpoint();

  const handleCreate = () => {
    setEditingType(null);
    setDialogOpen(true);
  };

  const handleEdit = (type: RequestType) => {
    setEditingType(type);
    setDialogOpen(true);
  };

  const handleToggleActive = (type: RequestType) => {
    toggleActiveMutation.mutate({
      id: type.id,
      is_active: !type.is_active,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p className="text-sm text-destructive">
          Failed to load request types. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {requestTypes?.length || 0} request type{requestTypes?.length !== 1 ? 's' : ''} configured
        </p>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Request Type
        </Button>
      </div>

      {!requestTypes?.length ? (
        <EmptyState
          icon={FileText}
          title="No request types configured"
          description="Create your first request type to allow employees to submit requests."
          action={{
            label: 'Create Request Type',
            icon: Plus,
            onClick: handleCreate,
          }}
        />
      ) : isMobileOrTablet ? (
        // Mobile/Tablet: Card layout
        <div className="space-y-3">
          {requestTypes.map((type) => (
            <RequestTypeCard
              key={type.id}
              type={type}
              onEdit={() => handleEdit(type)}
              onToggleActive={() => handleToggleActive(type)}
              isToggling={toggleActiveMutation.isPending}
            />
          ))}
        </div>
      ) : (
        // Desktop: Table layout
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Fields</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{type.name}</p>
                      {type.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {type.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {type.category ? (
                      <Badge variant="secondary">{type.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {countFormFields(type.form_schema)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={type.is_active}
                        onCheckedChange={() => handleToggleActive(type)}
                        disabled={toggleActiveMutation.isPending}
                        aria-label={`Toggle ${type.name} active status`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {type.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(type)}
                      aria-label={`Edit ${type.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RequestTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requestType={editingType}
      />
    </div>
  );
}
