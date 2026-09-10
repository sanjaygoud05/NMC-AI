import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { RequestTypeList } from '@/components/admin/RequestTypeList';

export default function Settings() {
  return (
    <AppLayout requireRole={['admin']}>
      <div className="space-y-8">
        <PageHeader
          title="Settings"
          description="Configure system settings and request types"
        />

        <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="text-foreground">Request Types</CardTitle>
            <CardDescription>
              Configure and manage available request types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequestTypeList />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
