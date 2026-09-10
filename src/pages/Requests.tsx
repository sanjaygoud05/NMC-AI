import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { RequestCard } from '@/components/requests/RequestCard';
import { NewRequestSheet } from '@/components/requests/NewRequestSheet';
import { RequestDetailSheet } from '@/components/requests/RequestDetailSheet';
import { EditRequestSheet } from '@/components/requests/EditRequestSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Plus, AlertCircle, Search, User, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRequests, useAllRequests, Request, RequestWithSubmitter } from '@/hooks/useRequests';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useBreakpoint } from '@/hooks/use-mobile';

const isEditable = (status: string) => status === 'draft' || status === 'change_requested';

// Mobile card for admin requests view
function AdminRequestCard({ 
  request, 
  onClick 
}: { 
  request: RequestWithSubmitter; 
  onClick: () => void;
}) {
  const submitterName = request.submitter
    ? `${request.submitter.first_name || ''} ${request.submitter.last_name || ''}`.trim() || request.submitter.email
    : 'Unknown';

  return (
    <Card 
      className="p-4 border-border bg-card cursor-pointer card-interactive"
      onClick={onClick}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs font-medium">
            {request.request_type?.name || 'Unknown'}
          </Badge>
          <StatusBadge status={request.status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="truncate">{submitterName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Created {format(new Date(request.created_at), 'MMM d, yyyy')}</span>
        </div>
      </div>
    </Card>
  );
}

function AdminRequestsView() {
  const { data: allRequests = [], isLoading } = useAllRequests();
  const [selectedRequest, setSelectedRequest] = useState<RequestWithSubmitter | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { isMobileOrTablet } = useBreakpoint();

  const filteredRequests = allRequests.filter((request) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const submitterName = `${request.submitter?.first_name || ''} ${request.submitter?.last_name || ''}`.toLowerCase();
    const typeName = request.request_type?.name?.toLowerCase() || '';
    return (
      submitterName.includes(query) ||
      typeName.includes(query) ||
      request.status.toLowerCase().includes(query)
    );
  });

  const getSubmitterName = (request: RequestWithSubmitter) => {
    if (!request.submitter) return 'Unknown';
    const { first_name, last_name, email } = request.submitter;
    if (first_name || last_name) {
      return `${first_name || ''} ${last_name || ''}`.trim();
    }
    return email;
  };

  return (
    <>
      <PageHeader
        title="All Requests"
        description="Monitor and audit all requests in the system"
      />

      <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: '100ms' }}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-foreground">Request Overview</CardTitle>
              <CardDescription>
                {allRequests.length} total request{allRequests.length === 1 ? '' : 's'} in the system
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRequests.length > 0 ? (
            isMobileOrTablet ? (
              // Mobile: Card layout
              <div className="space-y-3">
                {filteredRequests.map((request) => (
                  <AdminRequestCard
                    key={request.id}
                    request={request}
                    onClick={() => setSelectedRequest(request)}
                  />
                ))}
              </div>
            ) : (
              // Desktop: Table layout
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow 
                      key={request.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <TableCell className="font-medium">
                        {getSubmitterName(request)}
                      </TableCell>
                      <TableCell>{request.request_type?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(request.updated_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            <EmptyState
              icon={FileText}
              title={searchQuery ? 'No matching requests' : 'No requests yet'}
              description={searchQuery ? 'Try adjusting your search query' : 'No requests have been submitted to the system'}
            />
          )}
        </CardContent>
      </Card>

      <RequestDetailSheet
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      />
    </>
  );
}

function EmployeeRequestsView() {
  const { profile } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editingRequest, setEditingRequest] = useState<Request | null>(null);
  
  const { data: userRequests = [], isLoading } = useRequests(profile?.id);

  const handleRequestClick = (request: Request) => {
    if (isEditable(request.status)) {
      setEditingRequest(request);
    } else {
      setSelectedRequest(request);
    }
  };

  const needsAttentionRequests = userRequests.filter(r => r.status === 'change_requested');
  const otherRequests = userRequests.filter(r => r.status !== 'change_requested');

  return (
    <>
      <PageHeader
        title="My Requests"
        description="View and manage your submitted requests"
        action={{
          label: 'New Request',
          icon: Plus,
          onClick: () => setSheetOpen(true)
        }}
      />

      {needsAttentionRequests.length > 0 && (
        <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards] border-[hsl(var(--status-change-requested))]/30 bg-card" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[hsl(var(--status-change-requested))]" />
              <CardTitle className="text-foreground">Needs Your Attention</CardTitle>
            </div>
            <CardDescription>
              These requests require changes before they can be approved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {needsAttentionRequests.map((request) => (
                <RequestCard 
                  key={request.id} 
                  request={request} 
                  onClick={() => handleRequestClick(request)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: needsAttentionRequests.length > 0 ? '200ms' : '100ms' }}>
        <CardHeader>
          <CardTitle className="text-foreground">All Requests</CardTitle>
          <CardDescription>
            {userRequests.length > 0 
              ? `You have ${userRequests.length} request${userRequests.length === 1 ? '' : 's'}`
              : 'A list of all your submitted requests'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : otherRequests.length > 0 ? (
            <div className="space-y-3">
              {otherRequests.map((request) => (
                <RequestCard 
                  key={request.id} 
                  request={request}
                  onClick={() => handleRequestClick(request)}
                />
              ))}
            </div>
          ) : userRequests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No requests found"
              description="You haven't submitted any requests yet"
              action={{
                label: 'Create Your First Request',
                icon: Plus,
                onClick: () => setSheetOpen(true)
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <NewRequestSheet 
        open={sheetOpen} 
        onOpenChange={setSheetOpen}
      />

      <RequestDetailSheet
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      />

      <EditRequestSheet
        request={editingRequest}
        open={!!editingRequest}
        onOpenChange={(open) => !open && setEditingRequest(null)}
      />
    </>
  );
}

export default function Requests() {
  const { isAdmin } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-8">
        {isAdmin ? <AdminRequestsView /> : <EmployeeRequestsView />}
      </div>
    </AppLayout>
  );
}
